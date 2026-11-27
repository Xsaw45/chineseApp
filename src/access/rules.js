import { charsForLevel } from '../data/hanzi.js'
import { BEGINNER_SESSIONS } from '../data/beginnerPath.js'
import { FREE_PATH_CHARS } from '../data/path.js'

const FREE_HANZI_COUNT = 10
export const FREE_HANZI = new Set([
  ...charsForLevel(1).slice(0, FREE_HANZI_COUNT).map(ch => ch.c),
  ...BEGINNER_SESSIONS.flatMap(session => [...session.chars]),
  ...FREE_PATH_CHARS,
])
const PLUS_MODULES = new Set(['classifiers', 'radicals'])

// Grammaire et lectures : plus = élément Yidiano+ ; locked = son contenu n'est pas sur l'appareil (src/content/plus.js).
const canUseContent = (item, hasPlus) => !item.locked && (hasPlus || !item.plus)

export const canOpenModule = (module, hasPlus) => hasPlus || !PLUS_MODULES.has(module)
export const canUseVocabLevel = (level, hasPlus) => hasPlus || level === 1
export const canUseHanziLevel = (level, hasPlus) => hasPlus || level === 1
export const canUseHanzi = (ch, hasPlus) => hasPlus || FREE_HANZI.has(ch.c)
export const canUseGrammarPoint = canUseContent
export const canUseReading = canUseContent
