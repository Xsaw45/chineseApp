import { consent, initAnalytics, setConsent } from '../analytics.js'
import { keepCampaign } from './campaign.js'
import '../landing/landing.css'
import './public-page.css'

export function initPublicPage(surface) {
  keepCampaign()
  initAnalytics(surface)

  const settings = document.querySelector('[data-consent-open]')
  const banner = document.createElement('aside')
  banner.className = 'consent-panel'
  banner.setAttribute('aria-label', 'Mesure d’audience')
  banner.hidden = consent() !== null
  banner.innerHTML = `
    <p>Accepter la mesure d’audience nous aide à améliorer Yidiano : pages vues, étapes du parcours et parfois
    l’enregistrement d’une visite, champs de saisie masqués. Hébergée dans l’UE, sans publicité.
    <a href="/legal/confidentialite.html#mesure-audience">En savoir plus</a></p>
    <div class="actions"><button class="control" type="button" data-choice="denied">Refuser</button>
    <button class="control" type="button" data-choice="granted">Accepter</button></div>`
  document.body.append(banner)
  for (const choice of banner.querySelectorAll('[data-choice]')) {
    choice.addEventListener('click', () => {
      setConsent(choice.dataset.choice)
      banner.hidden = true
      if (banner.contains(document.activeElement) && settingsWasOpened) settings.focus({ preventScroll: true })
      settingsWasOpened = false
    })
  }
  let settingsWasOpened = false
  settings.addEventListener('click', () => {
    banner.hidden = false
    settingsWasOpened = true
    banner.querySelector('button').focus({ preventScroll: true })
  })
  settings.hidden = false
}

// Unique lecteur : un nouvel exemple interrompt le précédent. Aucun fichier avant un geste.
export function createPlayer(onError) {
  const audio = new Audio()
  let request = 0
  audio.addEventListener('error', onError)
  return function playRecording(src) {
    const current = ++request
    if (audio.getAttribute('src') !== src || audio.error) audio.setAttribute('src', src)
    else audio.currentTime = 0
    return audio.play().then(() => current === request, () => {
      if (current === request) onError()
      return false
    })
  }
}
