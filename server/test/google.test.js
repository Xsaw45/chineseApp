import { test, beforeEach, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildApp } from '../app.js'

const google = { clientId: 'client-123.apps.googleusercontent.com', clientSecret: 'GOCSPX-test' }
let app
let dir
let tokenRequests

const jwt = (claims) => ['e30', Buffer.from(JSON.stringify(claims)).toString('base64url'), 'sig'].join('.')

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'yidiano-google-'))
  app = buildApp({
    dbPath: join(dir, 'test.db'), publicDir: dir, publicUrl: 'https://yidiano.example', google, logger: false,
    mailer: { sendLogin: async () => {} },
  })
  tokenRequests = []
})

afterEach(async () => {
  mock.restoreAll()
  await app.close()
  rmSync(dir, { recursive: true, force: true })
})

const cookieValue = (res, name) => {
  const cookies = [res.headers['set-cookie']].flat()
  return cookies.find(c => c.startsWith(`${name}=`))?.split(';')[0].slice(name.length + 1)
}

/** Lance la connexion, puis simule le retour de Google avec les informations du jeton (claims, sauf nonce). */
async function signInWithGoogle(claims, { next = '/', state } = {}) {
  const start = await app.inject({ url: `/api/auth/google/start?next=${encodeURIComponent(next)}` })
  const authorize = new URL(start.headers.location)
  const pending = cookieValue(start, 'yidiano_oauth')
  mock.method(globalThis, 'fetch', async (url, init) => {
    tokenRequests.push({ url, body: new URLSearchParams(init.body), challenge: authorize.searchParams.get('code_challenge') })
    const idToken = jwt({
      iss: 'https://accounts.google.com', aud: google.clientId, exp: Math.floor(Date.now() / 1000) + 3600,
      nonce: authorize.searchParams.get('nonce'), ...claims,
    })
    return new Response(JSON.stringify({ id_token: idToken }), { status: 200 })
  })
  return app.inject({
    url: `/api/auth/google/callback?code=abc&state=${state ?? authorize.searchParams.get('state')}`,
    headers: { cookie: `yidiano_oauth=${pending}` },
  })
}

test('départ : redirection vers Google avec PKCE, état gardé dans un cookie de l appareil', async () => {
  assert.deepEqual((await app.inject({ url: '/api/auth/providers' })).json(), { google: true })
  const res = await app.inject({ url: '/api/auth/google/start?next=/plus' })
  assert.equal(res.statusCode, 302)
  const url = new URL(res.headers.location)
  assert.equal(url.origin + url.pathname, 'https://accounts.google.com/o/oauth2/v2/auth')
  assert.equal(url.searchParams.get('client_id'), google.clientId)
  assert.equal(url.searchParams.get('redirect_uri'), 'https://yidiano.example/api/auth/google/callback')
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256')
  assert.match(res.headers['set-cookie'], /^yidiano_oauth=[\w-]+; Path=\/api\/auth; HttpOnly; SameSite=Lax; Max-Age=600; Secure$/)
})

test('retour de Google : session ouverte sur le compte de l adresse Google, puis retour à next', async () => {
  const res = await signInWithGoogle({ email: 'Erwan@Gmail.com', email_verified: true }, { next: '/plus' })
  assert.equal(res.statusCode, 302)
  assert.equal(res.headers.location, '/plus')
  // Le code est échangé avec le vérificateur PKCE dont Google a reçu l'empreinte au départ.
  const [{ url, body, challenge }] = tokenRequests
  assert.equal(url, 'https://oauth2.googleapis.com/token')
  assert.equal(createHash('sha256').update(body.get('code_verifier')).digest('base64url'), challenge)
  assert.equal(body.get('client_secret'), google.clientSecret)
  assert.equal(cookieValue(res, 'yidiano_oauth'), '')
  const session = cookieValue(res, 'langues_session')
  const me = await app.inject({ url: '/api/me', headers: { cookie: `langues_session=${session}` } })
  assert.equal(me.json().login, 'erwan@gmail.com')
})

test('retour refusé : état différent, adresse non vérifiée, nonce ou destinataire faux', async () => {
  const cases = [
    [{ email: 'a@x.fr', email_verified: true }, { state: 'autre' }],
    [{ email: 'a@x.fr', email_verified: false }],
    [{ email: 'a@x.fr', email_verified: true, nonce: 'rejoué' }],
    [{ email: 'a@x.fr', email_verified: true, aud: 'autre-client' }],
  ]
  for (const [claims, options] of cases) {
    const res = await signInWithGoogle(claims, options)
    assert.equal(res.headers.location, '/login/?error=oauth_failed')
    assert.equal(cookieValue(res, 'langues_session'), undefined)
    mock.restoreAll()
  }
})

test('sans configuration Google : ni bouton ni routes', async () => {
  const plain = buildApp({ dbPath: join(dir, 'plain.db'), publicDir: dir, publicUrl: 'https://yidiano.example', logger: false, mailer: { sendLogin: async () => {} } })
  try {
    assert.deepEqual((await plain.inject({ url: '/api/auth/providers' })).json(), { google: false })
    assert.equal((await plain.inject({ url: '/api/auth/google/start' })).statusCode, 404)
  } finally {
    await plain.close()
  }
})
