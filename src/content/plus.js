import { CLIENT_CONTENT, PLUS_VERSION } from 'virtual:yidiano-content'

/*
 * Grammaire et lectures (content/) : le code de l'app ne contient que le contenu gratuit et le résumé des éléments
 * Yidiano+ (locked: true). Un compte Yidiano+ reçoit ces éléments du serveur (/api/content) ; ils sont gardés dans
 * localStorage pour l'usage hors ligne et remplacent les résumés au lancement suivant (syncPlusContent recharge l'app).
 */

const KEY = 'yidiano.plus'

function readCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(KEY))
    return cached?.version === PLUS_VERSION ? cached : null
  } catch {
    return null
  }
}

const cache = readCache()

function withPlus(items, full = []) {
  const byId = new Map(full.map(item => [item.id, item]))
  return items.map(item => (item.locked && byId.has(item.id) ? byId.get(item.id) : item))
}

export const GRAMMAR_ITEMS = withPlus(CLIENT_CONTENT.grammar, cache?.grammar)
export const READING_ITEMS = withPlus(CLIENT_CONTENT.readings, cache?.readings)
const missing = [...GRAMMAR_ITEMS, ...READING_ITEMS].some(item => item.locked)

/**
 * Compte Yidiano+ sans le contenu payant (premier lancement, nouvelle version) : le télécharge, le garde, puis
 * recharge l'app pour qu'il remplace les résumés. Une seule tentative de rechargement par version et par onglet.
 */
export async function syncPlusContent() {
  if (!missing) return
  const guard = `${KEY}.reloaded`
  if (sessionStorage.getItem(guard) === PLUS_VERSION) return
  const response = await fetch('/api/content')
  if (!response.ok) return
  const content = await response.json()
  // Serveur et app de deux versions différentes (déploiement en cours) : la prochaine ouverture réessaiera.
  if (content.version !== PLUS_VERSION) return
  localStorage.setItem(KEY, JSON.stringify(content))
  sessionStorage.setItem(guard, PLUS_VERSION)
  location.reload()
}

/** Compte sans Yidiano+ (fin d'abonnement, déconnexion) : le contenu payant ne reste pas sur l'appareil. */
export function clearPlusContent() {
  localStorage.removeItem(KEY)
}
