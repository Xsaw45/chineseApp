import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { buildApp } from '../app.js'
import { cleanName, DAY_XP_CAP, MAX_RELATIONS, weekStart, weekStats } from '../social.js'

let app
let dir
let sent

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'yidiano-social-'))
  sent = []
  app = buildApp({
    dbPath: join(dir, 'test.db'), publicDir: dir, publicUrl: 'https://yidiano.example', logger: false,
    mailer: { sendLogin: async (message) => sent.push(message) },
  })
})

afterEach(async () => {
  await app.close()
  rmSync(dir, { recursive: true, force: true })
})

async function signIn(email, cookie) {
  await app.inject({ method: 'POST', url: '/api/auth/request', payload: { email } })
  const res = await app.inject({
    method: 'POST', url: '/api/auth/verify', payload: { email, code: sent.at(-1).code }, headers: cookie ? { cookie } : {},
  })
  return [res.headers['set-cookie']].flat()[0].split(';')[0]
}

const call = async (cookie, method, url, payload) => {
  const res = await app.inject({ method, url, payload, headers: { cookie } })
  return { status: res.statusCode, body: res.json() }
}
const social = async cookie => (await call(cookie, 'GET', '/api/social')).body
const today = () => new Date().toISOString().slice(0, 10)

/** Compte connecté avec un pseudo ; renvoie son cookie et son code ami. */
async function member(email, name) {
  const cookie = await signIn(email)
  assert.equal((await call(cookie, 'PUT', '/api/social/profile', { name, avatar: '猫' })).status, 200)
  return { cookie, code: (await social(cookie)).code }
}

async function practice(cookie, day, xp) {
  const value = { wordId: `act_${day}`, level: 'activity', practiced: true, learned: 0, done: [], seconds: 60, xp }
  await call(cookie, 'POST', '/api/sync/zh', { user: null, since: 0, changes: [{ key: value.wordId, value, updatedAt: Date.now() }] })
}

test('demande d ami : rien n est visible avant l acceptation, puis le classement montre les deux comptes', async () => {
  const ana = await member('ana@x.fr', 'Ana')
  const ben = await member('ben@x.fr', 'Ben')
  await practice(ana.cookie, today(), 120)
  await practice(ben.cookie, today(), 300)

  assert.deepEqual((await call(ana.cookie, 'POST', '/api/social/friends', { code: ben.code })).body, { status: 'pending' })
  const waiting = await social(ana.cookie)
  assert.deepEqual(waiting.outgoing, [{ code: ben.code }]) // pas le pseudo de Ben
  assert.equal(waiting.leaderboard.length, 1)
  assert.deepEqual((await social(ben.cookie)).incoming, [{ code: ana.code, name: 'Ana', avatar: '猫' }])

  // Ben accepte en renvoyant le code d'Ana.
  assert.deepEqual((await call(ben.cookie, 'POST', '/api/social/friends', { code: ana.code })).body, { status: 'accepted' })
  const board = (await social(ana.cookie)).leaderboard
  assert.deepEqual(board.map(row => [row.name, row.xp, row.streak, row.me]), [['Ben', 300, 1, false], ['Ana', 120, 1, true]])
  assert.equal(JSON.stringify(board).includes('@'), false) // jamais d'adresse

  // Retirer l'ami : plus rien des deux côtés.
  await call(ben.cookie, 'DELETE', `/api/social/friends/${ana.code}`)
  assert.equal((await social(ana.cookie)).leaderboard.length, 1)
})

test('pseudo obligatoire pour demander, unique sans tenir compte de la casse', async () => {
  const cookie = await signIn('sans@x.fr')
  const ana = await member('ana@x.fr', 'Ana')
  assert.equal((await call(cookie, 'POST', '/api/social/friends', { code: ana.code })).status, 403)
  assert.deepEqual((await call(cookie, 'PUT', '/api/social/profile', { name: 'ANA', avatar: '龙' })).body, { error: 'name_taken' })
  assert.equal((await call(cookie, 'PUT', '/api/social/profile', { name: 'Yidiano officiel', avatar: '龙' })).status, 400)
  assert.equal((await call(cookie, 'POST', '/api/social/friends', { code: 'ZZZZZZZZ' })).status, 403)
})

test('bloquer : la demande disparaît et le compte bloqué ne peut plus en envoyer', async () => {
  const ana = await member('ana@x.fr', 'Ana')
  const troll = await member('troll@x.fr', 'Troll')
  await call(troll.cookie, 'POST', '/api/social/friends', { code: ana.code })
  await call(ana.cookie, 'POST', '/api/social/blocks', { code: troll.code })

  const view = await social(ana.cookie)
  assert.deepEqual(view.incoming, [])
  assert.deepEqual(view.blocked, [{ code: troll.code, name: 'Troll', avatar: '猫' }])
  // Pour le compte bloqué, le code ne mène à personne ; il ne peut pas lever le blocage en « retirant » l'amitié.
  assert.equal((await call(troll.cookie, 'POST', '/api/social/friends', { code: ana.code })).status, 404)
  await call(troll.cookie, 'DELETE', `/api/social/friends/${ana.code}`)
  assert.equal((await social(ana.cookie)).blocked.length, 1)

  await call(ana.cookie, 'DELETE', `/api/social/blocks/${troll.code}`)
  assert.deepEqual((await social(ana.cookie)).blocked, [])
})

test('inscription par le lien d un ami : demande envoyée au parrain, effacée avec le compte', async () => {
  const ana = await member('ana@x.fr', 'Ana')
  const res = await app.inject({ url: `/?ref=${ana.code}` })
  const newcomer = await signIn('neuf@x.fr', res.headers['set-cookie'].split(';')[0])
  assert.deepEqual((await social(ana.cookie)).incoming, [{ code: (await social(newcomer)).code, name: null, avatar: null }])

  await call(newcomer, 'DELETE', '/api/account', { email: 'neuf@x.fr' })
  assert.deepEqual((await social(ana.cookie)).incoming, [])
})

test('XP de la semaine : du lundi au jour même, plafonnés par jour ; série jusqu à hier', () => {
  assert.equal(weekStart('2026-11-27'), '2026-11-23') // vendredi → lundi
  assert.equal(weekStart('2026-11-23'), '2026-11-23')
  const days = [
    { day: '2026-11-26', practiced: true, xp: 50 },
    { day: '2026-11-25', practiced: true, xp: 99999 },
    { day: '2026-11-23', practiced: true, xp: 10 },
    { day: '2026-11-22', practiced: true, xp: 40 }, // dimanche : semaine passée
  ]
  assert.deepEqual(weekStats(days, '2026-11-27'), { xp: 50 + DAY_XP_CAP + 10, lastWeekXp: 40, streak: 2 })
})

test('pseudo : espaces réduits, caractères chinois acceptés, symboles refusés', () => {
  assert.deepEqual(cleanName('  Lǚ   Xiǎo '), { name: 'Lǚ Xiǎo', nameKey: 'lǚ xiǎo' })
  assert.equal(cleanName('小龙')?.name, undefined) // 2 caractères : trop court
  assert.equal(cleanName('小龙女')?.name, '小龙女')
  assert.equal(cleanName('<script>'), null)
  assert.equal(cleanName('ab'), null)
})

test('les blocages réciproques restent indépendants', async () => {
  const ana = await member('ana@x.fr', 'Ana')
  const ben = await member('ben@x.fr', 'Ben')
  await call(ana.cookie, 'POST', '/api/social/blocks', { code: ben.code })
  await call(ben.cookie, 'POST', '/api/social/blocks', { code: ana.code })
  assert.equal((await social(ben.cookie)).blocked.length, 1)
  await call(ana.cookie, 'DELETE', `/api/social/blocks/${ben.code}`)
  assert.equal((await call(ana.cookie, 'POST', '/api/social/friends', { code: ben.code })).status, 404)
  assert.equal((await social(ben.cookie)).blocked.length, 1)
  await call(ben.cookie, 'DELETE', `/api/social/blocks/${ana.code}`)
  assert.equal((await call(ana.cookie, 'POST', '/api/social/friends', { code: ben.code })).body.status, 'pending')
})

test('plafonds des deux comptes et parrainage indépendant du plafond social', async () => {
  const ana = await member('ana@x.fr', 'Ana')
  const ben = await member('ben@x.fr', 'Ben')
  const db = new DatabaseSync(join(dir, 'test.db'))
  const insert = db.prepare("INSERT INTO friendships VALUES (?, ?, 'pending', 0)")
  for (let i = 0; i < MAX_RELATIONS; i++) insert.run(`other${i}@x.fr`, 'ben@x.fr')
  assert.deepEqual((await call(ana.cookie, 'POST', '/api/social/friends', { code: ben.code })).body, { error: 'recipient_full' })
  const landing = await app.inject({ url: `/?ref=${ben.code}` })
  const newcomer = await signIn('new@x.fr', landing.headers['set-cookie'].split(';')[0])
  assert.equal((await social(newcomer)).outgoing.length, 0)
  assert.equal((await call(ben.cookie, 'GET', '/api/referral')).body.invited, 1)
  for (let i = 0; i < MAX_RELATIONS; i++) insert.run('ana@x.fr', `sender${i}@x.fr`)
  assert.deepEqual((await call(ana.cookie, 'POST', '/api/social/friends', { code: (await social(newcomer)).code })).body, { error: 'too_many' })
  db.close()
})

test('fusion des XP et confidentialité des réponses sociales', async () => {
  const ana = await member('ana@x.fr', 'Ana')
  const ben = await member('ben@x.fr', 'Ben')
  await practice(ana.cookie, today(), 500)
  await practice(ana.cookie, today(), 20)
  await call(ana.cookie, 'POST', '/api/social/friends', { code: ben.code })
  await call(ben.cookie, 'POST', '/api/social/friends', { code: ana.code })
  const view = await social(ben.cookie)
  assert.equal(view.leaderboard.find(row => row.name === 'Ana').xp, 500)
  assert.equal(JSON.stringify(view).includes('@'), false)
})

test('suppression du compte retire les blocages dans les deux sens', async () => {
  const ana = await member('ana@x.fr', 'Ana')
  const ben = await member('ben@x.fr', 'Ben')
  await call(ana.cookie, 'POST', '/api/social/blocks', { code: ben.code })
  await call(ben.cookie, 'POST', '/api/social/blocks', { code: ana.code })
  await call(ana.cookie, 'DELETE', '/api/account', { email: 'ana@x.fr' })
  assert.deepEqual((await social(ben.cookie)).blocked, [])
  const db = new DatabaseSync(join(dir, 'test.db'))
  assert.equal(db.prepare('SELECT count(*) AS n FROM social_blocks').get().n, 0)
  db.close()
})
