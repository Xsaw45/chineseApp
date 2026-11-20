import { buildApp } from './app.js'
import { createMailer } from './mail.js'
import { normalizeEmail } from './auth.js'
import { paddleConfig } from './paddle.js'
import { googleConfig } from './google.js'

const required = (name) => process.env[name] || (console.error(`Variable ${name} manquante`), process.exit(1))

const allowed = (process.env.AUTH_ALLOWED_EMAILS || '').split(',').map(normalizeEmail).filter(Boolean)
if (process.env.NODE_ENV === 'production') ['SMTP_URL', 'MAIL_FROM'].forEach(required)

const app = buildApp({
  dbPath: required('DB_PATH'),
  publicDir: required('PUBLIC_DIR'),
  publicUrl: required('PUBLIC_URL').replace(/\/$/, ''),
  allowedEmails: allowed.length ? new Set(allowed) : null,
  // GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (voir server/google.js) ; sans elles, pas de bouton Google.
  google: googleConfig(process.env),
  // PADDLE_* (voir server/paddle.js) ; sans elles, l'abonnement n'est pas proposé.
  paddle: paddleConfig(process.env),
  mailer: createMailer({
    smtpUrl: process.env.SMTP_URL,
    from: process.env.MAIL_FROM || 'Yidiano <no-reply@localhost>',
    log: console,
  }),
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => app.close().then(() => process.exit(0)))
}

await app.listen({ host: '0.0.0.0', port: Number(process.env.PORT || 8080) })
