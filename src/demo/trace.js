import HanziWriter from 'hanzi-writer'

const SIZE = 272

export function setupTrace(onComplete) {
  const board = document.querySelector('[data-trace-board]')
  const replay = document.querySelector('[data-trace-guide]')
  const feedback = document.querySelector('[data-trace-feedback]')
  const writer = HanziWriter.create(board, '人', {
    width: SIZE,
    height: SIZE,
    padding: 20,
    showCharacter: false,
    showOutline: true,
    outlineColor: '#c6b8a6',
    strokeColor: '#285743',
    highlightColor: '#b91c1c',
    highlightCompleteColor: '#285743',
    drawingColor: '#1f1b16',
    delayBetweenStrokes: 250,
    charDataLoader: (char, onLoad, onError) => {
      fetch(`/hanzi/${encodeURIComponent(char)}.json`)
        .then(response => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          return response.json()
        })
        .then(onLoad, onError)
    },
  })
  board.querySelector('svg').setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`)

  function startQuiz() {
    feedback.removeAttribute('data-success')
    feedback.textContent = 'À toi : commence par le trait qui descend vers la gauche.'
    return writer.quiz({
      leniency: 1.25,
      showHintAfterMisses: 1,
      onCorrectStroke: ({ strokesRemaining }) => {
        if (strokesRemaining) feedback.textContent = 'Premier trait réussi ! Descends maintenant vers la droite.'
      },
      onMistake: ({ strokeNum, isBackwards }) => {
        feedback.textContent = isBackwards ? 'Repars du haut du trait.' : `Suis le trait indiqué : vers la ${strokeNum === 0 ? 'gauche' : 'droite'}.`
      },
      onComplete: () => {
        feedback.setAttribute('data-success', '')
        feedback.textContent = 'Bravo ! Tu as tracé 人 dans le bon ordre.'
        onComplete()
      },
    })
  }

  function showLoadError() {
    feedback.textContent = 'Le modèle de tracé n’a pas pu se charger. Recharge la page pour réessayer.'
  }
  startQuiz().then(() => { replay.disabled = false }, showLoadError)
  replay.addEventListener('click', async () => {
    replay.disabled = true
    feedback.removeAttribute('data-success')
    feedback.textContent = 'Observe : d’abord vers la gauche, puis vers la droite.'
    try {
      await writer.animateCharacter()
      await startQuiz()
      replay.disabled = false
    } catch {
      showLoadError()
    }
  })
}
