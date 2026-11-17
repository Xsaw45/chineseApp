import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildApp } from '../app.js'
import { GRACE } from '../paddle.js'

const SECRET = 'pdl_ntfset_test'
const paddle = {
  environment: 'sandbox', apiUrl: 'https://sandbox-api.paddle.com', apiKey: 'k', clientToken: 'test_token',
  webhookSecret: SECRET, prices: { monthly: 'pri_m', yearly: 'pri_y' },
}

let app
let dir
let sent

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'yidiano-paddle-'))
  sent = []
  app = buildApp({
    dbPath: join(dir, 'test.db'), publicDir: dir, publicUrl: 'https://yidiano.example',
    mailer: { sendLogin: async (message) => sent.push(message) }, paddle, logger: false,
  })
})

afterEach(async () => {
  await app.close()
  rmSync(dir, { recursive: true, force: true })
})

async function signIn(email) {
  await app.inject({ method: 'POST', url: '/api/auth/request', payload: { email } })
  const res = await app.inject({ method: 'POST', url: '/api/auth/verify', payload: { email, code: sent.at(-1).code } })
  return res.headers['set-cookie'].split(';')[0]
}

const me = async (cookie) => (await app.inject({ url: '/api/me', headers: { cookie } })).json()

function webhook(event, { secret = SECRET, ts = Math.floor(Date.now() / 1000) } = {}) {
  const body = JSON.stringify(event)
  const h1 = createHmac('sha256', secret).update(`${ts}:${body}`).digest('hex')
  return app.inject({
    method: 'POST', url: '/api/paddle/webhook', payload: body,
    headers: { 'content-type': 'application/json', 'paddle-signature': `ts=${ts};h1=${h1}` },
  })
}

const day = 24 * 3600_000
const iso = (t) => new Date(t).toISOString()
function subscriptionEvent(type, { occurredAt, status = 'active', endsAt, email = 'a@x.fr', id = 'sub_1', cancelAt } = {}) {
  return {
    event_type: type,
    occurred_at: iso(occurredAt),
    data: {
      id, status, customer_id: 'ctm_1', custom_data: { email },
      current_billing_period: endsAt ? { starts_at: iso(endsAt - 30 * day), ends_at: iso(endsAt) } : null,
      scheduled_change: cancelAt ? { action: 'cancel', effective_at: iso(cancelAt) } : null,
    },
  }
}

test('un abonnement payé ouvre Yidiano+ jusqu a la fin de la période, plus la marge', async () => {
  const cookie = await signIn('a@x.fr')
  const now = Date.now()
  const endsAt = now + 30 * day
  assert.equal((await webhook(subscriptionEvent('subscription.created', { occurredAt: now, endsAt, email: 'A@x.fr' }))).statusCode, 200)

  const { access } = await me(cookie)
  assert.equal(access.plus, true)
  assert.equal(access.source, 'subscription')
  assert.equal(access.plusExpiresAt, endsAt + GRACE)
  assert.deepEqual(access.subscription, { status: 'active', cancelAt: null, renewsAt: endsAt })
})

test('signature fausse ou trop ancienne : rien ne change', async () => {
  const cookie = await signIn('a@x.fr')
  const now = Date.now()
  const event = subscriptionEvent('subscription.created', { occurredAt: now, endsAt: now + 30 * day })
  assert.equal((await webhook(event, { secret: 'autre' })).statusCode, 401)
  assert.equal((await webhook(event, { ts: Math.floor(now / 1000) - 3600 })).statusCode, 401)
  assert.equal((await me(cookie)).access.plus, false)
})

test('résiliation : accès jusqu a la fin de la période, puis plus rien ; un événement en retard est ignoré', async () => {
  const cookie = await signIn('a@x.fr')
  const now = Date.now()
  const endsAt = now + 30 * day
  await webhook(subscriptionEvent('subscription.created', { occurredAt: now - 2000, endsAt }))
  await webhook(subscriptionEvent('subscription.updated', { occurredAt: now - 1000, endsAt, cancelAt: endsAt }))
  let { access } = await me(cookie)
  assert.equal(access.plus, true)
  assert.equal(access.subscription.cancelAt, endsAt)

  await webhook(subscriptionEvent('subscription.canceled', { occurredAt: now, status: 'canceled' }))
  // livré après coup : l'ancien « active » ne rouvre pas l'accès
  await webhook(subscriptionEvent('subscription.updated', { occurredAt: now - 1500, endsAt }))
  access = (await me(cookie)).access
  assert.equal(access.plus, false)
  assert.equal(access.subscription.status, 'canceled')
})

test('un second abonnement d un autre client ne remplace pas l abonnement actif du compte', async () => {
  const cookie = await signIn('a@x.fr')
  const now = Date.now()
  await webhook(subscriptionEvent('subscription.created', { occurredAt: now - 1000, endsAt: now + 30 * day }))
  const other = subscriptionEvent('subscription.canceled', { occurredAt: now, status: 'canceled', id: 'sub_2' })
  other.data.customer_id = 'ctm_2'
  await webhook(other)
  const { access } = await me(cookie)
  assert.equal(access.plus, true)
  assert.equal(access.subscription.status, 'active')
})

test('configuration du paiement : réservée aux comptes connectés, sans le secret', async () => {
  assert.equal((await app.inject({ url: '/api/paddle/config' })).statusCode, 401)
  const cookie = await signIn('a@x.fr')
  const config = (await app.inject({ url: '/api/paddle/config', headers: { cookie } })).json()
  assert.deepEqual(config, { environment: 'sandbox', clientToken: 'test_token', prices: { monthly: 'pri_m', yearly: 'pri_y' } })
})
