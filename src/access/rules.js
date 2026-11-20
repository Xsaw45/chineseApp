import { charsForLevel } from '../data/hanzi.js'

/*
 * Formule gratuite : pinyin et tons en entier, vocabulaire du HSK 1 (FREE_VOCAB_TESTS_PER_DAY tests par jour) et les
 * FREE_HANZI_COUNT premiers caractères du HSK 1. Les autres modules (PLUS_MODULES) restent visibles avec un cadenas.
 */

export const FREE_VOCAB_TESTS_PER_DAY = 2
const FREE_HANZI_COUNT = 10
export const FREE_HANZI = new Set(charsForLevel(1).slice(0, FREE_HANZI_COUNT).map(ch => ch.c))
const PLUS_MODULES = new Set(['today', 'grammar', 'reading', 'classifiers', 'radicals'])

// Grammaire et lectures : plus = élément Yidiano+ ; locked = son contenu n'est pas sur l'appareil (src/content/plus.js).
const canUseContent = (item, hasPlus) => !item.locked && (hasPlus || !item.plus)

export const canOpenModule = (module, hasPlus) => hasPlus || !PLUS_MODULES.has(module)
export const canUseVocabLevel = (level, hasPlus) => hasPlus || level === 1
export const canUseHanziLevel = (level, hasPlus) => hasPlus || level === 1
export const canUseHanzi = (ch, hasPlus) => hasPlus || FREE_HANZI.has(ch.c)
export const canUseGrammarPoint = canUseContent
export const canUseReading = canUseContent
