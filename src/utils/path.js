import { PATH } from '../data/path.js'
import { PINYIN_LESSONS } from '../data/pinyinLessons.js'
import { GRAMMAR_POINTS } from '../data/grammar.js'
import { READINGS } from '../data/reading.js'
import { canUseGrammarPoint, canUseReading } from '../access/rules.js'
import { getCharProgress } from './hanziQuiz.js'
import { getPointProgress } from './grammarQuiz.js'
import { getLessonProgress } from './pinyinQuiz.js'
import { getReadingProgress } from './readingQuiz.js'
import { isLessonPassed } from './lessonProgress.js'

// Avancement dans le parcours guidé (data/path.js), d'après la progression enregistrée.

/** Leçon de pinyin, point de grammaire ou texte d'une étape ; null pour des mots ou des caractères. */
export function stepTarget(step) {
  if (step.kind === 'pinyin') return PINYIN_LESSONS.find(lesson => lesson.id === step.lesson)
  if (step.kind === 'grammar') return GRAMMAR_POINTS.find(point => point.id === step.point)
  if (step.kind === 'reading') return READINGS.find(reading => reading.id === step.reading)
  return null
}

/** { done, value, goal } : leçon, point ou texte réussi (0 / 1), ou mots / caractères maîtrisés. */
export function stepProgress(progressMap, step) {
  const counted = (known, goal) => ({ done: known === goal, value: known, goal })
  if (step.kind === 'words') return counted(step.wordIds.filter(id => progressMap?.get(id)?.known).length, step.wordIds.length)
  if (step.kind === 'hanzi') return counted(step.chars.filter(ch => getCharProgress(progressMap, ch).known).length, step.chars.length)
  const target = stepTarget(step)
  if (!target) return counted(0, 1)
  const progress = step.kind === 'pinyin' ? getLessonProgress(progressMap, target)
    : step.kind === 'grammar' ? getPointProgress(progressMap, target)
      : getReadingProgress(progressMap, target)
  return counted(isLessonPassed(progress) ? 1 : 0, 1)
}

/** L'étape s'ouvre-t-elle avec cette formule ? (unité Yidiano+, contenu Yidiano+ pas encore sur l'appareil) */
export function canUseStep(unit, step, hasPlus) {
  if (unit.plus && !hasPlus) return false
  if (['pinyin', 'grammar', 'reading'].includes(step.kind) && !stepTarget(step)) return false
  if (step.kind === 'grammar') return canUseGrammarPoint(stepTarget(step), hasPlus)
  if (step.kind === 'reading') return canUseReading(stepTarget(step), hasPlus)
  return true
}

/**
 * État du parcours : units [{ unit, done, total }] ; current { unit, step, progress, locked } : première étape pas
 * encore faite (null : parcours fini) ; active : il reste une étape ouverte à cette formule (la séance du jour
 * n'apporte alors pas de mots ni de caractères nouveaux hors du parcours).
 */
export function pathState(progressMap, hasPlus) {
  let current = null
  let done = 0
  let total = 0
  const units = PATH.map(unit => {
    let unitDone = 0
    for (const step of unit.steps) {
      const progress = stepProgress(progressMap, step)
      if (progress.done) unitDone++
      else if (!current) current = { unit, step, progress, locked: !canUseStep(unit, step, hasPlus) }
    }
    done += unitDone
    total += unit.steps.length
    return { unit, done: unitDone, total: unit.steps.length }
  })
  return { units, current, done, total, active: Boolean(current && !current.locked) }
}
