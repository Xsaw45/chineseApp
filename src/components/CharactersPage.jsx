import { useLayoutEffect, useRef, useState } from 'react'
import { ChevronRight, Lock } from 'lucide-react'
import { HANZI, HANZI_LEVELS, charsForLevel, getChar, hanziLevelLabel } from '../data/hanzi.js'
import { canOpenModule, canUseHanzi, canUseHanziLevel } from '../access/rules.js'
import { HANZI_PRACTICE_SIZE, buildHanziPractice, currentHanziLevel, getCharProgress } from '../utils/hanziQuiz.js'
import { isDueForReview } from '../utils/spacedrep.js'
import { useLang } from '../i18n/useLang.js'
import { CharacterDetail } from './CharacterDetail.jsx'
import { CharacterPractice } from './CharacterPractice.jsx'
import { RadicalsPage } from './RadicalsPage.jsx'
import { Button, PlusBadge, Screen, TopBar } from './ui.jsx'
import { ICON } from './uiStyles.js'

/**
 * Case de la grille : bordure verte maîtrisé, orange à réviser, trait d'avancement en cours d'apprentissage ;
 * locked : caractère Yidiano+ vu depuis la formule gratuite (estompé, cadenas, ouvre Yidiano+).
 */
function CharTile({ ch, progress, locked, onOpen }) {
  const { t } = useLang()
  const state = progress.known ? (isDueForReview(progress) ? 'due' : 'known') : progress.successCount > 0 ? 'learning' : 'new'
  const border = { known: 'border-good/40', due: 'border-warn/60', learning: 'border-line-2', new: 'border-line' }[state]
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`relative flex aspect-square items-center justify-center rounded-xl border transition-colors duration-150 ease-out hover:bg-raised ${locked ? 'border-line bg-page' : `bg-card ${border}`}`}
    >
      <span className={`hanzi-display text-[28px] leading-none ${locked ? 'text-fg-3/60' : state === 'known' ? 'text-fg-2' : 'text-fg'}`}>{ch.c}</span>
      {locked && <Lock size={11} strokeWidth={2} className="absolute top-1.5 right-1.5 text-fg-3" aria-label={t('plus.locked')} />}
      {!locked && state === 'learning' && (
        <span className="absolute inset-x-2 bottom-1.5 h-0.5 overflow-hidden rounded-full bg-raised-2">
          <span className="block h-full bg-accent" style={{ width: `${(progress.successCount / 3) * 100}%` }} />
        </span>
      )}
    </button>
  )
}

export function CharactersPage({ hasPlus, onUpgrade, progressMap, applyUpdates, onBack }) {
  const { t } = useLang()
  // Niveau affiché : le niveau en cours, limité au HSK 1 en accès gratuit (et à ses premiers caractères, FREE_HANZI).
  const [level, setLevel] = useState(() => hasPlus ? currentHanziLevel(progressMap) : 1)
  const candidates = HANZI.filter(ch => canUseHanzi(ch, hasPlus))
  const radicalsOpen = canOpenModule('radicals', hasPlus)
  // 'list' | 'radicals' | { char } | { practice, id }
  const [view, setView] = useState('list')

  // Retour à la grille : elle reprend où on l'avait laissée ; les autres écrans s'ouvrent en haut.
  const listScroll = useRef(0)
  const open = next => {
    if (view === 'list') listScroll.current = window.scrollY
    setView(next)
  }
  useLayoutEffect(() => {
    window.scrollTo(0, view === 'list' ? listScroll.current : 0)
  }, [view])

  const toList = () => setView('list')
  const startPractice = () => open({ practice: buildHanziPractice(progressMap, level, candidates), id: (view.id ?? 0) + 1 })

  if (view.char) return <CharacterDetail ch={getChar(view.char)} onBack={toList} />
  if (view === 'radicals' && radicalsOpen) return <RadicalsPage progressMap={progressMap} applyUpdates={applyUpdates} onBack={toList} />
  if (view.practice) {
    return (
      <CharacterPractice
        key={view.id}
        items={view.practice}
        progressMap={progressMap}
        applyUpdates={applyUpdates}
        onExit={toList}
        onRestart={startPractice}
      />
    )
  }

  const chars = charsForLevel(level)
  const usable = chars.filter(ch => canUseHanzi(ch, hasPlus))
  const known = usable.filter(ch => getCharProgress(progressMap, ch).known).length
  const canPractice = buildHanziPractice(progressMap, level, candidates).length > 0

  return (
    <Screen>
      <TopBar onBack={onBack} title={<>{t('hz.title')} <span className="chinese-text text-fg-2">汉字</span></>} bordered />

      <div className="border-b border-line px-5 py-6">
        <p className="text-[15px] leading-relaxed text-fg">{t('hz.intro')}</p>
        <div className="-mx-5 mt-5 flex gap-2 overflow-x-auto px-5 pb-1">
          {HANZI_LEVELS.map(lv => (
            <button
              key={lv}
              type="button"
              onClick={() => {
                if (!canUseHanziLevel(lv, hasPlus)) onUpgrade()
                else setLevel(lv)
              }}
              aria-pressed={lv === level}
              className={`h-9 shrink-0 rounded-full border px-4 text-sm transition-colors duration-150 ease-out ${
                lv === level ? 'border-seal bg-seal text-white' : 'border-line bg-card text-fg-2 hover:bg-raised'
              }`}
            >
              {hanziLevelLabel(lv)}
              {!canUseHanziLevel(lv, hasPlus) && <Lock size={13} className="ml-1 inline" aria-label={t('plus.locked')} />}
            </button>
          ))}
        </div>
        <Button onClick={startPractice} disabled={!canPractice} className="mt-5">{t('hz.practice', { n: HANZI_PRACTICE_SIZE })}</Button>
        <p className="mt-3 text-center text-sm tabular-nums text-fg-3">
          {canPractice ? t('hz.progress', { known, total: usable.length }) : t('hz.allDone')}
        </p>
      </div>

      <div className="flex-1 px-5 pb-8">
        <button
          type="button"
          onClick={() => radicalsOpen ? open('radicals') : onUpgrade()}
          className={`mt-6 flex w-full items-center gap-3 rounded-2xl border border-line p-4 text-left transition-colors duration-150 ease-out hover:bg-raised ${radicalsOpen ? 'bg-card' : 'bg-page'}`}
        >
          <span className={`hanzi-display text-2xl ${radicalsOpen ? 'text-accent' : 'text-fg-3'}`}>氵讠扌</span>
          <span className={`flex-1 text-[15px] font-medium ${radicalsOpen ? 'text-fg' : 'text-fg-2'}`}>{t('hz.radicals')} <span className="chinese-text text-fg-2">部首</span></span>
          {radicalsOpen ? <ChevronRight {...ICON} className="text-fg-3" /> : <PlusBadge />}
        </button>

        {!hasPlus && <p className="mt-6 text-sm text-fg-3">{t('hz.freeLimit', { n: usable.length })}</p>}
        <div className={`grid grid-cols-6 gap-2 ${hasPlus ? 'mt-6' : 'mt-3'}`}>
          {chars.map(ch => {
            const locked = !canUseHanzi(ch, hasPlus)
            return (
              <CharTile
                key={ch.c}
                ch={ch}
                progress={getCharProgress(progressMap, ch)}
                locked={locked}
                onOpen={() => locked ? onUpgrade() : open({ char: ch.c })}
              />
            )
          })}
        </div>
      </div>
    </Screen>
  )
}
