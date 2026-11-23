import { PINYIN_LESSONS } from '../data/pinyinLessons.js'
import { GRAMMAR_POINTS } from '../data/grammar.js'
import { READINGS } from '../data/reading.js'
import { canOpenModule, canUseGrammarPoint, canUseReading, FREE_HANZI } from '../access/rules.js'
import { getLessonProgress } from './pinyinQuiz.js'
import { getPointProgress } from './grammarQuiz.js'
import { getReadingProgress } from './readingQuiz.js'
import { isLessonPassed } from './lessonProgress.js'
import { isDueForReview } from './spacedrep.js'
import { doneToday } from './activity.js'

// Séance « Aujourd'hui » : révisions dues parmi les contenus accessibles, puis vocabulaire et premier dialogue.

const STEPS = ['pinyin', 'vocab', 'hanzi', 'radicals', 'grammar', 'reading', 'classifiers']

// Modules à éléments (un enregistrement par mot, caractère…) : reconnus au préfixe de l'enregistrement.
const PREFIXES = { vocab: 'hsk', hanzi: 'hz_', radicals: 'rad_', classifiers: 'cl_' }
const INTRO_READING = READINGS.find(reading => reading.id === 'jieshao')

function canReviewRecord(module, key, hasPlus, accessibleLevels, sampleWords) {
  if (module === 'vocab') return sampleWords.has(key) || accessibleLevels.some(level => key.startsWith(`hsk${level}_`))
  if (module === 'hanzi') return hasPlus || FREE_HANZI.has(key.slice(3))
  return hasPlus
}

/** Leçons, points ou textes à revoir aujourd'hui, dans l'ordre du module. */
export const dueLessons = progressMap => PINYIN_LESSONS.filter(x => isDueForReview(getLessonProgress(progressMap, x)))
const duePoints = (progressMap, hasPlus) => GRAMMAR_POINTS
  .filter(point => canUseGrammarPoint(point, hasPlus) && isDueForReview(getPointProgress(progressMap, point)))
const dueReadings = (progressMap, hasPlus) => READINGS
  .filter(reading => canUseReading(reading, hasPlus) && isDueForReview(getReadingProgress(progressMap, reading)))

/** Étapes à lancer ou déjà faites aujourd'hui ; une lecture nouvelle ne compte pas comme révision due. */
export function todayPlan(progressMap, { hasPlus, accessibleLevels, sampleWords, profile }) {
  const readings = dueReadings(progressMap, hasPlus)
  const intro = !profile && !hasPlus && canUseReading(INTRO_READING, false)
    && !isLessonPassed(getReadingProgress(progressMap, INTRO_READING))
    ? INTRO_READING : null
  const due = {
    pinyin: dueLessons(progressMap).length,
    grammar: duePoints(progressMap, hasPlus).length,
    reading: readings.length,
  }
  const started = new Set()
  for (const [key, progress] of progressMap || []) {
    const module = Object.keys(PREFIXES).find(m => key.startsWith(PREFIXES[m]))
    if (!module || !canReviewRecord(module, key, hasPlus, accessibleLevels, sampleWords)) continue
    started.add(module)
    if (isDueForReview(progress)) due[module] = (due[module] || 0) + 1
  }
  const done = doneToday(progressMap)
  return STEPS
    .filter(id => canOpenModule(id, hasPlus)
      && (due[id] > 0 || done.has(id) || id === 'vocab'
        || (id === 'hanzi' && started.has('hanzi')) || (id === 'reading' && intro)))
    .map(id => {
      const reading = id === 'reading' ? readings[0] ?? intro : null
      return { id, due: due[id] || 0, done: done.has(id) && !due[id] && !reading, reading }
    })
}
