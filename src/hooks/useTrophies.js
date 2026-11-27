import { useCallback, useEffect, useState } from 'react'
import { newTrophies, trophyContext, trophyRecord } from '../utils/trophies.js'

/**
 * Enregistre les trophées atteints dès que la progression (ou le classement des amis) change ; earned : ceux qui
 * viennent d'être obtenus, pour l'annonce (TrophyToast), jusqu'à dismiss().
 * save : enregistrement direct, sans compter comme pratique (pas withActivity).
 */
export function useTrophies({ progressMap, latestMap, levelStats, social, save }) {
  const [earned, setEarned] = useState([])

  useEffect(() => {
    const current = latestMap()
    if (!current || !levelStats) return
    const fresh = newTrophies(current, trophyContext(current, levelStats, social))
    if (!fresh.length) return
    save(fresh.map(trophy => trophyRecord(trophy.id))).then(() => setEarned(previous => [...previous, ...fresh]))
  }, [progressMap, latestMap, levelStats, social, save])

  const dismiss = useCallback(() => setEarned([]), [])
  return { earned, dismiss }
}
