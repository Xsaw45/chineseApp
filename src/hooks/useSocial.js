import { useCallback, useEffect, useState } from 'react'
import { REMOTE_PROGRESS_EVENT } from '../db/index.js'

/**
 * Amis et classement (GET /api/social, server/social.js), chargés à l'ouverture de l'app puis après chaque action de
 * la page Amis. social : null tant que rien n'est chargé (ou hors ligne) ; refresh() : recharge, renvoie les données.
 */
export function useSocial() {
  const [social, setSocial] = useState(null)

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/social')
      if (!response.ok) return null
      const data = await response.json()
      setSocial(data)
      return data
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    let active = true
    fetch('/api/social')
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (active && data) setSocial(data) }, () => {})
    window.addEventListener(REMOTE_PROGRESS_EVENT, refresh)
    return () => {
      active = false
      window.removeEventListener(REMOTE_PROGRESS_EVENT, refresh)
    }
  }, [refresh])

  return { social, refresh }
}
