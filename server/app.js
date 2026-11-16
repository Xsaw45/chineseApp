import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import { openDb } from './db.js'
import { authRoutes, sessionUser } from './auth.js'

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
 * Connexion par e-mail (server/auth.js). publicUrl : adresse publique (liens des e-mails) ; allowedEmails : Set des
 * adresses invitees, null = toutes.
 */
export function buildApp({ dbPath, publicDir, publicUrl, mailer, allowedEmails = null, logger = true }) {
  const app = Fastify({ logger, bodyLimit: 20 * 1024 * 1024 })
  const db = openDb(dbPath)
  app.addHook('onClose', async () => db.close())

  // Requetes journalisees seulement en cas d'erreur (sync toutes les minutes par appareil, healthcheck)
  const quiet = { logLevel: 'warn' }

  app.get('/healthz', quiet, async () => ({ ok: true }))

  app.register(authRoutes({ db, mailer, publicUrl, allowedEmails }), { prefix: '/api/auth' })

  app.register(async (api) => {
    api.addHook('onRequest', async (request, reply) => {
      request.user = sessionUser(request, db)
      if (request.user) return
      // login : page de connexion vers laquelle le client redirige (src/db/sync.js)
      return reply.code(401).send({ error: 'connexion requise', login: '/login/' })
    })

    api.get('/me', async (request) => request.user)

    api.post('/sync/:app', { schema: syncSchema }, async (request, reply) => {
      const { login } = request.user
      const { user, since, changes } = request.body
      // Donnees locales d'un autre utilisateur (appareil reconnecte sous un autre compte) :
      // rien n'est ecrit, l'appareil efface ses donnees locales puis resynchronise.
      if (user && user !== login) return reply.code(409).send({ user: login })
      return { user: login, ...db.sync(login, request.params.app, since, changes) }
    })
  }, { prefix: '/api', ...quiet })

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
