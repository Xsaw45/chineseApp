import { openDb } from './db.js'
import { normalizeEmail } from './auth.js'
import { ROLES } from './access.js'

const [rawEmail, role] = process.argv.slice(2)
const dbPath = process.env.DB_PATH

if (!dbPath || !rawEmail || !ROLES.includes(role)) {
  console.error('Usage: DB_PATH=/chemin/yidiano.db node server/set-role.js adresse@example.com admin|beta|user')
  process.exit(1)
}

const db = openDb(dbPath)
try {
  const account = db.accounts.setRole(normalizeEmail(rawEmail), role)
  console.log(`${account.email}: ${account.role}`)
} finally {
  db.close()
}
