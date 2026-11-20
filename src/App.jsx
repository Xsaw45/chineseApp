import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAccess } from './access/context.js'
import { canOpenModule, FREE_VOCAB_TESTS_PER_DAY } from './access/rules.js'
import { withActivity, markStepDone, addPracticeTime, countVocabTest, vocabTestsToday } from './utils/activity.js'
import { PLACEMENT_KEY } from './utils/levelTest.js'
import { VocabLevelTest } from './components/VocabLevelTest.jsx'
import { LanguageChoice } from './components/LanguageChoice.jsx'
import { useProgress } from './hooks/useProgress.js'
import { useLevels } from './hooks/useLevels.js'
import { usePracticeTime } from './hooks/usePracticeTime.js'
import { useQuiz, QUIZ_STATES } from './hooks/useQuiz.js'
import { LangContext, SETTINGS_KEY, makeLang } from './i18n/useLang.js'
import { defaultLang, translate } from './i18n/text.js'
import { Dashboard } from './components/Dashboard.jsx'
import { QuizScreen } from './components/QuizScreen.jsx'
import { Results } from './components/Results.jsx'
import { VocabularyPage } from './components/VocabularyPage.jsx'
import { ClassifiersPage } from './components/ClassifiersPage.jsx'
import { CharactersPage } from './components/CharactersPage.jsx'
import { ModulesHome } from './components/ModulesHome.jsx'
import { PinyinPage } from './components/PinyinPage.jsx'
import { GrammarPage } from './components/GrammarPage.jsx'
import { ReadingPage } from './components/ReadingPage.jsx'
import { TodayPage } from './components/TodayPage.jsx'
import { SettingsPage } from './components/SettingsPage.jsx'
import { PlusPage } from './components/PlusPage.jsx'
import { AdminPage } from './components/AdminPage.jsx'

export default function App() {
  // 'home' (choix du module) | 'hsk' (vocabulaire : tests et niveaux) | 'vocabulary' (liste des mots) | 'classifiers'
  // | 'pinyin' | 'hanzi' | 'grammar' | 'reading' | 'today' | 'settings' | 'plus' | 'admin'
  const [screen, setScreen] = useState('home')
  const [plusBack, setPlusBack] = useState('settings')
  const openPlus = useCallback(from => {
    setPlusBack(from)
    setScreen('plus')
  }, [])
  const { progressMap, latestMap, getProgress, applyUpdates: saveUpdates, loading } = useProgress()
  const { hasPlus, loading: accessLoading } = useAccess()
  const { levelStats, unlockedLevels } = useLevels(progressMap)
  const accessibleLevels = useMemo(() => hasPlus ? unlockedLevels : [1], [hasPlus, unlockedLevels])
  // Toute progression enregistrée compte aussi dans l'activité du jour (série, éléments maîtrisés).
  const applyUpdates = useCallback(updates => saveUpdates(withActivity(latestMap(), updates)), [saveUpdates, latestMap])

  // Réglages synchronisés (enregistrement « settings ») : langue, premier lancement fait, test de niveau fait.
  const saveSetting = useCallback(
    patch => applyUpdates([{ ...latestMap()?.get(SETTINGS_KEY), wordId: SETTINGS_KEY, level: 'settings', ...patch }]),
    [applyUpdates, latestMap],
  )
  const settings = progressMap?.get(SETTINGS_KEY)
  // Langue : réglage synchronisé, sinon celle du navigateur.
  const lang = settings?.lang || defaultLang()
  const setLang = useCallback(next => saveSetting({ lang: next }), [saveSetting])
  const placementDone = !!settings?.[PLACEMENT_KEY]
  const newLearner = !placementDone && ![...(progressMap?.keys() || [])].some(k => k.startsWith('hsk'))
  // Premier lancement : choix de la langue, puis directement le test de niveau (une seule fois, même s'il est quitté).
  const onboarding = newLearner && !settings?.onboarded
  // Test de niveau du vocabulaire en cours : { mode: 'placement', from? } | { mode: 'unlock', level }
  // from 'onboarding' : on revient ensuite à l'accueil, pas à la page Vocabulaire.
  const [levelTest, setLevelTest] = useState(null)
  const langValue = useMemo(() => makeLang(lang, setLang), [lang, setLang])
  useEffect(() => {
    document.documentElement.lang = lang
    document.title = translate(lang, 'home.title')
  }, [lang])

  const {
    state,
    currentQuestion,
    upcoming,
    currentIndex,
    totalQuestions,
    lastCorrect,
    lastAnswer,
    results,
    startQuiz,
    submitAnswer,
    nextQuestion,
    resetQuiz,
  } = useQuiz(progressMap, getProgress, applyUpdates, lang)

  // Temps de pratique : dans un module ou un test, pas sur l'accueil ni dans les paramètres.
  const practicing = !loading && !accessLoading && (state !== QUIZ_STATES.IDLE || !['home', 'settings', 'plus', 'admin'].includes(screen))
  usePracticeTime(practicing, seconds => saveUpdates([addPracticeTime(latestMap(), seconds)]))

  // Formule gratuite : FREE_VOCAB_TESTS_PER_DAY tests de vocabulaire par jour, comptés dès leur lancement ; au-delà,
  // l'écran Yidiano+ s'ouvre. null : pas de limite.
  const vocabTestsLeft = hasPlus ? null : Math.max(0, FREE_VOCAB_TESTS_PER_DAY - vocabTestsToday(progressMap))
  const startVocabQuiz = () => {
    if (!hasPlus && vocabTestsToday(latestMap()) >= FREE_VOCAB_TESTS_PER_DAY) return openPlus('hsk')
    if (startQuiz(accessibleLevels) && !hasPlus) saveUpdates([countVocabTest(latestMap())])
  }

  const home = () => setScreen('home')
  // Module Yidiano+ sans l'accès (fin d'abonnement, aperçu gratuit de l'admin) : retour à l'accueil.
  const view = canOpenModule(screen, hasPlus) ? screen : 'home'
  const openModule = module => (canOpenModule(module, hasPlus) ? setScreen(module) : openPlus('home'))
  let content

  if (loading || accessLoading) {
    content = (
      <div className="flex min-h-dvh items-center justify-center bg-page">
        <p className="text-[15px] text-fg-3">{translate(lang, 'app.loading')}</p>
      </div>
    )
  } else if (state === QUIZ_STATES.FINISHED) {
    content = (
      <Results
        results={results}
        onRestart={() => {
          resetQuiz()
          setTimeout(startVocabQuiz, 0)
        }}
        onHome={() => {
          if (screen === 'today') applyUpdates([markStepDone(progressMap, 'vocab')])
          resetQuiz()
        }}
        homeLabel={translate(lang, screen === 'today' ? 'today.back' : 'vocab.backToVocab')}
      />
    )
  } else if (levelTest) {
    content = (
      <VocabLevelTest
        mode={levelTest.mode}
        level={levelTest.level}
        progressMap={progressMap}
        applyUpdates={applyUpdates}
        onPlaced={reached => saveSetting({ [PLACEMENT_KEY]: { level: reached, date: new Date().toISOString() } })}
        onExit={() => {
          setScreen(levelTest.from === 'onboarding' ? 'home' : 'hsk')
          setLevelTest(null)
        }}
      />
    )
  } else if (onboarding) {
    content = (
      <LanguageChoice
        onChoose={code => {
          saveSetting({ lang: code, onboarded: true })
          setLevelTest({ mode: 'placement', from: 'onboarding' })
        }}
      />
    )
  } else if (state === QUIZ_STATES.QUESTION || state === QUIZ_STATES.FEEDBACK) {
    content = (
      <QuizScreen
        quizState={state}
        currentQuestion={currentQuestion}
        currentIndex={currentIndex}
        totalQuestions={totalQuestions}
        lastCorrect={lastCorrect}
        lastAnswer={lastAnswer}
        upcoming={upcoming}
        onSubmit={submitAnswer}
        onNext={nextQuestion}
        onQuit={resetQuiz}
      />
    )
  } else if (view === 'vocabulary') {
    content = <VocabularyPage hasPlus={hasPlus} onUpgrade={() => openPlus('vocabulary')} onBack={() => setScreen('hsk')} />
  } else if (view === 'classifiers') {
    content = <ClassifiersPage progressMap={progressMap} applyUpdates={applyUpdates} onBack={home} />
  } else if (view === 'pinyin') {
    content = <PinyinPage progressMap={progressMap} applyUpdates={applyUpdates} onBack={home} />
  } else if (view === 'hanzi') {
    content = <CharactersPage hasPlus={hasPlus} onUpgrade={() => openPlus('hanzi')} progressMap={progressMap} applyUpdates={applyUpdates} onBack={home} />
  } else if (view === 'grammar') {
    content = <GrammarPage hasPlus={hasPlus} onUpgrade={() => openPlus('grammar')} progressMap={progressMap} applyUpdates={applyUpdates} onBack={home} />
  } else if (view === 'reading') {
    content = <ReadingPage hasPlus={hasPlus} onUpgrade={() => openPlus('reading')} progressMap={progressMap} applyUpdates={applyUpdates} onBack={home} />
  } else if (view === 'settings') {
    content = <SettingsPage onBack={home} onOpenPlus={() => openPlus('settings')} onOpenAdmin={() => setScreen('admin')} />
  } else if (view === 'plus') {
    content = <PlusPage onBack={() => setScreen(plusBack)} />
  } else if (view === 'admin') {
    content = <AdminPage onBack={() => setScreen('settings')} />
  } else if (view === 'today') {
    content = <TodayPage progressMap={progressMap} applyUpdates={applyUpdates} onBack={home} onStartVocab={startVocabQuiz} />
  } else if (view === 'hsk') {
    content = (
      <Dashboard
        hasPlus={hasPlus}
        onUpgrade={() => openPlus('hsk')}
        levelStats={levelStats}
        unlockedLevels={unlockedLevels}
        progressMap={progressMap}
        placementDone={placementDone}
        testsLeft={vocabTestsLeft}
        onStartPlacement={() => setLevelTest({ mode: 'placement' })}
        onStartUnlockTest={level => setLevelTest({ mode: 'unlock', level })}
        onStartQuiz={startVocabQuiz}
        onOpenVocabulary={() => setScreen('vocabulary')}
        onBack={home}
      />
    )
  } else {
    content = (
      <ModulesHome
        levelStats={levelStats}
        progressMap={progressMap}
        showPlacement={newLearner}
        onStartPlacement={() => setLevelTest({ mode: 'placement' })}
        onOpenToday={() => openModule('today')}
        onOpenPinyin={() => setScreen('pinyin')}
        onOpenVocabulary={() => setScreen('hsk')}
        onOpenCharacters={() => setScreen('hanzi')}
        onOpenGrammar={() => openModule('grammar')}
        onOpenReading={() => openModule('reading')}
        onOpenClassifiers={() => openModule('classifiers')}
        onOpenSettings={() => setScreen('settings')}
        hasPlus={hasPlus}
      />
    )
  }

  return <LangContext.Provider value={langValue}>{content}</LangContext.Provider>
}
