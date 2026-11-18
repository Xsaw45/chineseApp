import { createHmac, timingSafeEqual } from 'node:crypto'

/*
 * Abonnement Yidiano+ par Paddle Billing (vendeur de référence : Paddle encaisse, gère la TVA et les factures).
 * Le client ouvre le paiement avec Paddle.js (jeton client) ; Paddle prévient le serveur par webhook à chaque
 * changement d'abonnement, et le serveur ouvre Yidiano+ (accounts.plus_expires_at) jusqu'à la fin de la période
 * payée, plus GRACE (prélèvement en échec en cours de relance, webhook en retard).
 * Environnement : PADDLE_ENV = sandbox (tests) ou production.
 */

export const GRACE = 3 * 24 * 3600_000
const SIGNATURE_TOLERANCE = 5 * 60_000
const API = { sandbox: 'https://sandbox-api.paddle.com', production: 'https://api.paddle.com' }
// Statuts Paddle qui donnent accès jusqu'à la fin de la période en cours.
const ACTIVE = new Set(['active', 'trialing', 'past_due'])

/** Configuration lue dans l'environnement ; null si Paddle n'est pas configuré (l'app affiche « bientôt »). */
export function paddleConfig(env) {
  const keys = ['PADDLE_API_KEY', 'PADDLE_CLIENT_TOKEN', 'PADDLE_WEBHOOK_SECRET', 'PADDLE_PRICE_MONTHLY', 'PADDLE_PRICE_YEARLY']
  if (!keys.every(key => env[key])) return null
  const environment = env.PADDLE_ENV === 'production' ? 'production' : 'sandbox'
  return {
    environment,
    apiUrl: API[environment],
    apiKey: env.PADDLE_API_KEY,
    clientToken: env.PADDLE_CLIENT_TOKEN,
    webhookSecret: env.PADDLE_WEBHOOK_SECRET,
    prices: { monthly: env.PADDLE_PRICE_MONTHLY, yearly: env.PADDLE_PRICE_YEARLY },
  }
}

/** En-tête Paddle-Signature « ts=…;h1=… » : HMAC-SHA256 de « ts:corps brut » avec le secret du webhook. */
export function verifySignature(rawBody, header, secret, now = Date.now()) {
  if (typeof header !== 'string') return false
  const parts = header.split(';').map(part => part.split('='))
  const ts = parts.find(([key]) => key === 'ts')?.[1]
  const signatures = parts.filter(([key]) => key === 'h1').map(([, value]) => value)
  if (!ts || !signatures.length || Math.abs(now - Number(ts) * 1000) > SIGNATURE_TOLERANCE) return false
  const expected = createHmac('sha256', secret).update(`${ts}:${rawBody}`).digest()
  return signatures.some(signature => {
    const given = Buffer.from(signature, 'hex')
    return given.length === expected.length && timingSafeEqual(given, expected)
  })
}

/**
 * Ce qu'un événement subscription.* change sur le compte : { expiresAt, status, cancelAt }.
 * expiresAt : fin de la période payée + GRACE tant que l'abonnement est actif, sinon l'instant de l'événement.
 */
export function subscriptionAccess(subscription, occurredAt) {
  const periodEnd = subscription.current_billing_period?.ends_at
  const active = ACTIVE.has(subscription.status) && periodEnd
  const scheduledCancel = subscription.scheduled_change?.action === 'cancel' ? subscription.scheduled_change.effective_at : null
  return {
    status: subscription.status,
    expiresAt: active ? Date.parse(periodEnd) + GRACE : occurredAt,
    cancelAt: scheduledCancel ? Date.parse(scheduledCancel) : null,
  }
}

/** Lien vers l'espace client Paddle (résiliation, carte, factures) pour un client et son abonnement. */
export async function portalUrl(config, customerId, subscriptionId) {
  const response = await fetch(`${config.apiUrl}/customers/${encodeURIComponent(customerId)}/portal-sessions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${config.apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ subscription_ids: subscriptionId ? [subscriptionId] : [] }),
  })
  if (!response.ok) throw new Error(`Paddle portal-sessions : ${response.status} ${await response.text()}`)
  const { data } = await response.json()
  return data.urls.general.overview
}

/** Résilie l'abonnement tout de suite (suppression du compte) : plus aucun prélèvement. */
export async function cancelSubscription(config, subscriptionId) {
  const response = await fetch(`${config.apiUrl}/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, {
    method: 'POST',
    headers: { authorization: `Bearer ${config.apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ effective_from: 'immediately' }),
  })
  // déjà résilié : rien à faire
  if (!response.ok && response.status !== 400) throw new Error(`Paddle cancel : ${response.status} ${await response.text()}`)
}
