import { CLIENT_CONTENT } from 'virtual:yidiano-content'
import { lineText, lineVoice } from '../data/readingLines.js'
import { ttsFile } from '../data/voices.js'
import { createPlayer, initPublicPage } from './public-page.js'

initPublicPage('dialogue_chinois')

const reading = CLIENT_CONTENT.readings.find(entry => entry.id === 'jieshao')
const lines = document.querySelector('[data-dialogue-lines]')
const status = document.querySelector('[data-dialogue-status]')
const play = createPlayer(() => { status.textContent = 'Impossible de lire cette réplique. Réessaie.' })

function element(tag, className, text, lang) {
  const node = document.createElement(tag)
  node.className = className
  node.textContent = text
  if (lang) node.lang = lang
  return node
}

for (const [index, line] of reading.lines.entries()) {
  const zh = lineText(line)
  const li = document.createElement('li')
  const text = document.createElement('div')
  const speaker = reading.speakers[line.s]
  const pinyin = element('p', 'muted', line.pinyin, 'zh-Latn')
  pinyin.setAttribute('data-pinyin', '')
  const translation = element('p', 'muted', line.tr.fr)
  translation.setAttribute('data-translation', '')
  translation.hidden = true
  text.append(
    element('p', 'speaker', speaker.pinyin, 'zh-Latn'),
    element('p', 'hanzi-line', zh, 'zh-Hans'),
    pinyin,
    translation,
  )
  const button = element('button', 'control', 'Écouter')
  button.type = 'button'
  button.setAttribute('aria-label', `Écouter la réplique ${index + 1} de ${speaker.pinyin}`)
  button.setAttribute('data-dialogue-play', String(index + 1))
  button.addEventListener('click', () => {
    status.textContent = ''
    play(`/audio/tts/${ttsFile(zh, lineVoice(reading, line))}`)
  })
  li.append(text, button)
  lines.append(li)
}

for (const button of document.querySelectorAll('[data-dialogue-toggle]')) {
  const items = lines.querySelectorAll(`[data-${button.dataset.dialogueToggle}]`)
  button.addEventListener('click', () => {
    const show = button.getAttribute('aria-pressed') === 'false'
    button.setAttribute('aria-pressed', String(show))
    for (const item of items) item.hidden = !show
  })
  button.disabled = false
}
