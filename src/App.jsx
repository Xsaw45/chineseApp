import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAccess } from './access/context.js'
import { canOpenModule } from './access/rules.js'
import { capture, consent } from './analytics.js'
import { ConsentBanner } from './components/ConsentBanner.jsx'
import { activityKey, withActivity, markStepDone, addPracticeTime } from './utils/activity.js'
import { PLACEMENT_KEY } from './utils/levelTest.js'
import { today } from './utils/spacedrep.js'
import { SAMPLE_LEVELS, sampleDoneKey, sampleKey, sampleLevel, startedSampleWords } from './data/freePreviews.js'
import { READINGS } from './data/reading.js'
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
import { ReadingText } from './components/ReadingText.jsx'
import { TodayPage } from './components/TodayPage.jsx'
import { BeginnerPath } from './components/BeginnerPath.jsx'
import { SamplePath } from './components/SamplePath.jsx'
import { PathChoice } from './components/PathChoice.jsx'
import { SettingsPage } from './components/SettingsPage.jsx'
import { PlusPage } from './components/PlusPage.jsx'
import { AdminPage } from './components/AdminPage.jsx'
import { ReferralPage } from './components/ReferralPage.jsx'

const BEGINNER_STEP_PREFIX = 'beginner_step_'
const DEMO_COMPLETED = 'yidiano.demo.completed'

function takePublicDemo() {
  try {
    const done = localStorage.getItem(DEMO_COMPLETED) === '1'
    if (done) localStorage.removeItem(DEMO_COMPLETED)
    return done
  } catch {
    return false
  }
}

function beginnerSteps(progressMap) {
  let count = 0
  while (progressMap?.has(`${BEGINNER_STEP_PREFIX}${count + 1}`)) count += 1
  return count
}

export default function App() {
  // Navigation des modules, du parcours guidé et des réglages.
  const [screen, setScreen] = useState('home')
  const [plusBack, setPlusBack] = useState('settings')
  const [plusFrom, setPlusFrom] = useState(null)
  const openPlus = useCallback((from, offer) => {
    const attribution = { from, ...offer }
    capture('plus_viewed', attribution)
    setPlusFrom(attribution)
    setPlusBack(from)
    setScreen('plus')
  }, [])
  const [referralBack, setReferralBack] = useState('home')
  const openReferral = useCallback(from => {
    capture('referral_viewed', { from })
    setReferralBack(from)
    setScreen('referral')
  }, [])
  const { progressMap, latestMap, getProgress, applyUpdates: saveUpdates, loading } = useProgress()
  const { hasPlus, loading: accessLoading } = useAccess()
  const { levelStats, unlockedLevels } = useLevels(progressMap)
  const selectedLevel = progressMap?.get(SETTINGS_KEY)?.sampleLevel
  const accessibleLevels = useMemo(() => {
    if (!hasPlus) return [1]
    if (!selectedLevel || unlockedLevels.includes(selectedLevel)) return unlockedLevels
    return [...unlockedLevels, selectedLevel].sort((a, b) => a - b)
  }, [hasPlus, unlockedLevels, selectedLevel])
  const sampleWords = useMemo(() => startedSampleWords(progressMap), [progressMap])
  const profile = progressMap?.get(SETTINGS_KEY)?.learnerProfile
  const completedBeginner = beginnerSteps(progressMap)
  // L'activité est sauvegardée même sans consentement ; seule la mesure est facultative.
  const applyUpdates = useCallback(updates => {
    const map = latestMap()
    const tracked = withActivity(map, updates)
    const key = activityKey(today())
    const previous = map?.get(key)
    const firstToday = (!previous || previous.practiced === false) && tracked.some(update => update.wordId === key && update.practiced)
    const saved = saveUpdates(tracked)
    if (firstToday) capture('learning_activity_day', { profile: profile ?? 'unselected' })
    return saved
  }, [saveUpdates, latestMap, profile])

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
  const onboarding = newLearner && !settings?.onboarded
  // Le placement du parcours conseille un niveau ; le test standard peut programmer des révisions accessibles.
  const [levelTest, setLevelTest] = useState(null)
  const [guidedResult, setGuidedResult] = useState(null)
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

  async function chooseProfile(next) {
    const current = latestMap()?.get(SETTINGS_KEY)
    if (current?.learnerProfile !== next) capture('learning_profile_chosen', { profile: next })
    await saveSetting({ learnerProfile: next, demoDone: current?.demoDone || takePublicDemo() })
    setScreen(next === 'beginner' ? 'path' : 'level')
  }

  async function chooseSample(level, method) {
    const key = sampleKey(level)
    capture('learning_level_chosen', { profile: 'experienced', level, method })
    await saveSetting({ learnerProfile: 'experienced', sampleLevel: level })
    if (!latestMap()?.has(key)) await applyUpdates([{ wordId: key, level: 'settings' }])
    setScreen('path')
  }

  function finishPathStep(key, details) {
    const map = latestMap()
    if (map?.has(key)) return
    const first = !beginnerSteps(map) && !SAMPLE_LEVELS.some(level => map?.has(sampleDoneKey(level)))
    applyUpdates([{ wordId: key, level: 'settings' }, markStepDone(map, 'path')])
    capture('learning_session_completed', { profile, first, ...details })
  }

  const offerId = profile === 'experienced' ? `sample_${selectedLevel}` : 'beginner_complete'
  const trackOffer = useCallback(() => {
    if (!hasPlus && consent() === 'granted') capture('learning_offer_viewed', { profile, offer: offerId })
  }, [hasPlus, profile, offerId])

  function startVocab() {
    startQuiz(accessibleLevels, sampleWords)
  }

  // Temps de pratique : dans un module ou un test, pas sur l'accueil ni dans les paramètres.
  const practicing = !loading && !accessLoading && (state !== QUIZ_STATES.IDLE || !['home', 'settings', 'plus', 'admin'].includes(screen))
  usePracticeTime(practicing, seconds => saveUpdates([addPracticeTime(latestMap(), seconds)]))

  const home = () => setScreen('home')
  // Module réservé à Yidiano+ sans l'accès (fin d'abonnement, aperçu gratuit de l'admin) : retour à l'accueil.
  const view = canOpenModule(screen, hasPlus) ? screen : 'home'
  // Mesure d'audience : écrans ouverts (l'app ne change pas d'adresse, donc pas de pages vues après la première).
  useEffect(() => {
    capture('screen_viewed', { screen: view })
  }, [view])
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
          setTimeout(startVocab, 0)
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
        guidanceOnly={levelTest.from === 'level'}
        allowedPlacementWord={hasPlus ? undefined : key => key.startsWith('hsk1_') || sampleWords.has(key)}
        onPlaced={reached => {
          if (levelTest.from === 'level') setGuidedResult(sampleLevel(reached))
          else saveSetting({ [PLACEMENT_KEY]: { level: reached, date: new Date().toISOString() } })
        }}
        onExit={() => {
          const guided = levelTest.from === 'level'
          setLevelTest(null)
          if (guided && guidedResult !== null) {
            chooseSample(guidedResult, 'placement')
            setGuidedResult(null)
          } else {
            setScreen(guided ? 'level' : 'hsk')
          }
        }}
      />
    )
  } else if (onboarding) {
    content = (
      <LanguageChoice
        onChoose={code => {
          // Premier lancement d'un compte nouveau : l'étape « inscription » de l'entonnoir.
          capture('signed_up', { lang: code })
          saveSetting({ lang: code, onboarded: true })
          setScreen('profile')
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
    content = <SettingsPage onBack={home} onOpenPlus={() => openPlus('settings')} onOpenAdmin={() => setScreen('admin')} onOpenReferral={() => openReferral('settings')} />
  } else if (view === 'profile' || view === 'level') {
    content = <PathChoice choosingLevel={view === 'level'} onBeginner={() => chooseProfile('beginner')} onChooseLevel={() => chooseProfile('experienced')} onSample={chooseSample} onTest={() => setLevelTest({ mode: 'placement', from: 'level' })} onBack={() => setScreen(view === 'level' && !selectedLevel ? 'profile' : 'today')} />
  } else if (view === 'path-next' && hasPlus) {
    const reading = READINGS.find(item => item.id === 'wenlu')
    content = <ReadingText reading={reading} progressMap={progressMap} applyUpdates={applyUpdates} onExit={() => setScreen('path')} backLabel={translate(lang, 'path.back')} exitLabel={translate(lang, 'path.back')} />
  } else if (view === 'path' && profile === 'beginner') {
    content = <BeginnerPath completed={completedBeginner} demoDone={settings?.demoDone === true} onComplete={step => finishPathStep(`${BEGINNER_STEP_PREFIX}${step}`, { step })} progressMap={progressMap} applyUpdates={applyUpdates} onBack={() => setScreen('today')} onOffer={trackOffer} onUpgrade={() => openPlus('path', { profile, offer: offerId })} onFullDialogue={hasPlus && READINGS.some(item => item.id === 'wenlu' && !item.locked) ? () => setScreen('path-next') : null} />
  } else if (view === 'path' && selectedLevel) {
    content = <SamplePath key={selectedLevel} level={selectedLevel} completed={progressMap.has(sampleDoneKey(selectedLevel))} progressMap={progressMap} getProgress={getProgress} applyUpdates={applyUpdates} hasPlus={hasPlus} onComplete={() => finishPathStep(sampleDoneKey(selectedLevel), { level: selectedLevel })} onBack={() => setScreen('today')} onChangeLevel={() => setScreen('level')} onOffer={trackOffer} onUpgrade={() => openPlus('path', { profile, offer: offerId })} onFullVocabulary={() => setScreen('sample-vocabulary')} />
  } else if (view === 'sample-vocabulary' && hasPlus && selectedLevel) {
    content = <VocabularyPage hasPlus initialLevel={selectedLevel} onBack={() => setScreen('path')} />
  } else if (view === 'plus') {
    content = <PlusPage attribution={plusFrom} onBack={() => setScreen(plusBack)} onOpenReferral={() => openReferral('plus')} />
  } else if (view === 'referral') {
    content = <ReferralPage onBack={() => setScreen(referralBack)} />
  } else if (view === 'admin') {
    content = <AdminPage onBack={() => setScreen('settings')} />
  } else if (view === 'today') {
    content = <TodayPage key={hasPlus} hasPlus={hasPlus} progressMap={progressMap} applyUpdates={applyUpdates} onBack={home} onStartVocab={startVocab} accessibleLevels={accessibleLevels} sampleWords={sampleWords} profile={profile} selectedLevel={selectedLevel} onOpenPath={() => setScreen(profile === 'beginner' || selectedLevel ? 'path' : profile === 'experienced' ? 'level' : 'profile')} />
  } else if (view === 'hsk') {
    content = (
      <Dashboard
        hasPlus={hasPlus}
        onUpgrade={() => openPlus('hsk')}
        levelStats={levelStats}
        unlockedLevels={hasPlus ? accessibleLevels : unlockedLevels}
        progressMap={progressMap}
        placementDone={placementDone}
        onStartPlacement={() => setLevelTest({ mode: 'placement' })}
        onStartUnlockTest={level => setLevelTest({ mode: 'unlock', level })}
        onStartQuiz={startVocab}
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
        onOpenToday={() => setScreen('today')}
        onOpenPinyin={() => setScreen('pinyin')}
        onOpenVocabulary={() => setScreen('hsk')}
        onOpenCharacters={() => setScreen('hanzi')}
        onOpenGrammar={() => setScreen('grammar')}
        onOpenReading={() => setScreen('reading')}
        onOpenClassifiers={() => openModule('classifiers')}
        onOpenSettings={() => setScreen('settings')}
        onOpenReferral={() => openReferral('home')}
        hasPlus={hasPlus}
        accessibleLevels={accessibleLevels}
        sampleWords={sampleWords}
        profile={profile}
      />
    )
  }

  return (
    <LangContext.Provider value={langValue}>
      {content}
      <ConsentBanner />
    </LangContext.Provider>
  )
}
