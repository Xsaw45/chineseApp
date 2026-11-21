import { createHmac, timingSafeEqual } from 'node:crypto'

/*
 * Abonnement Yidiano+ par Paddle Billing (vendeur de référence : Paddle encaisse, gère la TVA et les factures).
 * Le client ouvre le paiement avec Paddle.js (jeton client) ; Paddle prévient le serveur par webhook à chaque
 * changement d'abonnement, et le serveur ouvre Yidiano+ (accounts.plus_expires_at) jusqu'à la fin de la période
 * payée, plus GRACE (prélèvement en échec en cours de relance, webhook en retard).
 * Essai : prix Paddle avec trial_period (TRIAL_DAYS jours, carte demandée, prélèvement automatique à la fin), proposés
 * une fois par compte (accessFor, server/access.js : trialAvailable). Pendant l'essai, l'abonnement est « trialing ».
 * Environnement : PADDLE_ENV = sandbox (tests) ou production.
 */

export const GRACE = 3 * 24 * 3600_000
// Durée de l'essai des prix PADDLE_PRICE_*_TRIAL (trial_period dans Paddle) : à changer avec eux.
export const TRIAL_DAYS = 15
const SIGNATURE_TOLERANCE = 5 * 60_000
const API = { sandbox: 'https://sandbox-api.paddle.com', production: 'https://api.paddle.com' }
// Statuts Paddle qui donnent accès jusqu'à la fin de la période en cours (pendant l'essai : la fin de l'essai).
const ACTIVE = new Set(['active', 'trialing', 'past_due'])

/** Configuration lue dans l'environnement ; null si Paddle n'est pas configuré (l'app affiche « bientôt »). */
export function paddleConfig(env) {
  const keys = ['PADDLE_API_KEY', 'PADDLE_CLIENT_TOKEN', 'PADDLE_WEBHOOK_SECRET', 'PADDLE_PRICE_MONTHLY', 'PADDLE_PRICE_YEARLY',
    'PADDLE_PRICE_MONTHLY_TRIAL', 'PADDLE_PRICE_YEARLY_TRIAL']
  if (!keys.every(key => env[key])) return null
  const environment = env.PADDLE_ENV === 'production' ? 'production' : 'sandbox'
  return {
    environment,
    apiUrl: API[environment],
    apiKey: env.PADDLE_API_KEY,
    clientToken: env.PADDLE_CLIENT_TOKEN,
    webhookSecret: env.PADDLE_WEBHOOK_SECRET,
    prices: { monthly: env.PADDLE_PRICE_MONTHLY, yearly: env.PADDLE_PRICE_YEARLY },
    trialPrices: { monthly: env.PADDLE_PRICE_MONTHLY_TRIAL, yearly: env.PADDLE_PRICE_YEARLY_TRIAL },
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
 * expiresAt : fin de la période payée (ou prochain prélèvement s'il est plus tard, prélèvement repoussé par le
 * parrainage) + GRACE tant que l'abonnement est actif, sinon l'instant de l'événement.
 */
export function subscriptionAccess(subscription, occurredAt) {
  const periodEnd = Math.max(Date.parse(subscription.current_billing_period?.ends_at) || 0, Date.parse(subscription.next_billed_at) || 0)
  const active = ACTIVE.has(subscription.status) && periodEnd > 0
  const scheduledCancel = subscription.scheduled_change?.action === 'cancel' ? subscription.scheduled_change.effective_at : null
  return {
    status: subscription.status,
    expiresAt: active ? periodEnd + GRACE : occurredAt,
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

/** Mois offert par le parrainage : prochain prélèvement repoussé d'un mois, sans facturer la différence. */
export async function extendBilling(config, subscriptionId) {
  const url = `${config.apiUrl}/subscriptions/${encodeURIComponent(subscriptionId)}`
  const headers = { authorization: `Bearer ${config.apiKey}`, 'content-type': 'application/json' }
  const current = await fetch(url, { headers })
  if (!current.ok) throw new Error(`Paddle subscription : ${current.status} ${await current.text()}`)
  const { data } = await current.json()
  if (!data.next_billed_at) throw new Error(`Paddle subscription ${subscriptionId} sans prochain prélèvement`)
  const next = new Date(data.next_billed_at)
  const day = next.getUTCDate()
  next.setUTCDate(1)
  next.setUTCMonth(next.getUTCMonth() + 1)
  // 31 janvier + 1 mois : dernier jour de février, pas le 3 mars.
  next.setUTCDate(Math.min(day, new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate()))
  const response = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ next_billed_at: next.toISOString(), proration_billing_mode: 'do_not_bill' }),
  })
  if (!response.ok) throw new Error(`Paddle next_billed_at : ${response.status} ${await response.text()}`)
}
