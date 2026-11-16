import HanziWriter from 'hanzi-writer'
import './landing.css'

// Le nom s'écrit tout seul dans le cahier : 一 puis 点, trait par trait, la clé de 点 (灬) en rouge,
// comme l'animation de l'ordre des traits dans l'app. Sans animation (prefers-reduced-motion) : caractères tracés.
const INK = '#1f1b16'
const SEAL = '#dc2626'
const OUTLINE = '#e6ddcf'
const PAUSE_MS = 2400

const loadCharData = (char, onLoad, onError) => {
  fetch(`/hanzi/${encodeURIComponent(char)}.json`)
    .then(res => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
    .then(onLoad, onError)
}

const cells = [...document.querySelectorAll('[data-write]')]
const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const writers = cells.map(cell => {
  const target = cell.querySelector('[data-writer]')
  const size = Math.round(cell.getBoundingClientRect().width)
  const writer = HanziWriter.create(target, cell.dataset.write, {
    width: size,
    height: size,
    padding: Math.round(size * 0.08),
    showCharacter: still,
    showOutline: true,
    strokeColor: INK,
    radicalColor: 'radical' in cell.dataset ? SEAL : null,
    outlineColor: OUTLINE,
    strokeAnimationSpeed: 1,
    delayBetweenStrokes: 160,
    charDataLoader: loadCharData,
  })
  // La case suit la largeur de la page (rotation, redimensionnement) : le dessin garde ses proportions.
  const svg = target.querySelector('svg')
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`)
  svg.style.width = '100%'
  svg.style.height = '100%'
  return writer
})

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

async function writeLoop() {
  for (;;) {
    for (const writer of writers) await writer.animateCharacter()
    await wait(PAUSE_MS)
    await Promise.all(writers.map(writer => writer.hideCharacter()))
    await wait(400)
  }
}

if (!still && writers.length) writeLoop()
