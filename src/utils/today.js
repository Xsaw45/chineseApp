import { PINYIN_LESSONS } from '../data/pinyinLessons.js'
import { GRAMMAR_POINTS } from '../data/grammar.js'
import { READINGS } from '../data/reading.js'
import { getChar } from '../data/hanzi.js'
import { canUseClassifier, canUseGrammarPoint, canUseReading, FREE_RADICAL_NUMBERS } from '../access/rules.js'
import { getLessonProgress } from './pinyinQuiz.js'
import { getPointProgress } from './grammarQuiz.js'
import { getReadingProgress } from './readingQuiz.js'
import { isDueForReview } from './spacedrep.js'
import { doneToday } from './activity.js'

// Séance « Aujourd'hui » : les révisions arrivées à échéance dans chaque module, dans l'ordre d'apprentissage, et
// toujours le vocabulaire (révisions puis mots nouveaux). Chaque étape lance le test habituel de son module.

const STEPS = ['pinyin', 'vocab', 'hanzi', 'radicals', 'grammar', 'reading', 'classifiers']

// Modules à éléments (un enregistrement par mot, caractère…) : reconnus au préfixe de l'enregistrement.
const PREFIXES = { vocab: 'hsk', hanzi: 'hz_', radicals: 'rad_', classifiers: 'cl_' }
const freeRecord = (module, key) => {
  if (module === 'vocab') return key.startsWith('hsk1_')
  if (module === 'hanzi') return getChar(key.slice(3))?.level === 1
  if (module === 'radicals') return FREE_RADICAL_NUMBERS.has(Number(key.slice(4)))
  if (module === 'classifiers') return canUseClassifier({ char: key.slice(3) }, false)
  return true
}


/** Leçons, points ou textes à revoir aujourd'hui, dans l'ordre du module. */
export const dueLessons = progressMap => PINYIN_LESSONS.filter(x => isDueForReview(getLessonProgress(progressMap, x)))
export const duePoints = (progressMap, hasPlus = true) => GRAMMAR_POINTS
  .filter(point => canUseGrammarPoint(point, hasPlus) && isDueForReview(getPointProgress(progressMap, point)))
export const dueReadings = (progressMap, hasPlus = true) => READINGS
  .filter(reading => canUseReading(reading, hasPlus) && isDueForReview(getReadingProgress(progressMap, reading)))

/**
 * Étapes du jour : [{ id, due, done }]. due : éléments à réviser ; done : étape finie aujourd'hui et plus rien à
 * réviser. Une étape apparaît s'il y a des révisions ou si elle a été faite aujourd'hui ; le vocabulaire apparaît
 * toujours (mots nouveaux), les caractères dès qu'on a commencé à en écrire.
 */
export function todayPlan(progressMap, hasPlus = true) {
  const due = {
    pinyin: dueLessons(progressMap).length,
    grammar: duePoints(progressMap, hasPlus).length,
    reading: dueReadings(progressMap, hasPlus).length,
  }
  const started = new Set()
  for (const [key, progress] of progressMap || []) {
    const module = Object.keys(PREFIXES).find(m => key.startsWith(PREFIXES[m]))
    if (!module || (!hasPlus && !freeRecord(module, key))) continue
    started.add(module)
    if (isDueForReview(progress)) due[module] = (due[module] || 0) + 1
  }
  const done = doneToday(progressMap)
  return STEPS
    .filter(id => due[id] > 0 || done.has(id) || id === 'vocab' || (id === 'hanzi' && started.has('hanzi')))
    .map(id => ({ id, due: due[id] || 0, done: done.has(id) && !due[id] }))
}
