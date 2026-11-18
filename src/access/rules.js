import { CLASSIFIER_GROUPS } from '../data/classifiers.js'
import { QUIZ_RADICALS } from '../utils/hanziQuiz.js'

export const FREE_CLASSIFIER_CHARS = new Set(CLASSIFIER_GROUPS.slice(0, 2).flatMap(group => group.items.map(item => item.char)))
export const FREE_RADICAL_NUMBERS = new Set(QUIZ_RADICALS.slice(0, 20).map(radical => radical.n))

// Grammaire et lectures : plus = élément Yidiano+ ; locked = son contenu n'est pas sur l'appareil (src/content/plus.js).
const canUseContent = (item, hasPlus) => !item.locked && (hasPlus || !item.plus)

export const canUseVocabLevel = (level, hasPlus) => hasPlus || level === 1
export const canUseHanziLevel = (level, hasPlus) => hasPlus || level === 1
export const canUseGrammarPoint = canUseContent
export const canUseReading = canUseContent
export const canUseClassifier = (classifier, hasPlus) => hasPlus || FREE_CLASSIFIER_CHARS.has(classifier.char)
export const canUseClassifierGroup = (index, hasPlus) => hasPlus || index < 2
export const canUseRadical = (radical, hasPlus) => hasPlus || FREE_RADICAL_NUMBERS.has(radical.n)
