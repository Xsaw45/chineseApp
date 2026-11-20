import { GRACE } from './paddle.js'

export const ROLES = ['admin', 'beta', 'user']
// Statuts Paddle dont la fin de période est le prochain prélèvement (sans résiliation programmée).
const RENEWING = new Set(['active', 'trialing'])

export function accessFor(account, now = Date.now()) {
  const roleAccess = account.role === 'admin' || account.role === 'beta'
  // Abonnement Paddle, essai compris (statut « trialing ») : plus_expires_at, posé par le webhook (server/app.js).
  const subscriptionAccess = account.plus_expires_at !== null && account.plus_expires_at > now
  const plus = roleAccess || subscriptionAccess

  return {
    plus,
    plan: plus ? 'plus' : 'free',
    source: roleAccess ? account.role : subscriptionAccess ? 'subscription' : 'free',
    // Essai Paddle (prix avec trial_period) : une fois par compte, jamais après un premier abonnement.
    trialAvailable: account.paddle_subscription_id === null,
    plusExpiresAt: account.plus_expires_at,
    // Abonnement Paddle (server/paddle.js) ; cancelAt : résiliation programmée en fin de période ; renewsAt :
    // prochain prélèvement (fin de l'essai ou de la période payée, sans la marge GRACE ajoutée à plusExpiresAt).
    subscription: account.paddle_subscription_id
      ? {
        status: account.paddle_status,
        cancelAt: account.paddle_cancel_at,
        renewsAt: RENEWING.has(account.paddle_status) && !account.paddle_cancel_at && account.plus_expires_at
          ? account.plus_expires_at - GRACE
          : null,
      }
      : null,
  }
}

export function accountUser(account, now = Date.now()) {
  return {
    login: account.email,
    name: account.email,
    method: 'email',
    role: account.role,
    access: accessFor(account, now),
  }
}
