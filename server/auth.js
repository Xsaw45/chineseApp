import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { accountUser } from './access.js'
import { googleIdentity, googleStart } from './google.js'

// Connexion par e-mail : l'utilisateur recoit un lien et un code a 6 chiffres (le code sert quand le lien s'ouvre
// ailleurs que dans l'app installee, ex. iPhone). L'identite est l'adresse e-mail, en minuscules (meme identifiant
// que l'ancien acces Tailscale pour un compte Google, d'ou la reprise de progression).

export const SESSION_COOKIE = 'langues_session'
const LOGIN_TTL = 15 * 60_000
const SESSION_TTL = 365 * 24 * 3600_000
const RESEND_DELAY = 60_000 // entre deux e-mails a la meme adresse
const MAX_SENDS_PER_HOUR = 5
const MAX_CODE_ATTEMPTS = 5
// Par adresse IP (inscriptions ouvertes) : sans cette limite, un robot ferait envoyer des e-mails de connexion à des
// milliers d'adresses (quota Brevo, réputation de yidiano.com). Large pour un foyer ou une classe derrière une box.
const HOUR = 3600_000
const DAY = 24 * HOUR
const MAX_IP_SENDS_PER_HOUR = 10
const MAX_IP_SENDS_PER_DAY = 30
const IP_SWEEP_SIZE = 10_000
const OAUTH_COOKIE = 'yidiano_oauth'
const OAUTH_TTL = 600 // s : temps laissé pour choisir son compte Google

const hash = (value) => createHash('sha256').update(value).digest('hex')
const codeHash = (email, code) => hash(`${email}:${code}`)
const sameHash = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))

export const normalizeEmail = (email) => email.trim().toLowerCase()

/** Chemin interne ou revenir apres connexion (jamais un autre site). */
export const safeNext = (next) => (typeof next === 'string' && /^\/(?![/\\])[\w\-./]*$/.test(next) ? next : '/')

function readCookie(request, name) {
  for (const part of (request.headers.cookie || '').split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

/** Utilisateur et droits de la session (cookie), ou null. */
export function sessionUser(request, db) {
  const token = readCookie(request, SESSION_COOKIE)
  if (!token) return null
  const now = Date.now()
  const email = db.auth.sessionEmail(hash(token), now)
  return email ? accountUser(db.accounts.ensure(email, now), now) : null
}

/** Cookie qui efface la session dans le navigateur (déconnexion, suppression du compte). */
export const expiredSessionCookie = (publicUrl) =>
  `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${publicUrl.startsWith('https:') ? '; Secure' : ''}`

const emailSchema = { type: 'string', minLength: 3, maxLength: 254, pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' }

/**
 * Routes /api/auth/* : demande de connexion, verification (lien ou code), connexion avec Google, deconnexion.
 * google : googleConfig (server/google.js), null = connexion Google non proposée.
 */
export function authRoutes({ db, mailer, publicUrl, allowedEmails, google = null }) {
  const secure = publicUrl.startsWith('https:')
  const googleRedirect = `${publicUrl}/api/auth/google/callback`
  /** Cookie de la connexion Google en cours, limité aux routes /api/auth ; maxAge 0 l'efface. */
  const oauthCookie = (value, maxAge) => [
    `${OAUTH_COOKIE}=${value}`, 'Path=/api/auth', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAge}`, ...(secure ? ['Secure'] : []),
  ].join('; ')
  // Envois récents par adresse IP, en mémoire (remis à zéro au redémarrage, ce qui suffit contre un robot).
  const ipSends = new Map()

  /** Attente en ms avant qu'un e-mail puisse partir pour cette IP (0 = tout de suite) ; garde ses envois du jour. */
  function ipWait(ip, now) {
    if (ipSends.size > IP_SWEEP_SIZE) {
      for (const [key, sends] of ipSends) if (now - sends.at(-1) >= DAY) ipSends.delete(key)
    }
    const today = (ipSends.get(ip) || []).filter(at => now - at < DAY)
    if (today.length) ipSends.set(ip, today)
    else ipSends.delete(ip)
    const lastHour = today.filter(at => now - at < HOUR)
    if (lastHour.length >= MAX_IP_SENDS_PER_HOUR) return lastHour[0] + HOUR - now
    if (today.length >= MAX_IP_SENDS_PER_DAY) return today[0] + DAY - now
    return 0
  }

  function openSession(reply, email) {
    const token = randomBytes(32).toString('base64url')
    const now = Date.now()
    db.auth.spendLoginRequest(email)
    db.auth.createSession(hash(token), email, now + SESSION_TTL, now)
    db.accounts.ensure(email, now)
    reply.header('set-cookie', [
      `${SESSION_COOKIE}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${SESSION_TTL / 1000}`,
      ...(secure ? ['Secure'] : []),
    ].join('; '))
    return { ok: true }
  }

  return async (api) => {
    api.post('/request', {
      schema: {
        body: {
          type: 'object',
          required: ['email'],
          additionalProperties: false,
          properties: { email: emailSchema, lang: { type: 'string', enum: ['fr', 'en'] }, next: { type: 'string', maxLength: 200 } },
        },
      },
    }, async (request, reply) => {
      const email = normalizeEmail(request.body.email)
      if (allowedEmails && !allowedEmails.has(email)) return reply.code(403).send({ error: 'not_invited' })

      const now = Date.now()
      const previous = db.auth.loginRequest(email)
      if (previous && now - previous.sent_at < RESEND_DELAY) {
        return reply.code(429).send({ error: 'too_soon', retryAfter: Math.ceil((previous.sent_at + RESEND_DELAY - now) / 1000) })
      }
      const sameHour = previous && now - previous.window_start < 3600_000
      const sentCount = sameHour ? previous.sent_count + 1 : 1
      if (sentCount > MAX_SENDS_PER_HOUR) return reply.code(429).send({ error: 'too_many' })
      const wait = ipWait(request.ip, now)
      if (wait) return reply.code(429).send({ error: 'too_many_ip', retryAfter: Math.ceil(wait / 1000) })
      ipSends.set(request.ip, [...(ipSends.get(request.ip) || []), now])

      const token = randomBytes(32).toString('base64url')
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
      db.auth.saveLoginRequest({
        email,
        tokenHash: hash(token),
        codeHash: codeHash(email, code),
        expiresAt: now + LOGIN_TTL,
        sentAt: now,
        windowStart: sameHour ? previous.window_start : now,
        sentCount,
      })
      const next = safeNext(request.body.next)
      const link = `${publicUrl}/login/?token=${token}&next=${encodeURIComponent(next)}`
      await mailer.sendLogin({ to: email, link, code, lang: request.body.lang || 'fr' })
      return reply.code(202).send({ ok: true })
    })

    // Lien (token) ou code (email + code). Pas de oneOf : Fastify retire les proprietes inconnues pendant la
    // validation, ce qui viderait la seconde branche.
    api.post('/verify', {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            token: { type: 'string', minLength: 20, maxLength: 100 },
            email: emailSchema,
            code: { type: 'string', pattern: '^[0-9]{6}$' },
          },
        },
      },
    }, async (request, reply) => {
      const now = Date.now()
      const { token, email: rawEmail, code } = request.body
      if (token) {
        const pending = db.auth.loginByToken(hash(token))
        if (!pending || pending.expires_at <= now) return reply.code(400).send({ error: 'invalid_link' })
        return openSession(reply, pending.email)
      }
      if (!rawEmail || !code) return reply.code(400).send({ error: 'missing_code' })
      const email = normalizeEmail(rawEmail)
      const pending = db.auth.loginRequest(email)
      if (!pending || pending.expires_at <= now || pending.attempts >= MAX_CODE_ATTEMPTS) {
        return reply.code(400).send({ error: 'expired_code' })
      }
      if (!sameHash(pending.code_hash, codeHash(email, code))) {
        db.auth.countAttempt(email)
        return reply.code(400).send({ error: 'wrong_code', attemptsLeft: MAX_CODE_ATTEMPTS - pending.attempts - 1 })
      }
      return openSession(reply, email)
    })

    /** Moyens de connexion proposés par la page de connexion, en plus de l'e-mail. */
    api.get('/providers', async () => ({ google: Boolean(google) }))

    // Connexion avec Google : l'état, le vérificateur PKCE et le nonce restent dans un cookie de l'appareil (10 min)
    // jusqu'au retour de Google, qui doit présenter le même état.
    api.get('/google/start', {
      schema: { querystring: { type: 'object', properties: { next: { type: 'string', maxLength: 200 } } } },
    }, async (request, reply) => {
      if (!google) return reply.code(404).send({ error: 'google_disabled' })
      const { url, pending } = googleStart(google, googleRedirect)
      const value = Buffer.from(JSON.stringify({ ...pending, next: safeNext(request.query.next) })).toString('base64url')
      reply.header('set-cookie', oauthCookie(value, OAUTH_TTL))
      return reply.redirect(url)
    })

    api.get('/google/callback', {
      schema: {
        querystring: {
          type: 'object',
          properties: { code: { type: 'string', maxLength: 2000 }, state: { type: 'string', maxLength: 200 }, error: { type: 'string', maxLength: 200 } },
        },
      },
    }, async (request, reply) => {
      if (!google) return reply.code(404).send({ error: 'google_disabled' })
      reply.header('set-cookie', oauthCookie('', 0))
      const fail = (error) => reply.redirect(`/login/?error=${error}`)
      const { code, state, error } = request.query
      if (error) return fail('oauth_cancelled')
      let pending
      try {
        pending = JSON.parse(Buffer.from(readCookie(request, OAUTH_COOKIE) || '', 'base64url').toString('utf8'))
      } catch {
        pending = null
      }
      if (!pending?.state || !code || state !== pending.state) return fail('oauth_failed')
      let claims
      try {
        claims = await googleIdentity(google, googleRedirect, code, pending.verifier)
      } catch (err) {
        request.log.warn({ err }, 'connexion Google refusée')
        return fail('oauth_failed')
      }
      if (claims.nonce !== pending.nonce || !claims.email || claims.email_verified !== true) return fail('oauth_failed')
      const email = normalizeEmail(claims.email)
      if (allowedEmails && !allowedEmails.has(email)) return fail('not_invited')
      openSession(reply, email)
      return reply.redirect(safeNext(pending.next))
    })

    api.post('/logout', async (request, reply) => {
      const token = readCookie(request, SESSION_COOKIE)
      if (token) db.auth.deleteSession(hash(token))
      reply.header('set-cookie', expiredSessionCookie(publicUrl))
      return { ok: true }
    })
  }
}
