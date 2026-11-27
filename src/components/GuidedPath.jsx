import { useLang } from '../i18n/useLang.js'
import { canUseStep, pathState, stepProgress, stepTarget } from '../utils/path.js'

const TEXT = {
  fr: {
    title: 'Parcours guidé', intro: 'Avance à ton rythme, étape par étape.',
    complete: 'Parcours terminé', current: 'À suivre', done: 'Terminé', upcoming: 'À venir',
    start: 'Continuer le parcours', upgrade: 'Découvrir Yidiano+', unavailable: 'Contenu momentanément indisponible',
    pinyin: 'Pinyin', hanzi: 'Caractères', words: 'Vocabulaire', grammar: 'Grammaire', reading: 'Lecture',
  },
  en: {
    title: 'Guided path', intro: 'Learn at your own pace, one step at a time.',
    complete: 'Path completed', current: 'Up next', done: 'Completed', upcoming: 'Coming up',
    start: 'Continue the path', upgrade: 'Discover Yidiano+', unavailable: 'Content temporarily unavailable',
    pinyin: 'Pinyin', hanzi: 'Characters', words: 'Vocabulary', grammar: 'Grammar', reading: 'Reading',
  },
}

export function GuidedPath({ hasPlus, progressMap, onStartStep, onUpgrade }) {
  const { lang, l } = useLang()
  const text = TEXT[lang] ?? TEXT.en
  const state = pathState(progressMap, hasPlus)

  return (
    <section className="space-y-4 rounded-2xl border border-line bg-card p-4" aria-label={text.title}>
      <div>
        <h2 className="text-lg font-medium text-fg">{text.title}</h2>
        <p className="text-sm text-fg-2">{text.intro}</p>
        <p className="mt-1 text-sm tabular-nums text-fg-2">{state.done} / {state.total}</p>
      </div>
      {state.current ? (
        state.current.locked ? (
          hasPlus ? <p className="text-sm text-fg-2">{text.unavailable}</p> :
            <button type="button" className="rounded-xl bg-seal px-4 py-2 text-sm font-medium text-white" onClick={onUpgrade}>{text.upgrade}</button>
        ) : (
          <button type="button" className="rounded-xl bg-seal px-4 py-2 text-sm font-medium text-white" onClick={() => onStartStep(state.current.unit, state.current.step)}>{text.start}</button>
        )
      ) : <p className="text-sm font-medium text-fg">{text.complete}</p>}
      <ol className="space-y-4">
        {state.units.map(({ unit, done, total }) => (
          <li key={unit.id}>
            <div className="flex items-center justify-between gap-3 font-medium text-fg">
              <h3>{l(unit.title)}{unit.plus ? ' · Yidiano+' : ''}</h3>
              <span className="text-sm tabular-nums text-fg-2">{done} / {total}</span>
            </div>
            {state.current?.unit.id === unit.id && <ol className="mt-2 divide-y divide-line border-t border-line">
              {unit.steps.map(step => {
                const progress = stepProgress(progressMap, step)
                const current = state.current?.step.id === step.id
                const target = stepTarget(step)
                const locked = !canUseStep(unit, step, hasPlus)
                const detail = target?.title ? l(target.title) : step.kind === 'hanzi' ? step.chars.map(ch => ch.c).join(' ') : null
                return (
                  <li key={step.id} className="flex items-start justify-between gap-3 py-2 text-sm" aria-current={current ? 'step' : undefined}>
                    <span className={current ? 'font-medium text-fg' : 'text-fg-2'}>
                      {text[step.kind]}{detail ? ` · ${detail}` : ''}
                      {(step.kind === 'hanzi' || step.kind === 'words') && ` (${progress.value}/${progress.goal})`}
                    </span>
                    <span className="shrink-0 text-xs text-fg-3">{progress.done ? text.done : current ? text.current : locked ? (hasPlus ? text.unavailable : 'Yidiano+') : text.upcoming}</span>
                  </li>
                )
              })}
            </ol>}
          </li>
        ))}
      </ol>
    </section>
  )
}
