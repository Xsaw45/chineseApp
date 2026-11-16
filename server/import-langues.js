// Reprise unique de la progression chinoise de LanguesApp : DB_PATH=... node server/import-langues.js <langues.db>
// Passe par db.sync(), donc la regle « le plus recent gagne » : relancer l'import ne change rien.
import { DatabaseSync } from 'node:sqlite'
import { openDb } from './db.js'

const source = process.argv[2]
if (!source || !process.env.DB_PATH) {
  console.error('Usage : DB_PATH=<yidiano.db> node server/import-langues.js <langues.db>')
  process.exit(2)
}

const src = new DatabaseSync(source, { readOnly: true })
const rows = src.prepare("SELECT user, key, value, updated_at FROM records WHERE app = 'zh'").all()
src.close()

const byUser = new Map()
for (const { user, key, value, updated_at } of rows) {
  if (!byUser.has(user)) byUser.set(user, [])
  byUser.get(user).push({ key, value: value === null ? null : JSON.parse(value), updatedAt: updated_at })
}

const db = openDb(process.env.DB_PATH)
for (const [user, changes] of byUser) {
  db.sync(user, 'zh', 0, changes)
  console.log(`${user} : ${changes.length} enregistrements`)
}
db.close()
console.log(`Total : ${rows.length} enregistrements, ${byUser.size} utilisateurs`)
