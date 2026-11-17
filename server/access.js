export const ROLES = ['admin', 'beta', 'user']
export const TRIAL_DURATION = 7 * 24 * 3600_000

export function accessFor(account, now = Date.now()) {
  const roleAccess = account.role === 'admin' || account.role === 'beta'
  const trialAccess = account.trial_expires_at !== null && account.trial_expires_at > now
  const subscriptionAccess = account.plus_expires_at !== null && account.plus_expires_at > now
  // Un abonnement payé passe avant l'essai : l'écran Yidiano+ affiche alors l'abonnement, pas l'essai restant.
  const source = roleAccess ? account.role : subscriptionAccess ? 'subscription' : trialAccess ? 'trial' : 'free'

  return {
    plus: roleAccess || trialAccess || subscriptionAccess,
    plan: roleAccess || trialAccess || subscriptionAccess ? 'plus' : 'free',
    source,
    trialAvailable: account.trial_started_at === null,
    trialStartedAt: account.trial_started_at,
    trialExpiresAt: account.trial_expires_at,
    plusExpiresAt: account.plus_expires_at,
    // Abonnement Paddle (server/paddle.js) ; cancelAt : résiliation programmée en fin de période.
    subscription: account.paddle_subscription_id
      ? { status: account.paddle_status, cancelAt: account.paddle_cancel_at }
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
