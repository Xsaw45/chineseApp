import { createHash } from 'node:crypto'
import { GRAMMAR_POINTS } from './grammar.js'
import { READINGS } from './readings.js'

/*
 * Contenu rédigé, entièrement Yidiano+ (la formule gratuite n'ouvre ni la grammaire ni les lectures, voir
 * src/access/rules.js). Utilisé à la construction de l'app (vite.config.js, module virtual:yidiano-content) et par le
 * serveur (/api/content) ; jamais importé par l'app elle-même.
 *   client : listes dans l'ordre, chaque élément réduit à ce que les listes verrouillées affichent
 *            ({ ...résumé, plus: true, locked: true }).
 *   plus   : éléments complets, servis aux seuls comptes Yidiano+.
 *   version : empreinte du contenu payant ; l'app ne garde en cache qu'un contenu de la même version que son code.
 */

const summaries = {
  grammar: ({ id, level, title }) => ({ id, level, title }),
  readings: ({ id, level, kind, title }) => ({ id, level, kind, title }),
}
const sources = { grammar: GRAMMAR_POINTS, readings: READINGS }

export function splitContent() {
  const client = {}
  const plus = {}
  for (const [name, items] of Object.entries(sources)) {
    client[name] = items.map(item => ({ ...summaries[name](item), plus: true, locked: true }))
    plus[name] = items.map(item => ({ ...item, plus: true }))
  }
  const version = createHash('sha256').update(JSON.stringify(plus)).digest('hex').slice(0, 16)
  return { version, client, plus }
}
