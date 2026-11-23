import { createHash } from 'node:crypto'
import { GRAMMAR_POINTS } from './grammar.js'
import { READINGS } from './readings.js'
import { lineText, lineVoice } from '../src/data/readingLines.js'

/*
 * Utilisé à la construction de l'app (vite.config.js, module virtual:yidiano-content) et par le serveur
 * (/api/content) ; jamais importé par l'app elle-même.
 *   client : éléments gratuits complets et résumés des éléments payants, dans l'ordre du catalogue
 *            (les résumés portent plus: true, locked: true).
 *   plus   : éléments complets, servis aux seuls comptes Yidiano+.
 *   version : empreinte du contenu payant ; l'app ne garde en cache qu'un contenu de la même version que son code.
 */

const summaries = {
  grammar: ({ id, level, title }) => ({ id, level, title }),
  readings: ({ id, level, kind, title }) => ({ id, level, kind, title }),
}
const sources = { grammar: GRAMMAR_POINTS, readings: READINGS }
const freeIds = {
  grammar: new Set(['shi', 'ma', 'you']),
  readings: new Set(['jieshao', 'fanguan', 'mai-yifu', 'jiudian', 'mianshi']),
}
const excerptIds = new Set(['wenlu', 'kanbing', 'shanghai', 'zufang'])

export function splitContent() {
  const client = { excerpts: {} }
  const plus = {}
  for (const [name, items] of Object.entries(sources)) {
    client[name] = []
    plus[name] = []
    for (const item of items) {
      if (freeIds[name].has(item.id)) {
        client[name].push(item)
      } else {
        client[name].push({ ...summaries[name](item), plus: true, locked: true })
        plus[name].push({ ...item, plus: true })
      }
    }
  }
  for (const reading of READINGS) {
    if (!excerptIds.has(reading.id)) continue
    const line = reading.lines[0]
    client.excerpts[reading.id] = {
      zh: lineText(line), pinyin: line.pinyin, tr: line.tr, voice: lineVoice(reading, line), title: reading.title,
    }
  }
  const version = createHash('sha256').update(JSON.stringify(plus)).digest('hex').slice(0, 16)
  return { version, client, plus }
}
