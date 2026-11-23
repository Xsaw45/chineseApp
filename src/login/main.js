import { capture, initAnalytics } from '../analytics.js'

// Page de connexion (login/index.html) : e-mail (lien ou code, server/auth.js) ou Google (server/google.js).

const TEXT = {
  fr: {
    title: 'Connexion', intro: 'Saisis ton adresse e-mail : tu vas recevoir un lien et un code pour te connecter, sans mot de passe.',
    emailLabel: 'Adresse e-mail', send: 'Recevoir le code', checkTitle: 'Vérifie tes e-mails',
    sentTo: 'Un code a été envoyé à {email}. Ouvre le lien de l’e-mail, ou saisis le code ici.',
    codeLabel: 'Code à 6 chiffres', confirm: 'Valider', change: 'Changer d’adresse', resend: 'Renvoyer le code',
    resent: 'Nouveau code envoyé.',
    linkTitle: 'Connexion', linkIntro: 'Confirme pour te connecter sur cet appareil.', signIn: 'Me connecter',
    google: 'Continuer avec Google', or: 'ou par e-mail',
    introGoogle: 'Sans mot de passe : avec ton compte Google, ou avec ton adresse e-mail (tu reçois un lien et un code).',
    oauth_failed: 'La connexion avec Google n’a pas abouti : réessaie, ou utilise ton adresse e-mail.',
    oauth_cancelled: 'Connexion avec Google annulée.',
    not_invited: 'Cette adresse n’est pas invitée au test. Vérifie l’orthographe ou demande une invitation.',
    too_soon: 'Un e-mail vient d’être envoyé : attends {s} s avant d’en demander un autre.',
    too_many: 'Trop de demandes pour cette adresse : réessaie dans une heure.',
    too_many_ip: 'Trop de demandes depuis ce réseau : réessaie dans {m} min.',
    wrong_code: 'Code incorrect ({n} essai(s) restant(s)).',
    expired_code: 'Ce code a expiré ou a été trop souvent mal saisi : demande un nouveau code.',
    invalid_link: 'Ce lien a expiré ou a déjà servi : demande un nouveau code.',
    network: 'Pas de connexion au serveur : vérifie ton réseau et réessaie.',
    other: 'Une erreur est survenue : réessaie.',
  },
  en: {
    title: 'Sign in', intro: 'Enter your email address: you will receive a link and a code to sign in, no password needed.',
    emailLabel: 'Email address', send: 'Get the code', checkTitle: 'Check your email',
    sentTo: 'A code was sent to {email}. Open the link in the email, or enter the code here.',
    codeLabel: '6-digit code', confirm: 'Confirm', change: 'Change address', resend: 'Send a new code',
    resent: 'New code sent.',
    linkTitle: 'Sign in', linkIntro: 'Confirm to sign in on this device.', signIn: 'Sign in',
    google: 'Continue with Google', or: 'or with email',
    introGoogle: 'No password needed: use your Google account, or your email address (you will receive a link and a code).',
    oauth_failed: 'Signing in with Google did not work: try again, or use your email address.',
    oauth_cancelled: 'Signing in with Google was cancelled.',
    not_invited: 'This address is not invited to the test. Check the spelling or ask for an invitation.',
    too_soon: 'An email was just sent: wait {s} s before asking for another one.',
    too_many: 'Too many requests for this address: try again in an hour.',
    too_many_ip: 'Too many requests from this network: try again in {m} min.',
    wrong_code: 'Wrong code ({n} attempt(s) left).',
    expired_code: 'This code expired or was mistyped too often: ask for a new code.',
    invalid_link: 'This link expired or was already used: ask for a new code.',
    network: 'Cannot reach the server: check your network and try again.',
    other: 'Something went wrong: try again.',
  },
}
const lang = (navigator.language || 'fr').toLowerCase().startsWith('fr') ? 'fr' : 'en'
const t = TEXT[lang]
document.documentElement.lang = lang
document.title = t.title + ' · Yidiano'
for (const el of document.querySelectorAll('[data-t]')) el.textContent = t[el.dataset.t]

const params = new URLSearchParams(location.search)
// Meme regle que le serveur (safeNext) : uniquement un chemin de ce site.
const next = /^\/(?![/\\])[\w\-./]*$/.test(params.get('next') || '') ? params.get('next') : '/'
const token = params.get('token')
const oauthError = params.get('error')
// Le jeton du lien et l'erreur Google quittent l'adresse avant la mesure d'audience : la page vue n'emporte que next.
if (token || oauthError) history.replaceState(null, '', `/login/?next=${encodeURIComponent(next)}`)
initAnalytics('login')

/** Événement remis au navigateur par sendBeacon, qui l'envoie même une fois la page quittée (attente de 800 ms au plus). */
const captureBeforeLeaving = (event, properties) =>
  Promise.race([capture(event, properties, { transport: 'sendBeacon', send_instantly: true }), new Promise(resolve => setTimeout(resolve, 800))])

const $ = (id) => document.getElementById(id)
let email = localStorage.getItem('langues-login-email') || ''
$('email').value = email

// Connexion avec Google, si le serveur la propose : même retour (next) qu'avec l'e-mail.
$('google').href = `/api/auth/google/start?next=${encodeURIComponent(next)}`
$('google').addEventListener('click', async (event) => {
  event.preventDefault()
  await captureBeforeLeaving('login_google_started')
  location.assign($('google').href)
})
fetch('/api/auth/providers').then(res => (res.ok ? res.json() : {})).then(({ google }) => {
  if (!google) return
  $('providers').hidden = false
  document.querySelector('#step-email [data-t="intro"]').textContent = t.introGoogle
}, () => {})

function show(step) {
  for (const id of ['step-email', 'step-code', 'step-link']) $(id).hidden = id !== step
  const input = document.querySelector(`#${step} input`)
  if (input) input.focus()
}

/** { data } ou { error : message affiché, code : code d'erreur du serveur }. */
async function post(path, body) {
  let res
  try {
    res = await fetch(`/api/auth/${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    })
  } catch {
    return { error: t.network, code: 'network' }
  }
  const data = await res.json().catch(() => ({}))
  if (res.ok) return { data }
  const message = (t[data.error] || t.other)
    .replace('{s}', data.retryAfter ?? '').replace('{m}', Math.ceil((data.retryAfter ?? 60) / 60))
    .replace('{n}', data.attemptsLeft ?? 0)
  return { error: message, code: data.error || 'other' }
}

async function withButton(form, action) {
  const button = form.querySelector('button[type=submit]')
  button.disabled = true
  try { await action() } finally { button.disabled = false }
}

function showMessage(el, text, success = false) {
  el.classList.toggle('success', success)
  el.textContent = text
}

async function requestCode(messageEl, confirmation = '') {
  const { error, code } = await post('request', { email, lang, next })
  showMessage(messageEl, error || confirmation, !error && Boolean(confirmation))
  capture(error ? 'login_code_failed' : 'login_code_requested', error ? { step: 'request', error: code } : undefined)
  return !error
}

/** Connexion réussie : l'événement part avant de quitter la page. */
async function signedIn(method) {
  await captureBeforeLeaving('login_succeeded', { method })
  location.replace(next)
}

$('email-form').addEventListener('submit', (event) => {
  event.preventDefault()
  withButton(event.target, async () => {
    email = $('email').value.trim()
    localStorage.setItem('langues-login-email', email)
    if (await requestCode($('email-error'))) {
      $('sent-to').textContent = t.sentTo.replace('{email}', email)
      $('code').value = ''
      showMessage($('code-message'), '')
      show('step-code')
    }
  })
})

$('code-form').addEventListener('submit', (event) => {
  event.preventDefault()
  withButton(event.target, async () => {
    const { error, code } = await post('verify', { email, code: $('code').value.trim() })
    if (!error) return signedIn('code')
    showMessage($('code-message'), error)
    capture('login_code_failed', { step: 'verify', error: code })
  })
})

$('change').addEventListener('click', () => show('step-email'))
$('resend').addEventListener('click', () => requestCode($('code-message'), t.resent))

// Lien de l'e-mail : la connexion attend un clic (les antivirus de messagerie ouvrent les liens tout seuls).
if (token) {
  show('step-link')
  $('link-form').addEventListener('submit', (event) => {
    event.preventDefault()
    withButton(event.target, async () => {
      const { error, code } = await post('verify', { token })
      if (!error) return signedIn('link')
      show('step-email')
      $('email-error').textContent = error
      capture('login_code_failed', { step: 'link', error: code })
    })
  })
} else {
  show('step-email')
  // Retour d'une connexion Google refusée ou annulée (server/auth.js).
  if (oauthError) {
    $('email-error').textContent = t[oauthError] || t.other
    capture('login_google_failed', { error: oauthError })
  }
}
