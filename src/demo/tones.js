import { createPlayer } from './public-page.js'

const TONES = ['plat et haut (mā)', 'montant (má)', 'bas, puis remontant en isolation (mǎ)', 'descendant (mà)']
const src = tone => `/audio/syllables/ma${tone}.mp3`

export function setupToneQuiz({ answer, onStart, onSolved }) {
  const feedback = document.querySelector('[data-tone-feedback]')
  const mystery = document.querySelector('[data-tone-question]')
  const choices = [...document.querySelectorAll('[data-tone-answer]')]
  const play = createPlayer(() => { feedback.textContent = 'Impossible de lire ce son. Réessaie.' })
  let started = false

  function compare(tone) {
    if (!started) {
      started = true
      onStart?.()
    }
    return play(src(tone))
  }

  for (const button of document.querySelectorAll('[data-tone-example]')) {
    button.disabled = false
    button.addEventListener('click', () => compare(button.dataset.toneExample))
  }
  mystery.disabled = false
  mystery.addEventListener('click', async () => {
    if (await compare(answer) && !mystery.hasAttribute('data-solved')) {
      feedback.textContent = 'Quel mouvement as-tu entendu ?'
      for (const button of choices) {
        button.disabled = false
        button.removeAttribute('data-wrong')
      }
    }
  })
  for (const button of choices) {
    button.addEventListener('click', () => {
      if (mystery.hasAttribute('data-solved')) return
      const correct = Number(button.dataset.toneAnswer) === answer
      for (const choice of choices) choice.removeAttribute('data-wrong')
      if (!correct) {
        button.setAttribute('data-wrong', '')
        feedback.textContent = 'Pas tout à fait. Réécoute le son mystère et compare avec les exemples.'
        return
      }
      button.setAttribute('data-correct', '')
      mystery.setAttribute('data-solved', '')
      for (const choice of choices) choice.setAttribute('aria-disabled', 'true')
      feedback.setAttribute('data-success', '')
      feedback.textContent = `Bravo ! Tu as reconnu le ton ${answer}, ${TONES[answer - 1]}.`
      onSolved?.()
    })
  }
}
