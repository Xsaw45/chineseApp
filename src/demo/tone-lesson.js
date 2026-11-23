import { capture } from '../analytics.js'
import { initPublicPage } from './public-page.js'
import { setupToneQuiz } from './tones.js'

initPublicPage('tons_chinois')
setupToneQuiz({
  answer: 1 + Math.floor(Math.random() * 4),
  onSolved: () => capture('public_tone_exercise_completed'),
})
