// Paddle.js v2 (paiement Yidiano+, voir server/paddle.js) : chargé seulement à l'ouverture de l'écran Yidiano+.
const SCRIPT = 'https://cdn.paddle.com/paddle/v2/paddle.js'

let loading = null
const listeners = new Set()

/** Paddle initialisé avec la configuration du serveur ; onEvent reçoit les événements du paiement (checkout.*). */
export function loadPaddle(config) {
  loading ||= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT
    script.async = true
    script.onload = () => {
      const { Paddle } = window
      if (config.environment === 'sandbox') Paddle.Environment.set('sandbox')
      Paddle.Initialize({ token: config.clientToken, eventCallback: event => listeners.forEach(listener => listener(event)) })
      resolve(Paddle)
    }
    script.onerror = () => {
      loading = null
      script.remove()
      reject(new Error('Paddle.js indisponible'))
    }
    document.head.append(script)
  })
  return loading
}

/** Abonne listener aux événements Paddle ; renvoie la fonction de désabonnement. */
export function onPaddleEvent(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export async function fetchPaddleConfig() {
  const response = await fetch('/api/paddle/config')
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Configuration Paddle indisponible (${response.status})`)
  return response.json()
}
