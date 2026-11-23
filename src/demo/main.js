import { capture } from '../analytics.js'
import { initPublicPage } from './public-page.js'
import { setupToneQuiz } from './tones.js'
import { setupTrace } from './trace.js'

initPublicPage('demo')

const trace = document.querySelector('[data-trace]')
const goTrace = document.querySelector('[data-go-trace]')
const save = document.querySelector('[data-demo-save]')
const saveArea = document.querySelector('[data-save-area]')
const saveError = document.querySelector('[data-save-error]')
let completed = false
let saved = false

setupToneQuiz({
  answer: 2,
  onStart: () => capture('demo_started'),
  onSolved: () => {
    capture('demo_tone_completed')
    goTrace.hidden = false
    trace.hidden = false
    setupTrace(() => {
      if (completed) return
      completed = true
      saveArea.hidden = false
      capture('demo_completed')
    })
  },
})

goTrace.addEventListener('click', () => trace.querySelector('h2').focus({ preventScroll: true }))
save.addEventListener('click', event => {
  if (!completed) {
    event.preventDefault()
    return
  }
  if (saved) return
  try {
    const key = 'yidiano.demo.completed'
    if (localStorage.getItem(key) !== '1') localStorage.setItem(key, '1')
  } catch {
    event.preventDefault()
    saveError.hidden = false
    return
  }
  saved = true
  capture('demo_save_clicked', undefined, { transport: 'sendBeacon', send_instantly: true })
})
