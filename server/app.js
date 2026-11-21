import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import { openDb } from './db.js'
import { authRoutes, expiredSessionCookie, normalizeEmail, sessionUser } from './auth.js'
import { accountUser, ROLES } from './access.js'
import { cancelSubscription, portalUrl, REFERRAL_TRIAL_DAYS, subscriptionAccess, TRIAL_DAYS, verifySignature } from './paddle.js'
import { isReferee, MAX_MONTHS_PER_YEAR, newReferralCode, REF_CODE, REF_COOKIE, REF_TTL, rewardReferrer } from './referral.js'
import { splitContent } from '../content/split.js'

const APPS = ['zh']

const syncSchema = {
  params: {
    type: 'object',
    required: ['app'],
    properties: { app: { type: 'string', enum: APPS } },
  },
  body: {
    type: 'object',
    required: ['since', 'changes'],
    additionalProperties: false,
    properties: {
      // utilisateur auquel appartiennent les donnees locales de l'appareil (null = premier passage)
      user: { type: ['string', 'null'] },
      since: { type: 'integer', minimum: 0 },
      changes: {
        type: 'array',
        maxItems: 5000,
        items: {
          type: 'object',
          required: ['key', 'value', 'updatedAt'],
          additionalProperties: false,
          properties: {
            key: { type: 'string', minLength: 1, maxLength: 200 },
            value: {},
            updatedAt: { type: 'integer', minimum: 0 },
          },
        },
      },
    },
  },
}

// Seuls les fichiers de build Vite (/assets/) ont un nom hashe ; le reste est revalide (ETag) a chaque fois.
const HASHED = '/assets/'

/**
 * Connexion par e-mail et avec Google (server/auth.js). publicUrl : adresse publique (liens des e-mails, retour de
 * Google) ; allowedEmails : Set des adresses invitees, null = toutes ; google : googleConfig (server/google.js), null =
 * pas de connexion Google ; paddle : configuration de paiement (paddleConfig, server/paddle.js), null = pas
 * d'abonnement en vente.
 */
export function buildApp({ dbPath, publicDir, publicUrl, mailer, allowedEmails = null, google = null, paddle = null, logger = true }) {
  // Caddy arrive par le réseau local (passerelle Docker) : request.ip = la dernière adresse non locale de
  // X-Forwarded-For, celle ajoutée par Caddy, pas celle qu'un client peut écrire en tête. Sert à la limite d'envois
  // par IP (server/auth.js).
  const app = Fastify({ logger, bodyLimit: 20 * 1024 * 1024, trustProxy: 'loopback, uniquelocal' })
  const db = openDb(dbPath)
  // Grammaire et lectures Yidiano+ : hors du code de l'app, servies ici aux seuls comptes qui y ont droit.
  const content = splitContent()
  app.addHook('onClose', async () => db.close())

  // Requetes journalisees seulement en cas d'erreur (sync toutes les minutes par appareil, healthcheck)
  const quiet = { logLevel: 'warn' }

  app.get('/healthz', quiet, async () => ({ ok: true }))
  app.register(authRoutes({ db, mailer, publicUrl, allowedEmails, google }), { prefix: '/api/auth' })

  // Webhook Paddle : sans session, authentifié par la signature du corps brut (d'où le corps gardé en texte).
  if (paddle) app.register(async (hooks) => {
    hooks.addContentTypeParser('application/json', { parseAs: 'string' }, (request, body, done) => done(null, body))
    hooks.post('/webhook', async (request, reply) => {
      if (!verifySignature(request.body, request.headers['paddle-signature'], paddle.webhookSecret)) {
        return reply.code(401).send({ error: 'bad_signature' })
      }
      const event = JSON.parse(request.body)
      if (!event.event_type?.startsWith('subscription.')) return { ok: true }
      const subscription = event.data
      const eventAt = Date.parse(event.occurred_at)
      // custom_data.email : l'adresse du compte, passée par l'app à l'ouverture du paiement (src/components/PlusPage.jsx).
      // Un compte n'est créé que pour un abonnement en cours (essai compris), jamais par l'annonce de fin d'un compte
      // supprimé.
      const email = subscription.custom_data?.email && normalizeEmail(subscription.custom_data.email)
      const current = subscription.status === 'active' || subscription.status === 'trialing'
      const account = db.accounts.byPaddleCustomer(subscription.customer_id)
        || (email && (db.accounts.get(email) || (current ? db.accounts.ensure(email) : null)))
      if (!account) {
        request.log.warn({ subscription: subscription.id }, 'abonnement Paddle sans compte Yidiano')
        return { ok: true }
      }
      // custom_data vient du navigateur : un autre abonnement ne remplace pas celui, encore actif, du compte.
      if (account.paddle_subscription_id && account.paddle_subscription_id !== subscription.id
        && account.plus_expires_at > Date.now() && account.paddle_status !== 'canceled') {
        request.log.warn({ subscription: subscription.id, email: account.email }, 'second abonnement Paddle ignoré')
        return { ok: true }
      }
      db.accounts.applySubscription(account.email, {
        customerId: subscription.customer_id,
        subscriptionId: subscription.id,
        eventAt,
        ...subscriptionAccess(subscription, eventAt),
      })
      // Filleul qui vient d'enregistrer sa carte (essai ou abonnement) : son parrain gagne un mois (server/referral.js).
      if (subscription.status === 'trialing' || subscription.status === 'active') {
        try {
          await rewardReferrer(db, paddle, account.email, request.log)
        } catch (err) {
          request.log.error({ err, email: account.email }, 'parrainage : récompense non appliquée')
        }
      }
      return { ok: true }
    })
  }, { prefix: '/api/paddle' })

  app.register(async (api) => {
    api.addHook('onRequest', async (request, reply) => {
      request.user = sessionUser(request, db)
      if (request.user) return
      // login : page de connexion vers laquelle le client redirige (src/db/sync.js)
      return reply.code(401).send({ error: 'connexion requise', login: '/login/' })
    })

    api.get('/me', async (request) => request.user)

    // Parrainage : lien personnel et compteurs (invités, cartes enregistrées, mois gagnés dont ceux de l'année).
    api.get('/referral', async (request) => {
      const code = db.accounts.referralCode(request.user.login, newReferralCode)
      const stats = db.referrals.stats(request.user.login, Date.now() - 365 * 24 * 3600_000)
      return { link: `${publicUrl}/?ref=${code}`, ...stats, maxMonthsPerYear: MAX_MONTHS_PER_YEAR }
    })

    api.get('/content', async (request, reply) => {
      if (!request.user.access.plus) return reply.code(403).send({ error: 'plus_required' })
      reply.header('cache-control', 'private, no-store')
      return { version: content.version, ...content.plus }
    })

    // Suppression du compte (RGPD) : email = l'adresse retapée pour confirmer. Un abonnement en cours est résilié
    // d'abord chez Paddle ; s'il ne peut pas l'être, rien n'est supprimé.
    api.delete('/account', {
      schema: {
        body: {
          type: 'object', required: ['email'], additionalProperties: false,
          properties: { email: { type: 'string', maxLength: 254 } },
        },
      },
    }, async (request, reply) => {
      const email = request.user.login
      if (normalizeEmail(request.body.email) !== email) return reply.code(400).send({ error: 'email_mismatch' })
      const account = db.accounts.get(email)
      if (account?.paddle_subscription_id && account.paddle_status !== 'canceled') {
        if (!paddle) return reply.code(503).send({ error: 'subscription_cancel_unavailable' })
        await cancelSubscription(paddle, account.paddle_subscription_id)
      }
      db.accounts.delete(email)
      request.log.info('compte supprimé')
      return reply.header('set-cookie', expiredSessionCookie(publicUrl)).send({ ok: true })
    })

    // Paiement : de quoi ouvrir Paddle.js (jeton client, environnement, prix), puis l'espace client Paddle.
    // prices : prix affichés ; trial : prix avec essai à ouvrir au paiement, pour un compte qui n'a jamais été abonné
    // (filleul : essai doublé, referral: true).
    api.get('/paddle/config', async (request, reply) => {
      if (!paddle) return reply.code(404).send({ error: 'paddle_disabled' })
      let trial = null
      if (request.user.access.trialAvailable) {
        trial = isReferee(db, request.user.login)
          ? { days: REFERRAL_TRIAL_DAYS, prices: paddle.referralTrialPrices, referral: true }
          : { days: TRIAL_DAYS, prices: paddle.trialPrices, referral: false }
      }
      return { environment: paddle.environment, clientToken: paddle.clientToken, prices: paddle.prices, trial }
    })
    api.post('/paddle/portal', async (request, reply) => {
      const account = db.accounts.get(request.user.login)
      if (!paddle || !account?.paddle_customer_id) return reply.code(404).send({ error: 'no_subscription' })
      return { url: await portalUrl(paddle, account.paddle_customer_id, account.paddle_subscription_id) }
    })

    // Comptes et usage (stats : null si rien n'a jamais été synchronisé). Jours en heure de Paris, comme l'app.
    api.get('/admin/accounts', async (request, reply) => {
      if (request.user.role !== 'admin') return reply.code(403).send({ error: 'admin_required' })
      const now = Date.now()
      const weekStart = new Date(now - 6 * 24 * 3600_000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' })
      const usage = db.accounts.usage(weekStart)
      return db.accounts.list().map(account => ({
        ...accountUser(account, now),
        createdAt: account.created_at,
        stats: usage.get(account.email) || null,
      }))
    })

    api.patch('/admin/accounts/:email', {
      schema: {
        params: {
          type: 'object',
          required: ['email'],
          properties: { email: { type: 'string', minLength: 3, maxLength: 254 } },
        },
        body: {
          type: 'object',
          minProperties: 1,
          additionalProperties: false,
          properties: {
            role: { type: 'string', enum: ROLES },
            plusExpiresAt: { type: ['integer', 'null'], minimum: 0 },
          },
        },
      },
    }, async (request, reply) => {
      if (request.user.role !== 'admin') return reply.code(403).send({ error: 'admin_required' })
      const email = normalizeEmail(request.params.email)
      if (email === request.user.login && request.body.role && request.body.role !== 'admin') {
        return reply.code(400).send({ error: 'cannot_demote_self' })
      }
      let account = db.accounts.ensure(email)
      if (request.body.role) account = db.accounts.setRole(email, request.body.role)
      if (Object.hasOwn(request.body, 'plusExpiresAt')) {
        account = db.accounts.setPlusExpiresAt(email, request.body.plusExpiresAt)
      }
      return accountUser(account)
    })

    api.post('/sync/:app', { schema: syncSchema }, async (request, reply) => {
      const { login } = request.user
      const { user, since, changes } = request.body
      // Donnees locales d'un autre utilisateur (appareil reconnecte sous un autre compte) :
      // rien n'est ecrit, l'appareil efface ses donnees locales puis resynchronise.
      if (user && user !== login) return reply.code(409).send({ user: login })
      return { user: login, ...db.sync(login, request.params.app, since, changes) }
    })
  }, { prefix: '/api', ...quiet })

  // Même adresse, deux pages : l'app pour une session ouverte (et l'app installée, dont start_url est /), la page
  // de présentation (landing.html) pour les visiteurs et les moteurs de recherche. ?ref=CODE : lien de parrainage,
  // gardé dans un cookie jusqu'à la création du compte (server/referral.js).
  app.get('/', quiet, (request, reply) => {
    const ref = request.query.ref
    if (typeof ref === 'string' && REF_CODE.test(ref)) {
      reply.header('set-cookie', [`${REF_COOKIE}=${ref}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${REF_TTL}`,
        ...(publicUrl.startsWith('https:') ? ['Secure'] : [])].join('; '))
    }
    return reply
      .header('cache-control', 'no-cache')
      .header('vary', 'Cookie')
      .sendFile(sessionUser(request, db) ? 'index.html' : 'landing.html')
  })

  app.register(fastifyStatic, {
    ...quiet,
    root: publicDir,
    redirect: true,
    cacheControl: false,
    setHeaders(res, filePath) {
      const hashed = filePath.replaceAll('\\', '/').includes(HASHED)
      res.setHeader('Cache-Control', hashed ? 'public, max-age=31536000, immutable' : 'no-cache')
    },
  })

  return app
}
