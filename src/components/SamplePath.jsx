import { useEffect, useState } from 'react'
import { READINGS } from '../data/reading.js'
import { FREE_NEXT_EXCERPTS, sampleForLevel, sampleLabel } from '../data/freePreviews.js'
import { wordSenses } from '../data/index.js'
import { QUIZ_STATES, useQuiz } from '../hooks/useQuiz.js'
import { useLang } from '../i18n/useLang.js'
import { getReadingProgress } from '../utils/readingQuiz.js'
import { isLessonPassed } from '../utils/lessonProgress.js'
import { wordSrc } from '../utils/audio.js'
import { ReadingText } from './ReadingText.jsx'
import { SpeakButton } from './SpeakButton.jsx'
import { QuizScreen } from './QuizScreen.jsx'
import { Results } from './Results.jsx'
import { Button, Screen, SectionLabel, TopBar } from './ui.jsx'

function NextOffer({ excerpt, onOffer, onUpgrade }) {
  const { l, t } = useLang()
  useEffect(() => { onOffer() }, [onOffer])
  return (
    <section className="mt-6 space-y-4 rounded-2xl border border-line bg-card p-4">
      <h2 className="text-lg font-medium text-fg">{t('path.next')}</h2>
      {excerpt ? (
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <p className="font-medium text-fg">{l(excerpt.title)}</p>
            <p lang="zh" className="chinese-text mt-1 text-xl text-fg">{excerpt.zh}</p>
            <p className="text-sm text-fg-2">{excerpt.pinyin}</p>
            <p className="text-sm text-fg-2">{l(excerpt.tr)}</p>
          </div>
          <SpeakButton text={excerpt.zh} voice={excerpt.voice} />
        </div>
      ) : <p className="text-fg-2">{t('path.fullVocabulary')}</p>}
      <Button onClick={onUpgrade}>{t('path.upgrade')}</Button>
    </section>
  )
}

export function SamplePath({ level, completed, progressMap, getProgress, applyUpdates, hasPlus, onComplete, onBack, onChangeLevel, onOffer, onUpgrade, onFullVocabulary }) {
  const { l, t, lang } = useLang()
  const [reading, setReading] = useState(null)
  const [showWords, setShowWords] = useState(false)
  const [fullQuiz, setFullQuiz] = useState(false)
  const { words, readingIds, next, title } = sampleForLevel(level)
  const quiz = useQuiz(progressMap, getProgress, applyUpdates, lang)
  const readings = readingIds?.map(id => READINGS.find(item => item.id === id)) ?? []
  const nextReading = hasPlus && next ? READINGS.find(item => item.id === next && !item.locked) : null
  const read = !readings.length || readings.some(item => isLessonPassed(getReadingProgress(progressMap, item)))
  const canFinish = read && words.every(word => progressMap.has(word.id))

  function startWords(full) {
    if (full ? quiz.startQuiz([level]) : quiz.startWords(words)) setFullQuiz(full)
  }

  if (reading) {
    return <ReadingText reading={reading} progressMap={progressMap} applyUpdates={applyUpdates} onExit={() => setReading(null)} backLabel={t('path.back')} exitLabel={t('path.back')} />
  }
  if (quiz.state === QUIZ_STATES.FINISHED) {
    return <Results results={quiz.results} onHome={quiz.resetQuiz} onRestart={() => startWords(fullQuiz)} homeLabel={t('path.back')} />
  }
  if (quiz.state !== QUIZ_STATES.IDLE) {
    return <QuizScreen quizState={quiz.state} currentQuestion={quiz.currentQuestion} currentIndex={quiz.currentIndex} totalQuestions={quiz.totalQuestions} lastCorrect={quiz.lastCorrect} lastAnswer={quiz.lastAnswer} upcoming={quiz.upcoming} onSubmit={quiz.submitAnswer} onNext={quiz.nextQuestion} onQuit={quiz.resetQuiz} />
  }

  return (
    <Screen>
      <TopBar onBack={onBack} backLabel={t('today.title')} aside={sampleLabel(level)} bordered />
      <div className="space-y-4 px-5 py-6">
        <h1 className="text-[28px] font-medium text-fg">{title ? l(title) : t('path.sampleTitle', { level: sampleLabel(level) })}</h1>
        <p className="text-fg-2">{t(completed ? 'path.sampleSaved' : readings.length ? 'path.sampleReading' : 'path.sampleListening')}</p>
        {readings.map(item => (
          <Button key={item.id} variant="secondary" onClick={() => setReading(item)}>{l(item.title)}</Button>
        ))}
        <Button variant="secondary" aria-expanded={showWords} onClick={() => setShowWords(open => !open)}>
          {t(showWords ? 'path.hideWords' : 'path.showWords', { n: words.length })}
        </Button>
        {showWords && (
          <section>
            <SectionLabel>{t('module.vocab.title')}</SectionLabel>
            <ul className="divide-y divide-line rounded-xl border border-line bg-card px-3">
              {words.map(word => (
                <li key={word.id} className="flex items-center gap-3 py-2">
                  <span className="chinese-text min-w-16 text-lg text-fg" lang="zh">{word.simplified}</span>
                  <span className="flex-1 text-sm text-fg-2">{word.pinyin} · {wordSenses(word, lang)[0]}</span>
                  <SpeakButton src={wordSrc(word)} text={word.simplified} />
                </li>
              ))}
            </ul>
          </section>
        )}
        <Button variant={completed ? 'secondary' : 'primary'} onClick={() => startWords(false)}>{t('path.testWords')}</Button>
        {!completed && canFinish && <Button onClick={onComplete}>{t('path.finish')}</Button>}
        {completed && !hasPlus && <NextOffer excerpt={FREE_NEXT_EXCERPTS[next]} onOffer={onOffer} onUpgrade={onUpgrade} />}
        {completed && nextReading && <Button onClick={() => setReading(nextReading)}>{l(nextReading.title)}</Button>}
        {completed && hasPlus && !next && (
          <>
            <Button onClick={() => startWords(true)}>{t('path.practiceFull')}</Button>
            <Button variant="secondary" onClick={onFullVocabulary}>{t('path.fullVocabulary')}</Button>
          </>
        )}
        <Button variant="secondary" onClick={onBack}>{t('path.keepReviewing')}</Button>
        <Button variant="secondary" onClick={onChangeLevel}>{t('path.changeLevel')}</Button>
      </div>
    </Screen>
  )
}
