import { useEffect, useRef, useState } from 'react'
import { Check, ChevronRight, Lock } from 'lucide-react'
import { BEGINNER_SESSIONS } from '../data/beginnerPath.js'
import { FREE_NEXT_EXCERPTS } from '../data/freePreviews.js'
import { TONES } from '../data/pinyinLessons.js'
import { lineText, lineVoice } from '../data/reading.js'
import { useLang } from '../i18n/useLang.js'
import { syllableSrc } from '../utils/audio.js'
import { applyLessonResult } from '../utils/lessonProgress.js'
import { getReadingProgress } from '../utils/readingQuiz.js'
import { HanziBoard } from './HanziBoard.jsx'
import { SpeakButton } from './SpeakButton.jsx'
import { ToneCurve } from './ToneCurve.jsx'
import { Button, ProgressBar, Screen, TopBar } from './ui.jsx'
import { ICON_SM } from './uiStyles.js'

const text = {
  title: { fr: 'Parcours débutant', en: 'Beginner path' },
  overview: { fr: 'Cinq séances pour tes premiers échanges en chinois. Enchaîne-les à ton rythme.', en: 'Five sessions for your first conversations in Chinese. Work through them at your own pace.' },
  start: { fr: 'Commencer la séance', en: 'Start session' },
  resume: { fr: 'Reprendre le parcours', en: 'Resume the path' },
  locked: { fr: 'Termine la séance précédente pour débloquer celle-ci.', en: 'Finish the previous session to unlock this one.' },
  done: { fr: 'Terminée', en: 'Completed' },
  tones: { fr: 'Les quatre tons', en: 'The four tones' },
  toneIntro: { fr: 'En mandarin, changer la mélodie d’une syllabe peut changer le mot. Écoute mā, má, mǎ et mà.', en: 'In Mandarin, changing the pitch of a syllable can change the word. Listen to mā, má, mǎ and mà.' },
  tonePrompt: { fr: 'Écoute má. Quel ton entends-tu ?', en: 'Listen to má. Which tone do you hear?' },
  toneRetry: { fr: 'Réécoute : la voix monte. Réessaie.', en: 'Listen again: the pitch rises. Try again.' },
  demo: { fr: 'Tu as déjà écouté les tons et tracé un caractère dans la démo. Tu peux passer ce rappel.', en: 'You already heard the tones and traced a character in the demo. You can skip this recap.' },
  skip: { fr: 'Passer le rappel des tons', en: 'Skip the tone recap' },
  read: { fr: 'Découvrir le dialogue', en: 'Read the dialogue' },
  chars: { fr: 'Caractères à repérer · tracé facultatif', en: 'Characters to spot · optional tracing' },
  trace: { fr: 'Suis le modèle dans l’ordre des traits.', en: 'Follow the guide in stroke order.' },
  traceDone: { fr: 'Caractère terminé !', en: 'Character complete!' },
  replay: { fr: 'Recommencer le tracé', en: 'Trace again' },
  practice: { fr: 'Répondre aux questions', en: 'Answer the questions' },
  question: { fr: 'Question', en: 'Question' },
  passage: { fr: 'Relire le dialogue', en: 'Read the dialogue again' },
  translation: { fr: 'Afficher la traduction', en: 'Show translation' },
  hideTranslation: { fr: 'Masquer la traduction', en: 'Hide translation' },
  order: { fr: 'Touche les morceaux dans l’ordre. Touche un morceau placé pour le retirer.', en: 'Tap the words in order. Tap a placed word to remove it.' },
  check: { fr: 'Vérifier', en: 'Check' },
  correct: { fr: 'Bonne réponse !', en: 'Correct!' },
  retry: { fr: 'Pas tout à fait. Relis la réplique et réessaie.', en: 'Not quite. Read the line and try again.' },
  next: { fr: 'Continuer', en: 'Continue' },
  finish: { fr: 'Terminer la séance', en: 'Finish session' },
  complete: { fr: 'Séance terminée', en: 'Session complete' },
  completeDetail: { fr: 'Tu as répondu correctement à toutes les questions. Ta prochaine séance est disponible.', en: 'You answered every question correctly. Your next session is ready.' },
  nextSession: { fr: 'Séance suivante', en: 'Next session' },
  finale: { fr: 'Parcours terminé !', en: 'Path complete!' },
  finaleDetail: { fr: 'Tu as terminé les cinq séances et rencontré 25 caractères. Voici un extrait du prochain dialogue.', en: 'You finished all five sessions and met 25 characters. Here’s a preview of the next dialogue.' },
  excerpt: { fr: 'Extrait · Demander son chemin', en: 'Preview · Asking the way' },
  plus: { fr: 'Voir le dialogue complet avec Yidiano+', en: 'See the full dialogue with Yidiano+' },
  reviews: { fr: 'Revenir aux révisions gratuites', en: 'Return to free reviews' },
}

const card = 'rounded-xl border border-line bg-raised p-4'
const chip = 'min-h-11 rounded-lg border border-line px-3 py-2 text-fg hover:bg-raised-2 disabled:opacity-55'

function Phrase({ zh, pinyin, tr, voice }) {
  const { l } = useLang()
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <p lang="zh-Hans" className="text-xl leading-relaxed text-fg">{zh}</p>
        <p className="text-sm text-fg-2">{pinyin}</p>
        {tr && <p className="text-sm text-fg-2">{l(tr)}</p>}
      </div>
      <SpeakButton text={zh} voice={voice} />
    </div>
  )
}

function Dialogue({ session, translations, showSpeakers = true }) {
  const { reading, lines } = session
  const passage = lines ? lines.map(i => reading.lines[i]) : reading.lines
  return (
    <ol className="divide-y divide-line">
      {passage.map((line, index) => (
        <li key={index} className="space-y-1 py-3">
          {showSpeakers && line.s && <p lang="zh-Hans" className="text-xs font-medium text-fg-3">{reading.speakers[line.s].zh}</p>}
          <Phrase zh={lineText(line)} pinyin={line.pinyin} voice={lineVoice(reading, line)} tr={translations ? line.tr : null} />
        </li>
      ))}
    </ol>
  )
}

function ToneRecap({ demoDone, onNext }) {
  const { l } = useLang()
  const [expanded, setExpanded] = useState(!demoDone)
  const [answer, setAnswer] = useState(null)
  return (
    <>
      {demoDone && <p className="text-fg-2">{l(text.demo)}</p>}
      {expanded ? (
        <>
          <h3 className="text-lg font-semibold">{l(text.tones)}</h3>
          <p className="text-fg-2">{l(text.toneIntro)}</p>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {TONES.map(tone => (
              <li key={tone.tone} className={card}>
                <div className="flex items-center gap-2">
                  <ToneCurve tone={tone.tone} />
                  <span className="flex-1 font-medium">{l(tone.name)} · m{tone.mark}</span>
                  <SpeakButton src={syllableSrc(`ma${tone.tone}`)} />
                </div>
                <p className="mt-2 text-sm text-fg-2">{l(tone.description)}</p>
              </li>
            ))}
          </ul>
          <section className={`${card} space-y-3`} data-testid="beginner-tone-question">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-medium">{l(text.tonePrompt)}</h4>
              <SpeakButton src={syllableSrc('ma2')} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {TONES.map(({ tone, name }) => (
                <button key={tone} type="button" className={chip} disabled={answer === 2 || answer === tone} onClick={() => setAnswer(tone)}>{l(name)}</button>
              ))}
            </div>
            <div role="status" data-testid="beginner-tone-feedback" data-result={answer ? (answer === 2 ? 'correct' : 'retry') : undefined}>
              {answer && <p className={answer === 2 ? 'text-good' : 'text-warn'}>{l(answer === 2 ? text.correct : text.toneRetry)}</p>}
            </div>
          </section>
          {answer === 2 && <Button onClick={onNext} data-testid="beginner-tone-next">{l(text.read)}</Button>}
        </>
      ) : <Button variant="secondary" onClick={() => setExpanded(true)}>{l(text.tones)}</Button>}
      {demoDone && <Button variant="secondary" onClick={onNext} data-testid="beginner-tone-skip">{l(text.skip)}</Button>}
    </>
  )
}

function Trace({ char }) {
  const { l } = useLang()
  const [run, setRun] = useState(0)
  const [done, setDone] = useState(false)
  return (
    <div className="mt-3 space-y-3">
      <p className="text-sm text-fg-2">{l(text.trace)}</p>
      <HanziBoard key={run} char={char} mode="quiz" outline onComplete={() => setDone(true)} />
      {done && <p role="status" className="text-sm text-good">{l(text.traceDone)}</p>}
      <Button variant="secondary" onClick={() => { setDone(false); setRun(run + 1) }}>{l(text.replay)}</Button>
    </div>
  )
}

function Characters({ chars }) {
  const { l } = useLang()
  const [char, setChar] = useState(null)
  return (
    <section>
      <div className={card}>
        <h3 className="mb-3 text-sm font-medium text-fg-2">{l(text.chars)}</h3>
        <div className="grid grid-cols-5 gap-1.5" data-testid="beginner-characters">
          {[...chars].map(target => (
            <button key={target} type="button" lang="zh-Hans" aria-pressed={char === target} className={`${chip} px-1 text-xl aria-pressed:bg-raised-2`} onClick={() => setChar(char === target ? null : target)}>{target}</button>
          ))}
        </div>
      </div>
      {char && <Trace key={char} char={char} />}
    </section>
  )
}

function Question({ session, index, firstSession, onNext }) {
  const { l } = useLang()
  const question = session.questions[index]
  const [attempt, setAttempt] = useState(null)
  const [hadMistake, setHadMistake] = useState(false)
  const [placed, setPlaced] = useState([])
  const evidence = session.reading.lines[question.line]
  const correct = attempt?.correct === true
  const last = index + 1 === session.questions.length
  const heading = useRef(null)
  useEffect(() => { heading.current?.focus() }, [])

  function answer(value, right) {
    if (!right) setHadMistake(true)
    setAttempt({ value, correct: right })
  }

  function updateOrder(next) {
    setPlaced(next)
    setAttempt(null)
  }

  return (
    <div className="space-y-4" data-testid="beginner-question" data-question={index + 1}>
      <p className="text-sm tabular-nums text-fg-2">{l(text.question)} {index + 1} / {session.questions.length}</p>
      <h3 ref={heading} tabIndex={-1} className="text-xl font-semibold">{l(question.prompt)}</h3>
      <details className={card}>
        <summary className="cursor-pointer text-sm font-medium text-fg-2">{l(text.passage)}</summary>
        <Dialogue session={session} showSpeakers={!firstSession} />
      </details>
      {question.tokens ? (
        <div className="space-y-3">
          <p className="text-sm text-fg-2">{l(text.order)}</p>
          <div className="flex min-h-14 flex-wrap gap-2 rounded-lg border border-dashed border-line p-1.5" data-testid="beginner-placed">
            {placed.map(i => <button key={i} type="button" lang="zh-Hans" className={chip} disabled={correct} onClick={() => updateOrder(placed.filter(j => i !== j))}>{question.tokens[i]}</button>)}
          </div>
          <div className="flex flex-wrap gap-2" data-testid="beginner-tokens">
            {question.tokens.map((token, i) => <button key={token} type="button" lang="zh-Hans" className={chip} disabled={correct || placed.includes(i)} onClick={() => updateOrder([...placed, i])}>{token}</button>)}
          </div>
          {!correct && <Button variant="secondary" disabled={placed.length !== question.tokens.length} onClick={() => answer(null, question.order.every((id, i) => id === placed[i]))} data-testid="beginner-check">{l(text.check)}</Button>}
        </div>
      ) : (
        <div className="grid gap-2" data-testid="beginner-options">
          {question.options.map((option, i) => (
            <button key={i} type="button" className={`${chip} text-start ${attempt?.value === i ? (correct ? 'border-good text-good' : 'border-warn text-warn') : 'bg-raised'}`} disabled={correct || attempt?.value === i} onClick={() => answer(i, i === question.answer)}>{l(option)}</button>
          ))}
        </div>
      )}
      <div role="status" aria-live="polite" data-testid="beginner-feedback" data-result={attempt ? (correct ? 'correct' : 'retry') : undefined}>
        {attempt && (
          <div className={`${card} space-y-2`}>
            <p className={correct ? 'font-medium text-good' : 'font-medium text-warn'}>{l(correct ? text.correct : text.retry)}</p>
            <Phrase zh={lineText(evidence)} pinyin={evidence.pinyin} voice={lineVoice(session.reading, evidence)} tr={correct ? evidence.tr : null} />
          </div>
        )}
      </div>
      {correct && <Button onClick={() => onNext(!hadMistake)} data-testid="beginner-question-next">{l(last ? text.finish : text.next)}</Button>}
    </div>
  )
}

function Session({ session, number, demoDone, onFinish }) {
  const { l } = useLang()
  const [stage, setStage] = useState(number === 1 ? 'tones' : 'intro')
  const [translations, setTranslations] = useState(false)
  const [index, setIndex] = useState(0)
  const [firstTryCount, setFirstTryCount] = useState(0)
  const heading = useRef(null)
  useEffect(() => {
    if (stage !== 'questions') heading.current?.focus()
  }, [stage])

  function nextQuestion(firstTry) {
    const firstTries = firstTryCount + Number(firstTry)
    if (index + 1 === session.questions.length) {
      onFinish(firstTries / session.questions.length)
    } else {
      setFirstTryCount(firstTries)
      setIndex(index + 1)
    }
  }

  return (
    <section className="space-y-4" data-testid="beginner-session" data-session={number} data-stage={stage}>
      <h2 ref={heading} tabIndex={-1} className="text-2xl font-semibold">{l(session.title)}</h2>
      <p className="text-fg-2">{l(session.goal)}</p>
      {stage === 'tones' && <ToneRecap demoDone={demoDone} onNext={() => setStage('intro')} />}
      {stage === 'intro' && (
        <>
          <Characters chars={session.chars} />
          <p className={card}>{l(session.note)}</p>
          <Button variant="secondary" aria-expanded={translations} onClick={() => setTranslations(!translations)}>{l(translations ? text.hideTranslation : text.translation)}</Button>
          <Dialogue session={session} translations={translations} />
          <Button onClick={() => setStage('questions')} data-testid="beginner-practice">{l(text.practice)}</Button>
        </>
      )}
      {stage === 'questions' && <Question key={index} session={session} index={index} firstSession={number === 1} onNext={nextQuestion} />}
    </section>
  )
}

function SessionList({ completed }) {
  const { l } = useLang()
  return (
    <ol className="mt-4 divide-y divide-line rounded-xl border border-line px-4" data-testid="beginner-session-list">
      {BEGINNER_SESSIONS.map((session, i) => {
        const done = i < completed
        const current = i === completed
        return (
          <li key={session.chars} className="flex items-center gap-3 py-3" aria-current={current ? 'step' : undefined} data-state={done ? 'done' : current ? 'current' : 'locked'}>
            <span className="grid size-8 shrink-0 place-items-center rounded-full border border-line text-sm tabular-nums">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-fg">{l(session.title)}</p>
              <p className="text-sm text-fg-2">{l(done ? text.done : current ? session.goal : text.locked)}</p>
            </div>
            {done ? <Check {...ICON_SM} className="shrink-0 text-good" /> : current ? <ChevronRight {...ICON_SM} className="shrink-0 text-fg-2" /> : <Lock {...ICON_SM} className="shrink-0 text-fg-3" />}
          </li>
        )
      })}
    </ol>
  )
}

function Finale({ onOffer, onUpgrade, onBack, onFullDialogue }) {
  const { l } = useLang()
  const heading = useRef(null)
  const offered = useRef(false)
  useEffect(() => { heading.current?.focus() }, [])
  useEffect(() => {
    if (offered.current || onFullDialogue) return
    offered.current = true
    onOffer?.()
  }, [onOffer, onFullDialogue])
  return (
    <section className="space-y-4" data-testid="beginner-finale">
      <h2 ref={heading} tabIndex={-1} className="text-2xl font-semibold">{l(text.finale)}</h2>
      <p className="text-fg-2">{l(text.finaleDetail)}</p>
      <section className={`${card} space-y-3`}>
        <h3 className="font-semibold">{l(text.excerpt)}</h3>
        <Phrase {...FREE_NEXT_EXCERPTS.wenlu} />
      </section>
      <Button onClick={onFullDialogue || onUpgrade} data-testid="beginner-upgrade">
        {onFullDialogue ? l(FREE_NEXT_EXCERPTS.wenlu.title) : l(text.plus)}
      </Button>
      <Button variant="secondary" onClick={onBack} data-testid="beginner-reviews">{l(text.reviews)}</Button>
    </section>
  )
}

export function BeginnerPath({ completed, demoDone, onComplete, onBack, onUpgrade, onOffer, onFullDialogue, progressMap, applyUpdates }) {
  const { l } = useLang()
  const [active, setActive] = useState(null)
  const [justFinished, setJustFinished] = useState(0)
  const count = Math.max(completed, justFinished)
  const total = BEGINNER_SESSIONS.length

  function finish(pct) {
    const next = active + 1
    const session = BEGINNER_SESSIONS[active]
    // Only full-dialogue comprehension is scored in the reading module; retries don't inflate the score.
    if (!session.lines) {
      applyUpdates([applyLessonResult(getReadingProgress(progressMap, session.reading), pct)])
    }
    setActive(null)
    setJustFinished(next)
    if (next > completed) onComplete(next)
  }

  return (
    <Screen>
      <TopBar title={l(text.title)} onBack={onBack} aside={`${count} / ${total}`} />
      <main className="space-y-5 px-5 pb-8 pt-2" data-testid="beginner-path">
        <ProgressBar value={count / total} />
        {count === total ? <Finale onOffer={onOffer} onUpgrade={onUpgrade} onBack={onBack} onFullDialogue={onFullDialogue} /> : active !== null ? (
          <Session key={active} session={BEGINNER_SESSIONS[active]} number={active + 1} demoDone={demoDone} onFinish={finish} />
        ) : (
          <>
            {justFinished > 0 && <div role="status" className={card}>
              <h2 className="font-semibold text-good">{l(text.complete)}</h2>
              <p className="text-sm text-fg-2">{l(text.completeDetail)}</p>
            </div>}
            <p className="text-fg-2">{l(text.overview)}</p>
            <SessionList completed={count} />
            <Button onClick={() => setActive(count)} data-testid="beginner-start">{l(justFinished ? text.nextSession : count ? text.resume : text.start)}</Button>
          </>
        )}
      </main>
    </Screen>
  )
}
