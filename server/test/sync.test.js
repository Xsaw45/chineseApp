import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildApp } from '../app.js'

let app
let dir
let sent
let cookies

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'yidiano-'))
  sent = []
  cookies = new Map()
  app = buildApp({
    dbPath: join(dir, 'test.db'),
    publicDir: dir,
    publicUrl: 'https://yidiano.example',
    mailer: { sendLogin: async (message) => sent.push(message) },
    logger: false,
  })
})

afterEach(async () => {
  await app.close()
  rmSync(dir, { recursive: true, force: true })
})

// Session par adresse, ouverte au premier appel avec le code recu par e-mail.
async function sessionOf(login) {
  if (!cookies.has(login)) {
    await app.inject({ method: 'POST', url: '/api/auth/request', payload: { email: login } })
    const res = await app.inject({ method: 'POST', url: '/api/auth/verify', payload: { email: login, code: sent.at(-1).code } })
    cookies.set(login, res.headers['set-cookie'].split(';')[0])
  }
  return cookies.get(login)
}

async function sync(login, body) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/sync/zh',
    headers: login ? { cookie: await sessionOf(login) } : {},
    payload: { user: login, since: 0, changes: [], ...body },
  })
  return { status: res.statusCode, body: res.json() }
}

test('le changement le plus recent gagne, quel que soit l ordre d arrivee', async () => {
  await sync('a@x.fr', { changes: [{ key: 'hsk1_1', value: { phase: 2 }, updatedAt: 200 }] })
  const late = await sync('a@x.fr', { changes: [{ key: 'hsk1_1', value: { phase: 0 }, updatedAt: 100 }] })

  // l'appareil en retard recoit la version du serveur pour converger
  assert.deepEqual(late.body.changes, [{ key: 'hsk1_1', value: { phase: 2 }, updatedAt: 200 }])
  const fresh = await sync('a@x.fr', {})
  assert.deepEqual(fresh.body.changes, [{ key: 'hsk1_1', value: { phase: 2 }, updatedAt: 200 }])
})

test('le curseur ne renvoie que ce qui a change depuis, sans l echo des propres ecritures', async () => {
  const first = await sync('a@x.fr', { changes: [{ key: 'settings', value: { darkMode: true }, updatedAt: 10 }] })
  assert.deepEqual(first.body.changes, [])

  await sync('a@x.fr', { changes: [{ key: 'hsk1_2', value: { known: true }, updatedAt: 20 }] })
  const other = await sync('a@x.fr', { since: first.body.cursor })
  assert.deepEqual(other.body.changes, [{ key: 'hsk1_2', value: { known: true }, updatedAt: 20 }])

  const idle = await sync('a@x.fr', { since: other.body.cursor })
  assert.deepEqual(idle.body.changes, [])
  assert.equal(idle.body.cursor, other.body.cursor)
})

test('une suppression (value null) se propage', async () => {
  await sync('a@x.fr', { changes: [{ key: 'hsk1_1', value: { known: true }, updatedAt: 10 }] })
  await sync('a@x.fr', { changes: [{ key: 'hsk1_1', value: null, updatedAt: 20 }] })
  const fresh = await sync('a@x.fr', {})
  assert.deepEqual(fresh.body.changes, [{ key: 'hsk1_1', value: null, updatedAt: 20 }])
})

test('les utilisateurs sont isoles', async () => {
  await sync('a@x.fr', { changes: [{ key: 'k', value: 1, updatedAt: 10 }] })
  assert.deepEqual((await sync('b@x.fr', {})).body.changes, [])
})

test('donnees locales d un autre utilisateur : 409 et rien n est ecrit', async () => {
  const res = await sync('b@x.fr', { user: 'a@x.fr', changes: [{ key: 'k', value: 1, updatedAt: 10 }] })
  assert.equal(res.status, 409)
  assert.deepEqual(res.body, { user: 'b@x.fr' })
  assert.deepEqual((await sync('b@x.fr', {})).body.changes, [])
})

test('sans session : 401', async () => {
  assert.equal((await sync(null, {})).status, 401)
  assert.equal((await app.inject({ url: '/api/me' })).statusCode, 401)
})
