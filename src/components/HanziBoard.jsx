import { useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import HanziWriter from 'hanzi-writer'
import { strokeDataUrl } from '../data/hanzi.js'
import { useLang } from '../i18n/useLang.js'
import { ICON } from './uiStyles.js'

// Hanzi Writer attend des couleurs hexadécimales : celles du thème (index.css).
function themeColor(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim()
}

function loadCharData(char, onLoad, onError) {
  fetch(strokeDataUrl(char))
    .then(res => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
    .then(onLoad, onError)
}

/**
 * Case d'écriture (田字格) avec Hanzi Writer.
 * mode 'animate' : montre l'ordre des traits (relancé quand runKey change), clé en couleur si showRadical.
 * mode 'quiz' : le caractère se trace au doigt ; outline affiche le modèle ; onMistake(total), onComplete(total).
 */
const SPEEDS = [0.5, 1, 1.5, 2]
const STROKE_DURATION = 800
function drawPlayerPosition({ main, paths }, value) {
  if (!main || paths.length === 0) return
  main.style.opacity = '1'
  main.style.removeProperty('display')
  paths.forEach((path, index) => {
    const portion = Math.max(0, Math.min(1, value - index))
    const length = Number.parseFloat(path.getAttribute('stroke-dasharray')) || 0
    path.style.opacity = portion > 0 ? '1' : '0'
    path.style.strokeDashoffset = String(length * 0.999 * (1 - portion))
  })
}


export function HanziBoard({
  char,
  mode,
  outline = false,
  showRadical = false,
  controls = false,
  strokeCount = 0,
  onReplay,
  onMistake,
  onComplete,
}) {
  const { t } = useLang()
  const ref = useRef(null)
  const player = useRef({ main: null, paths: [] })
  const positionRef = useRef(0)
  const [size] = useState(() => Math.min(300, window.innerWidth - 40)) // toute la largeur utile, 300 px au plus
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(!controls)
  const [playing, setPlaying] = useState(controls && mode === 'animate')
  const [position, setPosition] = useState(0)
  const [speed, setSpeed] = useState(1)
  // Rappels lus au moment de l'événement : la case n'est pas recréée quand le parent change ses fonctions.
  const callbacks = useRef({})
  useEffect(() => {
    callbacks.current = { onMistake, onComplete }
  })


  useEffect(() => {
    const el = ref.current
    let disposed = false
    const writer = HanziWriter.create(el, char, {
      width: size,
      height: size,
      padding: 12,
      showCharacter: false,
      showOutline: mode === 'animate' || outline,
      strokeColor: themeColor('fg'),
      radicalColor: showRadical ? themeColor('accent') : null,
      outlineColor: themeColor('raised-2'),
      highlightColor: themeColor('accent'),
      drawingColor: themeColor('fg-2'),
      drawingWidth: 6,
      strokeAnimationSpeed: 1.2,
      delayBetweenStrokes: 200,
      charDataLoader: loadCharData,
      onLoadCharDataError: () => setFailed(true),
    })
    if (mode === 'animate' && controls) {
      writer.hideCharacter({ duration: 0 }).then(() => {
        if (disposed) return
        const svg = el.querySelector('svg')
        const positioned = [...(svg?.children || [])].find(node => node.tagName.toLowerCase() === 'g')
        const layers = [...(positioned?.children || [])].filter(node => node.tagName.toLowerCase() === 'g')
        const main = layers[1] || null
        const paths = [...(main?.children || [])].filter(node => node.tagName.toLowerCase() === 'path')
        player.current = { main, paths }
        drawPlayerPosition(player.current, positionRef.current)
        setReady(paths.length === strokeCount)
      })
    } else if (mode === 'animate') {
      writer.animateCharacter()
    } else {
      writer.quiz({
        showHintAfterMisses: 3,
        onMistake: data => callbacks.current.onMistake?.(data.totalMistakes),
        onComplete: data => callbacks.current.onComplete?.(data.totalMistakes),
      })
    }
    return () => {
      disposed = true
      writer.cancelQuiz()
      writer.pauseAnimation()
      el.replaceChildren()
    }
  }, [char, mode, outline, showRadical, controls, strokeCount, size])

  useEffect(() => {
    if (!controls || !ready || !playing || strokeCount === 0) return
    let frame
    let previous
    let lastUiUpdate = 0
    const tick = now => {
      previous ??= now
      const next = Math.min(strokeCount, positionRef.current + ((now - previous) * speed) / STROKE_DURATION)
      previous = now
      positionRef.current = next
      drawPlayerPosition(player.current, next)
      if (next >= strokeCount) {
        setPosition(strokeCount)
        setPlaying(false)
        return
      }
      if (now - lastUiUpdate >= 50) {
        lastUiUpdate = now
        setPosition(next)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [controls, playing, ready, speed, strokeCount])

  const seek = value => {
    const next = Math.max(0, Math.min(strokeCount, Number(value)))
    positionRef.current = next
    setPosition(next)
    setPlaying(false)
    drawPlayerPosition(player.current, next)
  }

  const togglePlayback = () => {
    if (playing) {
      setPosition(positionRef.current)
      setPlaying(false)
      return
    }
    if (positionRef.current >= strokeCount) {
      positionRef.current = 0
      setPosition(0)
      drawPlayerPosition(player.current, 0)
    }
    setPlaying(true)
  }

  const currentStroke = position === 0 ? 0 : Math.min(strokeCount, Math.ceil(position))

  return (
    <div>
      <div className="relative mx-auto touch-none select-none rounded-2xl border border-line bg-card" style={{ width: size, height: size }}>
        <svg className="pointer-events-none absolute inset-0 text-line-2" width={size} height={size} aria-hidden="true">
          <g stroke="currentColor" strokeWidth="1" strokeDasharray="4 6">
            <line x1="0" y1={size / 2} x2={size} y2={size / 2} />
            <line x1={size / 2} y1="0" x2={size / 2} y2={size} />
            <line x1="0" y1="0" x2={size} y2={size} />
            <line x1={size} y1="0" x2="0" y2={size} />
          </g>
        </svg>
        {failed ? (
          <p className="hanzi-display absolute inset-0 flex items-center justify-center text-[160px] leading-none text-fg">{char}</p>
        ) : (
          <div ref={ref} className="absolute inset-0" />
        )}
      </div>

      {controls && mode === 'animate' && (
        <div className="mx-auto mt-4 w-full max-w-[300px] rounded-2xl border border-line bg-card p-4">
          <div className="relative h-5">
            <input
              type="range"
              min="0"
              max={strokeCount}
              step="0.01"
              value={position}
              disabled={!ready || failed}
              onChange={event => seek(event.target.value)}
              aria-label={t('hz.timeline')}
              aria-valuetext={t('hz.strokePosition', { current: currentStroke, total: strokeCount })}
              className="absolute top-1/2 left-0 z-10 h-2 w-full -translate-y-1/2 cursor-pointer accent-accent disabled:cursor-not-allowed disabled:opacity-50"
            />
            <div className="pointer-events-none absolute inset-x-[2px] top-1/2 z-20 h-3 -translate-y-1/2" aria-hidden="true">
              {Array.from({ length: Math.max(0, strokeCount - 1) }, (_, index) => index + 1).map(stroke => (
                <span
                  key={stroke}
                  className="absolute top-0 h-3 w-px -translate-x-1/2 bg-page"
                  style={{ left: `${(stroke / strokeCount) * 100}%` }}
                />
              ))}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                disabled={!ready || failed}
                onClick={togglePlayback}
                aria-label={t(playing ? 'hz.pause' : 'hz.play')}
                className="inline-flex size-10 items-center justify-center rounded-full bg-seal text-white transition-opacity disabled:opacity-40"
              >
                {playing ? <Pause {...ICON} /> : <Play {...ICON} />}
              </button>
              <button
                type="button"
                disabled={!ready || failed}
                onClick={onReplay}
                aria-label={t('hz.replay')}
                className="inline-flex size-10 items-center justify-center rounded-full border border-line bg-page text-fg transition-colors hover:bg-raised disabled:opacity-40"
              >
                <RotateCcw {...ICON} />
              </button>
            </div>
            <p className="min-w-0 flex-1 text-sm tabular-nums text-fg-2">
              {t('hz.strokePosition', { current: currentStroke, total: strokeCount })}
            </p>
            <label className="flex items-center gap-2 text-sm text-fg-2">
              <span className="sr-only">{t('hz.speed')}</span>
              <select
                value={speed}
                onChange={event => setSpeed(Number(event.target.value))}
                aria-label={t('hz.speed')}
                className="h-9 rounded-lg border border-line bg-page px-2 text-sm text-fg outline-none"
              >
                {SPEEDS.map(value => <option key={value} value={value}>{value}×</option>)}
              </select>
            </label>
          </div>
        </div>
      )}
    </div>
  )
}
