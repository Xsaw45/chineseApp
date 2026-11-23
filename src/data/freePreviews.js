import { CLIENT_CONTENT } from 'virtual:yidiano-content'
import { getWordById } from './index.js'

export const FREE_NEXT_EXCERPTS = CLIENT_CONTENT.excerpts

const wordIds = (level, numbers) => numbers.map(n => `hsk${level}_${String(n).padStart(4, '0')}`)

// Petites listes éditoriales : vocabulaire des répliques ou d'un même thème, jamais un niveau entier.
const PACKS = {
  1: {
    readingIds: ['jieshao', 'fanguan'], next: 'wenlu',
    ids: wordIds(1, [384, 176, 275, 331, 249, 340, 254, 130, 309, 483, 22, 423, 230, 211, 424]),
  },
  2: {
    readingIds: ['mai-yifu'], next: 'kanbing',
    ids: [...wordIds(2, [250, 27, 686, 216, 6, 626, 609, 210]), ...wordIds(1, [441, 97, 298, 205, 129, 142, 427])],
  },
  3: {
    readingIds: ['jiudian'], next: 'shanghai',
    ids: [...wordIds(3, [33, 782, 131]), ...wordIds(2, [4, 52, 308, 220]), ...wordIds(1, [303, 278, 491, 103, 325, 464]), ...wordIds(4, [497, 881])],
  },
  4: {
    readingIds: ['mianshi'], next: 'zufang',
    ids: [...wordIds(4, [36, 253, 501, 474, 365]), ...wordIds(3, [373, 375, 238, 202, 445]), ...wordIds(2, [185, 465, 648, 344, 730])],
  },
  5: {
    title: { fr: 'Voyager et se déplacer', en: 'Travelling and getting around' },
    ids: wordIds(5, [49, 106, 108, 109, 120, 151, 372, 392, 444, 839, 877, 934, 98, 105, 756]),
  },
  6: {
    title: { fr: 'Préparer un itinéraire', en: 'Planning an itinerary' },
    ids: wordIds(6, [4, 136, 205, 333, 354, 456, 664, 769, 789, 808, 862, 890, 971, 972, 984]),
  },
  7: {
    title: { fr: 'Argumenter et nuancer', en: 'Making a nuanced argument' },
    ids: wordIds(7, [196, 2729, 3370, 5304, 4107, 3083, 973, 2374, 1625, 3607, 2121, 1381, 4161, 2560, 887]),
  },
}

export const SAMPLE_LEVELS = Object.keys(PACKS).map(Number)
export const sampleLevel = level => Math.max(1, Math.min(7, level))
export const sampleLabel = level => level === 7 ? 'HSK 7–9' : `HSK ${level}`
export const sampleKey = level => `sample_${level}`
export const sampleDoneKey = level => `sample_done_${level}`

const wordsByLevel = new Map()
export function sampleForLevel(level) {
  const pack = PACKS[level]
  if (!wordsByLevel.has(level)) wordsByLevel.set(level, pack.ids.map(getWordById))
  return { ...pack, words: wordsByLevel.get(level) }
}

/** Les sélections commencées restent révisables si on change ensuite de niveau ou de formule. */
export function startedSampleWords(progressMap) {
  const words = new Map()
  for (const level of SAMPLE_LEVELS) {
    if (!progressMap?.has(sampleKey(level))) continue
    for (const word of sampleForLevel(level).words) words.set(word.id, word)
  }
  return words
}
