import { CLASSIFIER_GROUPS } from '../data/classifiers.js'
import { QUIZ_RADICALS } from '../utils/hanziQuiz.js'

export const FREE_READING_IDS = new Set(['jieshao', 'fanguan'])
export const FREE_CLASSIFIER_CHARS = new Set(CLASSIFIER_GROUPS.slice(0, 2).flatMap(group => group.items.map(item => item.char)))
export const FREE_RADICAL_NUMBERS = new Set(QUIZ_RADICALS.slice(0, 20).map(radical => radical.n))

export const canUseVocabLevel = (level, hasPlus) => hasPlus || level === 1
export const canUseHanziLevel = (level, hasPlus) => hasPlus || level === 1
export const canUseGrammarPoint = (point, hasPlus) => hasPlus || point.level === 1
export const canUseReading = (reading, hasPlus) => hasPlus || FREE_READING_IDS.has(reading.id)
export const canUseClassifier = (classifier, hasPlus) => hasPlus || FREE_CLASSIFIER_CHARS.has(classifier.char)
export const canUseClassifierGroup = (index, hasPlus) => hasPlus || index < 2
export const canUseRadical = (radical, hasPlus) => hasPlus || FREE_RADICAL_NUMBERS.has(radical.n)
