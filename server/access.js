export const ROLES = ['admin', 'beta', 'user']
export const TRIAL_DURATION = 7 * 24 * 3600_000

export function accessFor(account, now = Date.now()) {
  const roleAccess = account.role === 'admin' || account.role === 'beta'
  const trialAccess = account.trial_expires_at !== null && account.trial_expires_at > now
  const subscriptionAccess = account.plus_expires_at !== null && account.plus_expires_at > now
  const source = roleAccess ? account.role : trialAccess ? 'trial' : subscriptionAccess ? 'subscription' : 'free'

  return {
    plus: roleAccess || trialAccess || subscriptionAccess,
    plan: roleAccess || trialAccess || subscriptionAccess ? 'plus' : 'free',
    source,
    trialAvailable: account.trial_started_at === null,
    trialStartedAt: account.trial_started_at,
    trialExpiresAt: account.trial_expires_at,
    plusExpiresAt: account.plus_expires_at,
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
