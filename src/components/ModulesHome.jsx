import { ChevronRight, Gift, Settings } from 'lucide-react'
import { CLASSIFIERS } from '../data/classifiers.js'
import { PINYIN_LESSONS } from '../data/pinyinLessons.js'
import { GRAMMAR_POINTS } from '../data/grammar.js'
import { HANZI } from '../data/hanzi.js'
import { READINGS } from '../data/reading.js'
import { canOpenModule, canUseGrammarPoint, canUseHanzi, canUseReading, canUseVocabLevel } from '../access/rules.js'
import { getClassifierProgress } from '../utils/classifierQuiz.js'
import { getLessonProgress } from '../utils/pinyinQuiz.js'
import { getPointProgress } from '../utils/grammarQuiz.js'
import { getCharProgress } from '../utils/hanziQuiz.js'
import { getReadingProgress } from '../utils/readingQuiz.js'
import { isLessonPassed } from '../utils/lessonProgress.js'
import { useLang } from '../i18n/useLang.js'
import { TodayCard } from './TodayPage.jsx'
import { PlacementInvite } from './PlacementInvite.jsx'
import { PlusBadge, ProgressBar, Screen, Seal, TopBar } from './ui.jsx'
import { ICON } from './uiStyles.js'

/** locked : module Yidiano+ vu depuis la formule gratuite (cadenas, sans progression). */
function ModuleCard({ id, seal, chinese, known, total, locked = false, onOpen }) {
  const { t } = useLang()
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`w-full rounded-2xl border border-line p-5 text-left transition-colors duration-150 ease-out hover:bg-raised active:bg-raised ${locked ? 'bg-page' : 'bg-card'}`}
    >
      <div className="flex items-center gap-3">
        <Seal>{seal}</Seal>
        <span className={`flex-1 text-lg font-medium ${locked ? 'text-fg-2' : 'text-fg'}`}>
          {t(`module.${id}.title`)} <span className="chinese-text text-fg-2">{chinese}</span>
        </span>
        {locked ? <PlusBadge /> : <ChevronRight {...ICON} className="text-fg-3" />}
      </div>
      <p className="mt-3 text-[15px] leading-snug text-fg-2">{t(`module.${id}.desc`)}</p>
      {!locked && (
        <>
          <ProgressBar value={total ? known / total : 0} className="mt-4" />
          <p className="mt-2 text-sm tabular-nums text-fg-3">{known} / {total} {t(`module.${id}.unit`)}</p>
        </>
      )}
    </button>
  )
}

/** Parrainage mis en avant sur l'accueil : un mois de Yidiano+ par ami qui essaie Yidiano+ (ReferralPage). */
function ReferralCard({ onOpen }) {
  const { t } = useLang()
  return (
    <button
      type="button"
      onClick={onOpen}
      className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-accent/40 bg-accent/10 p-4 text-left transition-colors duration-150 ease-out hover:bg-accent/15"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-white">
        <Gift size={20} strokeWidth={1.75} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-medium text-fg">{t('ref.cardTitle')}</span>
        <span className="mt-0.5 block text-sm leading-snug text-fg-2">{t('ref.cardText')}</span>
      </span>
      <ChevronRight {...ICON} className="shrink-0 text-fg-3" />
    </button>
  )
}

/** showPlacement : nouvel utilisateur, invité au test de niveau. Un module verrouillé ouvre Yidiano+ (App.jsx). */
export function ModulesHome({ hasPlus, levelStats, progressMap, showPlacement, onStartPlacement, onOpenToday, onOpenPinyin, onOpenVocabulary, onOpenCharacters, onOpenGrammar, onOpenReading, onOpenClassifiers, onOpenSettings, onOpenReferral }) {
  const { t } = useLang()
  const locked = module => !canOpenModule(module, hasPlus)
  const availableLevels = (levelStats || []).filter(stat => canUseVocabLevel(stat.level, hasPlus))
  const availableGrammar = GRAMMAR_POINTS.filter(point => canUseGrammarPoint(point, hasPlus))
  const availableHanzi = HANZI.filter(ch => canUseHanzi(ch, hasPlus))
  const availableReadings = READINGS.filter(reading => canUseReading(reading, hasPlus))
  const wordsKnown = availableLevels.reduce((n, s) => n + s.known, 0)
  const wordsTotal = availableLevels.reduce((n, s) => n + s.total, 0)
  const classifiersKnown = CLASSIFIERS.filter(cl => getClassifierProgress(progressMap, cl).known).length
  const lessonsPassed = PINYIN_LESSONS.filter(l => isLessonPassed(getLessonProgress(progressMap, l))).length
  const pointsPassed = availableGrammar.filter(p => isLessonPassed(getPointProgress(progressMap, p))).length
  const charsKnown = availableHanzi.filter(ch => getCharProgress(progressMap, ch).known).length
  const textsPassed = availableReadings.filter(r => isLessonPassed(getReadingProgress(progressMap, r))).length

  const settings = (
    <button
      type="button"
      onClick={onOpenSettings}
      aria-label={t('home.settings')}
      title={t('home.settings')}
      className="-mr-2 inline-flex size-9 items-center justify-center rounded-lg text-fg-2 transition-colors duration-150 ease-out hover:bg-raised hover:text-fg"
    >
      <Settings {...ICON} />
    </button>
  )

  return (
    <Screen>
      <TopBar aside={settings} />

      <div className="px-5 pb-8">
        <header className="pt-4 pb-8">
          <h1 className="text-[32px] font-medium leading-tight text-fg">
            {t('home.title')} <span className="hanzi-display text-fg-2">中文</span>
          </h1>
          <p className="mt-1 text-[17px] text-fg-2">{t('home.subtitle')}</p>
        </header>

        <TodayCard locked={locked('today')} progressMap={progressMap} onOpen={onOpenToday} />
        <ReferralCard onOpen={onOpenReferral} />
        {showPlacement && <PlacementInvite onStart={onStartPlacement} className="mt-3" />}

        <div className="mt-6 flex flex-col gap-3">
          <ModuleCard id="pinyin" seal="拼" chinese="拼音" known={lessonsPassed} total={PINYIN_LESSONS.length} onOpen={onOpenPinyin} />
          <ModuleCard id="vocab" seal="词" chinese="词汇" known={wordsKnown} total={wordsTotal} onOpen={onOpenVocabulary} />
          <ModuleCard id="hanzi" seal="字" chinese="汉字" known={charsKnown} total={availableHanzi.length} onOpen={onOpenCharacters} />
          <ModuleCard id="grammar" seal="语" chinese="语法" known={pointsPassed} total={availableGrammar.length} locked={locked('grammar')} onOpen={onOpenGrammar} />
          <ModuleCard id="reading" seal="读" chinese="阅读" known={textsPassed} total={availableReadings.length} locked={locked('reading')} onOpen={onOpenReading} />
          <ModuleCard id="classifiers" seal="量" chinese="量词" known={classifiersKnown} total={CLASSIFIERS.length} locked={locked('classifiers')} onOpen={onOpenClassifiers} />
        </div>
      </div>
    </Screen>
  )
}
