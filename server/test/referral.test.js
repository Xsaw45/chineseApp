import { test, beforeEach, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { createHash, createHmac } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { buildApp } from '../app.js'

const SECRET = 'pdl_ntfset_test'
const paddle = {
  environment: 'sandbox', apiUrl: 'https://sandbox-api.paddle.com', apiKey: 'k', clientToken: 'test_token',
  webhookSecret: SECRET, prices: { monthly: 'pri_m', yearly: 'pri_y' }, trialPrices: { monthly: 'pri_mt', yearly: 'pri_yt' },
  referralTrialPrices: { monthly: 'pri_mr', yearly: 'pri_yr' },
}
const day = 24 * 3600_000

let app
let dir
let sent

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'yidiano-referral-'))
  sent = []
  app = buildApp({
    dbPath: join(dir, 'test.db'), publicDir: dir, publicUrl: 'https://yidiano.example', paddle, logger: false,
    mailer: { sendLogin: async (message) => sent.push(message) },
  })
})

afterEach(async () => {
  mock.restoreAll()
  await app.close()
  rmSync(dir, { recursive: true, force: true })
})

/** Connexion par code ; refCookie : cookie de parrainage posé par l'ouverture du lien. */
async function signIn(email, refCookie) {
  await app.inject({ method: 'POST', url: '/api/auth/request', payload: { email } })
  const res = await app.inject({
    method: 'POST', url: '/api/auth/verify', payload: { email, code: sent.at(-1).code },
    headers: refCookie ? { cookie: refCookie } : {},
  })
  return [res.headers['set-cookie']].flat()[0].split(';')[0]
}

const get = async (url, cookie) => (await app.inject({ url, headers: { cookie } })).json()

/** Ouvre le lien de parrainage de cookie (le compte parrain) : renvoie le cookie posé chez le visiteur. */
async function openReferralLink(referrerCookie) {
  const { link } = await get('/api/referral', referrerCookie)
  const res = await app.inject({ url: new URL(link).pathname + new URL(link).search })
  assert.match(res.headers['set-cookie'], /^yidiano_ref=[A-Z2-9]{8}; Path=\/; HttpOnly; SameSite=Lax; Max-Age=2592000; Secure$/)
  return res.headers['set-cookie'].split(';')[0]
}

function webhook(email, { status = 'trialing', id = `sub_${email}`, customer = `ctm_${email}`, endsAt = Date.now() + 15 * day } = {}) {
  const body = JSON.stringify({
    event_type: 'subscription.created', occurred_at: new Date().toISOString(),
    data: {
      id, status, customer_id: customer, custom_data: { email },
      current_billing_period: { starts_at: new Date(Date.now()).toISOString(), ends_at: new Date(endsAt).toISOString() },
      scheduled_change: null,
    },
  })
  const ts = Math.floor(Date.now() / 1000)
  const h1 = createHmac('sha256', SECRET).update(`${ts}:${body}`).digest('hex')
  return app.inject({
    method: 'POST', url: '/api/paddle/webhook', payload: body,
    headers: { 'content-type': 'application/json', 'paddle-signature': `ts=${ts};h1=${h1}` },
  })
}

test('le filleul enregistre sa carte : le parrain gratuit gagne 30 jours de Yidiano+, une seule fois', async () => {
  const referrer = await signIn('parrain@x.fr')
  const ref = await openReferralLink(referrer)
  const referee = await signIn('filleul@x.fr', ref)
  // Le filleul a un essai de 30 jours ; le parrain, sans lien, celui de 15 jours.
  assert.deepEqual((await get('/api/paddle/config', referee)).trial, { days: 30, prices: { monthly: 'pri_mr', yearly: 'pri_yr' }, referral: true })
  assert.equal((await get('/api/paddle/config', referrer)).trial.days, 15)
  assert.deepEqual(await get('/api/referral', referrer), {
    link: (await get('/api/referral', referrer)).link, invited: 1, qualified: 0, months: 0, monthsYear: 0, maxMonthsPerYear: 12,
  })
  assert.equal((await get('/api/me', referrer)).access.plus, false)

  const before = Date.now()
  await webhook('filleul@x.fr', { status: 'trialing' })
  const { access } = await get('/api/me', referrer)
  assert.equal(access.plus, true)
  assert.equal(access.source, 'referral')
  assert.ok(access.bonusUntil >= before + 30 * day && access.bonusUntil <= Date.now() + 30 * day)

  // Le filleul passe de l'essai au paiement : pas de second mois pour le même filleul.
  await webhook('filleul@x.fr', { status: 'active' })
  const stats = await get('/api/referral', referrer)
  assert.equal(stats.qualified, 1)
  assert.equal(stats.months, 1)
  assert.equal((await get('/api/me', referrer)).access.bonusUntil, access.bonusUntil)
})

test('pas de récompense : compte déjà connecté avant le lien, ou filleul sans carte enregistrée', async () => {
  const referrer = await signIn('parrain@x.fr')
  const ref = await openReferralLink(referrer)
  // Compte déjà utilisé avant d'ouvrir le lien (première connexion passée) : pas filleul.
  const db = new DatabaseSync(join(dir, 'test.db'))
  db.prepare("INSERT INTO accounts (email, role, created_at, first_login_at) VALUES ('ancien@x.fr', 'user', 1, 1)").run()
  db.close()
  await signIn('ancien@x.fr', ref)
  await signIn('gratuit@x.fr', ref)
  assert.equal((await get('/api/referral', referrer)).invited, 1)
  // Abonnement résilié (pas de carte active) : aucune récompense ; l'ancien compte n'est pas filleul.
  await webhook('gratuit@x.fr', { status: 'canceled' })
  await webhook('ancien@x.fr', { status: 'trialing' })
  assert.equal((await get('/api/referral', referrer)).months, 0)
  assert.equal((await get('/api/me', referrer)).access.plus, false)
})

test('parrain abonné : le prochain prélèvement Paddle est repoussé d un mois, sans facturation', async () => {
  const referrer = await signIn('parrain@x.fr')
  await webhook('parrain@x.fr', { status: 'active', endsAt: Date.UTC(2027, 0, 31, 10) })
  const ref = await openReferralLink(referrer)
  await signIn('filleul@x.fr', ref)

  const calls = []
  const realFetch = globalThis.fetch
  mock.method(globalThis, 'fetch', async (url, init = {}) => {
    if (!String(url).startsWith(paddle.apiUrl)) return realFetch(url, init)
    calls.push({ url: String(url), method: init.method || 'GET', body: init.body && JSON.parse(init.body) })
    return new Response(JSON.stringify({ data: { id: 'sub_parrain@x.fr', next_billed_at: '2027-01-31T10:00:00Z' } }))
  })
  await webhook('filleul@x.fr', { status: 'trialing' })
  assert.deepEqual(calls.map(c => `${c.method} ${c.url}`), [
    'GET https://sandbox-api.paddle.com/subscriptions/sub_parrain%40x.fr',
    'PATCH https://sandbox-api.paddle.com/subscriptions/sub_parrain%40x.fr',
  ])
  // Fin janvier + un mois : dernier jour de février, sans facturer la différence.
  assert.deepEqual(calls[1].body, { next_billed_at: '2027-02-28T10:00:00.000Z', proration_billing_mode: 'do_not_bill' })
  assert.equal((await get('/api/me', referrer)).access.bonusUntil, null)
  assert.equal((await get('/api/referral', referrer)).months, 1)
})

test('plafond : au plus 12 mois gagnés par an', async () => {
  const referrer = await signIn('parrain@x.fr')
  const db = new DatabaseSync(join(dir, 'test.db'))
  const insert = db.prepare("INSERT INTO referrals (referee, referrer, created_at, rewarded_at, reward) VALUES (?, 'parrain@x.fr', ?, ?, 'access')")
  for (let i = 0; i < 12; i++) insert.run(createHash('sha256').update(`old${i}@x.fr`).digest('hex'), Date.now(), Date.now() - day)
  db.close()
  const ref = await openReferralLink(referrer)
  await signIn('treizieme@x.fr', ref)
  await webhook('treizieme@x.fr')
  const stats = await get('/api/referral', referrer)
  assert.equal(stats.qualified, 13)
  assert.equal(stats.months, 12)
  assert.equal((await get('/api/me', referrer)).access.plus, false)
})
