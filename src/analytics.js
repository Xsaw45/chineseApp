/*
 * Mesure d'audience (PostHog, hébergement UE, projet « Yidiano ») : rien n'est chargé, stocké ni envoyé avant le
 * consentement. Le choix est gardé dans localStorage (CONSENT_KEY), commun à la page de présentation et à l'app
 * (même domaine) ; il se change dans Paramètres et, sur la page de présentation, par le lien « Cookies ».
 * Aucune adresse e-mail n'est envoyée : la personne est identifiée par l'empreinte SHA-256 de son adresse.
 */

const TOKEN = 'phc_r8KAYtAMRFMC8cBBNzN6nVemRrXRaPfB69GhWKmuMvT3'
const CONSENT_KEY = 'yidiano.analytics'
export const CONSENT_EVENT = 'yidiano:analytics-consent'

let surface = null
let loading = null

/** 'granted' | 'denied' | null (pas encore demandé). */
export function consent() {
  try {
    return localStorage.getItem(CONSENT_KEY)
  } catch {
    return 'denied'
  }
}

function load() {
  loading ||= import('posthog-js').then(({ default: posthog }) => {
    posthog.init(TOKEN, {
      // Relais Caddy de yidiano.com vers PostHog UE (moins bloqué par les bloqueurs de publicité). Hors production,
      // /ingest n'existe pas : rien n'arrive dans PostHog depuis un test local.
      api_host: '/ingest',
      ui_host: 'https://eu.posthog.com',
      defaults: '2025-05-24',
      persistence: 'localStorage',
      person_profiles: 'identified_only',
    })
    if (posthog.has_opted_out_capturing()) posthog.opt_in_capturing()
    // surface : page de présentation, connexion ou app ; installed : app ouverte depuis l'écran d'accueil (PWA).
    // Système, type d'appareil et navigateur ($os, $device_type, $browser) sont ajoutés par PostHog.
    const installed = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
    posthog.register({ surface, installed })
    return posthog
  })
  return loading
}

/** À l'ouverture de la page : surface = 'landing' | 'login' | 'app'. Charge PostHog seulement si consentement donné. */
export function initAnalytics(name) {
  surface = name
  if (consent() === 'granted') load()
}

/** Ce que PostHog a laissé sur l'appareil (persistence localStorage : aucun cookie). */
function forget() {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith('ph_') || key.startsWith('__ph')) localStorage.removeItem(key)
  }
}

export function setConsent(value) {
  localStorage.setItem(CONSENT_KEY, value)
  if (value === 'granted') load()
  else {
    loading?.then(posthog => {
      posthog.opt_out_capturing()
      forget()
    })
    loading = null
    forget()
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }))
}

/** options : celles de posthog.capture (sendBeacon avant de quitter la page). Promesse résolue une fois l'événement confié à PostHog. */
export function capture(event, properties, options) {
  if (consent() === 'granted') return load().then(posthog => posthog.capture(event, properties, options))
}

async function emailHash(email) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email))
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

/** Compte connecté (properties : rôle et formule, sans donnée personnelle). */
export function identify(email, properties) {
  if (consent() !== 'granted') return
  Promise.all([load(), emailHash(email)]).then(([posthog, id]) => posthog.identify(id, properties))
}

/** Déconnexion : le prochain compte sur cet appareil n'hérite pas de l'identifiant. */
export function resetAnalytics() {
  loading?.then(posthog => posthog.reset())
}
