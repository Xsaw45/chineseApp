import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { buildApp } from '../app.js'

let app
let dir
let dbPath
let sent

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'yidiano-auth-'))
  dbPath = join(dir, 'test.db')
  sent = []
  app = buildApp({
    dbPath,
    publicDir: dir,
    publicUrl: 'https://yidiano.example',
    allowedEmails: new Set(['a@x.fr', 'b@x.fr']),
    mailer: { sendLogin: async (message) => sent.push(message) },
    logger: false,
  })
})

afterEach(async () => {
  await app.close()
  rmSync(dir, { recursive: true, force: true })
})

const post = (url, payload, cookie) =>
  app.inject({ method: 'POST', url, payload, headers: cookie ? { cookie } : {} })

const cookieOf = (res) => res.headers['set-cookie'].split(';')[0]
const tokenOf = (message) => new URL(message.link).searchParams.get('token')

async function signIn(email) {
  await post('/api/auth/request', { email })
  const res = await post('/api/auth/verify', { email, code: sent.at(-1).code })
  return cookieOf(res)
}

test('les en-tetes Tailscale sont ignores', async () => {
  const res = await app.inject({ url: '/api/me', headers: { 'tailscale-user-login': 'a@x.fr' } })
  assert.equal(res.statusCode, 401)
  assert.deepEqual(res.json(), { error: 'connexion requise', login: '/login/' })
})

test('connexion par code : la session donne acces a la progression de l adresse', async () => {
  const cookie = await signIn('A@X.fr')
  const me = await app.inject({ url: '/api/me', headers: { cookie } })
  assert.deepEqual(me.json(), {
    login: 'a@x.fr',
    name: 'a@x.fr',
    method: 'email',
    role: 'user',
    access: {
      plus: false,
      plan: 'free',
      source: 'free',
      trialAvailable: true,
      plusExpiresAt: null,
      bonusUntil: null,
      subscription: null,
    },
  })
  const sync = await app.inject({
    method: 'POST', url: '/api/sync/zh', headers: { cookie },
    payload: { user: null, since: 0, changes: [{ key: 'hsk1_0001', value: { s: 1 }, updatedAt: 10 }] },
  })
  assert.equal(sync.json().user, 'a@x.fr')
})

test('le lien ne sert qu une fois', async () => {
  await post('/api/auth/request', { email: 'a@x.fr' })
  const token = tokenOf(sent[0])
  assert.equal(new URL(sent[0].link).searchParams.get('next'), '/')

  assert.equal((await post('/api/auth/verify', { token })).statusCode, 200)
  assert.equal((await post('/api/auth/verify', { token })).statusCode, 400)
})

test('5 codes faux invalident la demande, meme le bon code ensuite', async () => {
  await post('/api/auth/request', { email: 'a@x.fr' })
  const good = sent[0].code
  const wrong = good === '000000' ? '111111' : '000000'
  for (let left = 4; left >= 0; left--) {
    const res = await post('/api/auth/verify', { email: 'a@x.fr', code: wrong })
    assert.deepEqual(res.json(), { error: 'wrong_code', attemptsLeft: left })
  }
  const res = await post('/api/auth/verify', { email: 'a@x.fr', code: good })
  assert.deepEqual(res.json(), { error: 'expired_code' })
})

test('adresse non invitee : 403 et aucun e-mail', async () => {
  const res = await post('/api/auth/request', { email: 'c@x.fr' })
  assert.equal(res.statusCode, 403)
  assert.equal(sent.length, 0)
})

test('deuxieme envoi trop rapproche : 429', async () => {
  assert.equal((await post('/api/auth/request', { email: 'a@x.fr' })).statusCode, 202)
  const res = await post('/api/auth/request', { email: 'a@x.fr' })
  assert.equal(res.statusCode, 429)
  assert.equal(res.json().error, 'too_soon')
  assert.equal(sent.length, 1)
})

test('inscriptions ouvertes : 10 e-mails par heure et par IP, l IP vue par Caddy et non celle ecrite par le client', async () => {
  const open = buildApp({
    dbPath: join(dir, 'open.db'),
    publicDir: dir,
    publicUrl: 'https://yidiano.example',
    mailer: { sendLogin: async (message) => sent.push(message) },
    logger: false,
  })
  const request = (email, forwardedFor) => open.inject({
    method: 'POST', url: '/api/auth/request', payload: { email }, headers: { 'x-forwarded-for': forwardedFor },
  })
  try {
    for (let i = 0; i < 10; i++) assert.equal((await request(`u${i}@x.fr`, '203.0.113.7')).statusCode, 202)
    // Un robot ajoute sa propre adresse en tête : Caddy ajoute la vraie à la fin, c'est elle qui compte.
    const blocked = await request('u10@x.fr', '198.51.100.1, 203.0.113.7')
    assert.equal(blocked.statusCode, 429)
    assert.equal(blocked.json().error, 'too_many_ip')
    assert.ok(blocked.json().retryAfter > 0 && blocked.json().retryAfter <= 3600)
    assert.equal(sent.length, 10)
    assert.equal((await request('u10@x.fr', '203.0.113.8')).statusCode, 202)
  } finally {
    await open.close()
  }
})

test('next ne peut pas renvoyer vers un autre site', async () => {
  await post('/api/auth/request', { email: 'a@x.fr', next: '//evil.example/' })
  assert.equal(new URL(sent[0].link).searchParams.get('next'), '/')
})

test('administration : seul un admin peut attribuer les roles', async () => {
  const adminCookie = await signIn('a@x.fr')
  const userCookie = await signIn('b@x.fr')
  assert.equal((await app.inject({ url: '/api/admin/accounts', headers: { cookie: userCookie } })).statusCode, 403)

  const sqlite = new DatabaseSync(dbPath)
  sqlite.prepare("UPDATE accounts SET role = 'admin' WHERE email = ?").run('a@x.fr')
  sqlite.close()

  // Usage de b : 2 jours pratiqués (dont un aujourd'hui), un mot appris, un mot placé par le test de niveau (pas compté).
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' })
  await app.inject({
    method: 'POST', url: '/api/sync/zh', headers: { cookie: userCookie },
    payload: {
      user: null, since: 0, changes: [
        { key: `act_${today}`, value: { practiced: true, seconds: 600, learned: 1 }, updatedAt: 1 },
        { key: 'act_2020-01-01', value: { seconds: 330, learned: 0 }, updatedAt: 1 },
        { key: 'act_2020-01-02', value: { practiced: false, seconds: 60 }, updatedAt: 1 },
        { key: 'hsk1_0001', value: { known: true }, updatedAt: 1 },
        { key: 'hsk2_0001', value: { known: true, placed: true }, updatedAt: 1 },
        { key: 'settings', value: { lang: 'fr' }, updatedAt: 1 },
      ],
    },
  })

  const list = await app.inject({ url: '/api/admin/accounts', headers: { cookie: adminCookie } })
  assert.equal(list.statusCode, 200)
  assert.deepEqual(list.json().map(account => account.login), ['a@x.fr', 'b@x.fr'])
  assert.equal(list.json()[0].stats, null)
  assert.deepEqual(list.json()[1].stats, { days: 2, daysWeek: 1, lastDay: today, minutes: 17, learned: 1, items: 1 })

  const changed = await app.inject({
    method: 'PATCH',
    url: '/api/admin/accounts/b%40x.fr',
    headers: { cookie: adminCookie },
    payload: { role: 'beta' },
  })
  assert.equal(changed.statusCode, 200)
  assert.equal(changed.json().role, 'beta')
  assert.equal(changed.json().access.plus, true)
})

test('deconnexion : la session ne vaut plus', async () => {
  const cookie = await signIn('b@x.fr')
  await post('/api/auth/logout', undefined, cookie)
  assert.equal((await app.inject({ url: '/api/me', headers: { cookie } })).statusCode, 401)
})

test('/ : la page de presentation sans session, l app avec une session', async () => {
  writeFileSync(join(dir, 'index.html'), 'app')
  writeFileSync(join(dir, 'landing.html'), 'landing')
  const visitor = await app.inject({ url: '/' })
  assert.equal(visitor.statusCode, 200)
  assert.equal(visitor.body, 'landing')
  assert.equal(visitor.headers.vary, 'Cookie')

  const cookie = await signIn('a@x.fr')
  assert.equal((await app.inject({ url: '/', headers: { cookie } })).body, 'app')
})

test('la page de connexion est servie sans session', async () => {
  mkdirSync(join(dir, 'login'))
  writeFileSync(join(dir, 'login', 'index.html'), '<!doctype html>')
  assert.equal((await app.inject({ url: '/login/' })).statusCode, 200)
})

test('contenu Yidiano+ : refusé à la formule gratuite, servi pendant l abonnement', async () => {
  const cookie = await signIn('a@x.fr')
  assert.equal((await app.inject({ url: '/api/content', headers: { cookie } })).statusCode, 403)

  const db = new DatabaseSync(dbPath)
  db.prepare("UPDATE accounts SET plus_expires_at = ? WHERE email = 'a@x.fr'").run(Date.now() + 3600_000)
  db.close()
  const res = await app.inject({ url: '/api/content', headers: { cookie } })
  assert.equal(res.statusCode, 200)
  const { version, grammar, readings } = res.json()
  assert.match(version, /^[0-9a-f]{16}$/)
  assert.ok(grammar.some(point => point.level === 1) && grammar.every(point => point.explanation))
  assert.ok(grammar.every(point => !['shi', 'ma', 'you'].includes(point.id)))
  assert.ok(readings.some(reading => reading.id === 'wenlu' && reading.lines.length > 1))
  assert.ok(readings.every(reading => !['jieshao', 'fanguan', 'mai-yifu', 'jiudian', 'mianshi'].includes(reading.id)))
})

test('suppression du compte : confirmation par l adresse, puis progression et sessions effacées', async () => {
  const cookie = await signIn('a@x.fr')
  await app.inject({
    method: 'POST', url: '/api/sync/zh', headers: { cookie },
    payload: { user: null, since: 0, changes: [{ key: 'hsk1_0001', value: { s: 1 }, updatedAt: 10 }] },
  })
  const del = (email) => app.inject({ method: 'DELETE', url: '/api/account', headers: { cookie }, payload: { email } })

  assert.equal((await del('b@x.fr')).statusCode, 400)
  const res = await del('A@x.fr')
  assert.equal(res.statusCode, 200)
  assert.match(res.headers['set-cookie'], /Max-Age=0/)
  assert.equal((await app.inject({ url: '/api/me', headers: { cookie } })).statusCode, 401)

  const again = await signIn('a@x.fr')
  const sync = await app.inject({
    method: 'POST', url: '/api/sync/zh', headers: { cookie: again }, payload: { user: null, since: 0, changes: [] },
  })
  assert.deepEqual(sync.json().changes, [])
  assert.equal((await app.inject({ url: '/api/me', headers: { cookie: again } })).json().access.trialAvailable, true)
})
