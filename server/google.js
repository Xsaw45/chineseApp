import { createHash, randomBytes } from 'node:crypto'

/*
 * Connexion avec Google (OpenID Connect, flux « authorization code » avec PKCE). Client OAuth « Yidiano web » du
 * projet Google Cloud trusty-slate-499318-d2 ; redirection autorisée : <PUBLIC_URL>/api/auth/google/callback.
 * Le compte Yidiano est l'adresse e-mail Google (vérifiée par Google), comme pour la connexion par e-mail.
 */

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com'])

/** GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET ; null sans eux (le bouton Google n'est pas proposé). */
export function googleConfig(env) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return null
  return { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
}

/** Début de connexion : adresse Google et secrets à garder dans le cookie de l'appareil jusqu'au retour. */
export function googleStart(config, redirectUri) {
  const pending = {
    state: randomBytes(24).toString('base64url'),
    verifier: randomBytes(32).toString('base64url'),
    nonce: randomBytes(16).toString('base64url'),
  }
  const url = new URL(AUTHORIZE_URL)
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email',
    state: pending.state,
    nonce: pending.nonce,
    code_challenge: createHash('sha256').update(pending.verifier).digest('base64url'),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  })
  return { url: url.href, pending }
}

/**
 * Retour de Google : échange le code contre le jeton d'identité et renvoie ses informations (email, email_verified,
 * nonce…). Le jeton vient directement du serveur de Google (HTTPS, secret du client), d'où l'absence de vérification
 * de sa signature (OpenID Connect Core 3.1.3.7) ; émetteur, destinataire et expiration sont contrôlés.
 */
export async function googleIdentity(config, redirectUri, code, verifier, now = Date.now()) {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
  })
  if (!response.ok) throw new Error(`Google token : ${response.status} ${await response.text()}`)
  const { id_token: idToken } = await response.json()
  const claims = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString('utf8'))
  if (!ISSUERS.has(claims.iss) || claims.aud !== config.clientId || claims.exp * 1000 <= now) {
    throw new Error('Jeton Google invalide (émetteur, destinataire ou expiration)')
  }
  return claims
}
