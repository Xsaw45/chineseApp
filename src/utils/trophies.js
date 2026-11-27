import { PINYIN_LESSONS } from '../data/pinyinLessons.js'
import { bestStreak, totalXp } from './activity.js'
import { getRadicalProgress, QUIZ_RADICALS } from './hanziQuiz.js'
import { getLessonProgress } from './pinyinQuiz.js'
import { isLessonPassed } from './lessonProgress.js'
import { today } from './spacedrep.js'

/*
 * Trophées : obtenus quand la progression atteint un palier, puis gardés avec leur date dans un enregistrement
 * synchronisé ach_<id> → { level: 'trophy', date } (pas compté comme pratique, utils/activity.js). Un trophée obtenu
 * le reste, même si la valeur redescend (ami retiré, élément oublié). Ceux des amis ne s'évaluent qu'avec les données
 * du serveur (social : réponse de /api/social, server/social.js).
 *
 * Chaque trophée : id, group (section de la page Trophées), label [clé de traduction, paramètres], et
 * progress(ctx) → { value, goal } ; null si sa valeur n'est pas connue (amis hors ligne).
 */

export const TROPHY_LEVEL = 'trophy'
const PREFIX = 'ach_'
export const trophyKey = id => `${PREFIX}${id}`

const steps = (group, label, field, goals) => goals.map(goal => ({
  id: `${field}${goal}`,
  group,
  label: [label, { n: goal }],
  progress: ctx => ({ value: ctx[field], goal }),
}))

export const TROPHIES = [
  ...steps('streak', 'trophy.streak', 'streak', [3, 7, 30, 100, 365]),
  ...steps('xp', 'trophy.xp', 'xp', [1000, 10000, 50000]),
  ...steps('words', 'trophy.words', 'words', [10, 100, 500, 1000, 2500]),
  ...[1, 2, 3, 4, 5, 6, 7].map(level => ({
    id: `hsk${level}`,
    group: 'words',
    label: [level === 7 ? 'trophy.hskHigh' : 'trophy.hsk', { n: level }],
    progress: ctx => {
      const stat = ctx.levels.get(level)
      return stat?.total ? { value: stat.known, goal: stat.total } : null
    },
  })),
  ...steps('chars', 'trophy.chars', 'chars', [10, 100, 500, 1000]),
  { id: 'radicals', group: 'chars', label: ['trophy.radicals', {}], progress: ctx => ctx.radicals },
  { id: 'pinyin', group: 'lessons', label: ['trophy.pinyin', {}], progress: ctx => ctx.pinyin },
  ...steps('lessons', 'trophy.grammar', 'grammar', [10, 40]),
  { id: 'reading1', group: 'lessons', label: ['trophy.readingFirst', {}], progress: ctx => ({ value: ctx.reading, goal: 1 }) },
  ...steps('lessons', 'trophy.reading', 'reading', [10]),
  {
    id: 'friend1', group: 'social', label: ['trophy.friend', {}],
    progress: ctx => (ctx.social ? { value: ctx.social.leaderboard.length - 1, goal: 1 } : null),
  },
  {
    id: 'weekWinner', group: 'social', label: ['trophy.weekWinner', {}],
    progress: ctx => (ctx.social ? { value: ctx.social.lastWeek?.rank === 1 ? 1 : 0, goal: 1 } : null),
  },
]

export const TROPHY_GROUPS = ['streak', 'xp', 'words', 'chars', 'lessons', 'social']

/** Nom affiché d'un trophée, nombres au format de la langue (10 000 / 10,000). */
export function trophyName(t, lang, trophy) {
  const [key, params] = trophy.label
  const format = new Intl.NumberFormat(lang)
  return t(key, Object.fromEntries(Object.entries(params).map(([name, value]) => [name, format.format(value)])))
}

const knownCount = (progressMap, prefix, counted = () => true) => {
  let n = 0
  for (const [key, record] of progressMap || []) if (key.startsWith(prefix) && record.known && counted(record)) n++
  return n
}
const passedCount = (progressMap, prefix) => {
  let n = 0
  for (const [key, record] of progressMap || []) if (key.startsWith(prefix) && isLessonPassed(record)) n++
  return n
}

/** Valeurs mesurées par les trophées ; levelStats : useLevels ; social : /api/social ou null. */
export function trophyContext(progressMap, levelStats, social) {
  return {
    streak: bestStreak(progressMap),
    xp: totalXp(progressMap),
    // Mots appris en s'entraînant (pas ceux « placés » par un test de niveau, comme la page Aujourd'hui).
    words: knownCount(progressMap, 'hsk', record => !record.placed),
    levels: new Map((levelStats || []).map(stat => [stat.level, stat])),
    chars: knownCount(progressMap, 'hz_'),
    radicals: {
      value: QUIZ_RADICALS.filter(radical => getRadicalProgress(progressMap, radical).known).length,
      goal: QUIZ_RADICALS.length,
    },
    pinyin: {
      value: PINYIN_LESSONS.filter(lesson => isLessonPassed(getLessonProgress(progressMap, lesson))).length,
      goal: PINYIN_LESSONS.length,
    },
    grammar: passedCount(progressMap, 'gr_'),
    reading: passedCount(progressMap, 'rd_'),
    social,
  }
}

/** Date d'obtention (AAAA-MM-JJ) d'un trophée, ou null. */
export const trophyDate = (progressMap, id) => progressMap?.get(trophyKey(id))?.date ?? null

export const earnedCount = progressMap => TROPHIES.filter(trophy => trophyDate(progressMap, trophy.id)).length

/** Trophées atteints mais pas encore enregistrés. */
export function newTrophies(progressMap, ctx) {
  return TROPHIES.filter(trophy => {
    if (trophyDate(progressMap, trophy.id)) return false
    const progress = trophy.progress(ctx)
    return progress !== null && progress.goal > 0 && progress.value >= progress.goal
  })
}

export const trophyRecord = id => ({ wordId: trophyKey(id), level: TROPHY_LEVEL, date: today() })
