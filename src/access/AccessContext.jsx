import { useCallback, useEffect, useMemo, useState } from 'react'
import { AccessContext } from './context.js'
import { clearPlusContent, syncPlusContent } from '../content/plus.js'
import { CONSENT_EVENT, identify } from '../analytics.js'

const CACHE_KEY = 'yidiano.account'

function readCachedAccount() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY))
  } catch {
    return null
  }
}

function effectivePlus(account) {
  if (!account?.access?.plus) return false
  if (account.role === 'admin' || account.role === 'beta') return true
  return account.access.plusExpiresAt > Date.now()
}

export function AccessProvider({ children }) {
  const [account, setAccount] = useState(null)
  const [loading, setLoading] = useState(true)
  const [previewFree, setPreviewFree] = useState(false)

  const storeAccount = useCallback(next => {
    setAccount(next)
    if (next) localStorage.setItem(CACHE_KEY, JSON.stringify(next))
  }, [])

  // Mesure d'audience : le compte est rattaché à ses événements (empreinte de l'adresse, rôle, formule), aussi
  // quand le consentement arrive après l'ouverture de l'app.
  const login = account?.login
  const role = account?.role
  const plan = account?.access?.plan
  useEffect(() => {
    if (!login) return
    const send = () => identify(login, { role, plan })
    send()
    window.addEventListener(CONSENT_EVENT, send)
    return () => window.removeEventListener(CONSENT_EVENT, send)
  }, [login, role, plan])

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/me')
      if (!response.ok) throw new Error(`Compte indisponible (${response.status})`)
      storeAccount(await response.json())
    } catch {
      setAccount(readCachedAccount())
    } finally {
      setLoading(false)
    }
  }, [storeAccount])

  useEffect(() => {
    let active = true
    fetch('/api/me')
      .then(response => {
        if (!response.ok) throw new Error(`Compte indisponible (${response.status})`)
        return response.json()
      })
      .then(next => {
        if (active) storeAccount(next)
      })
      .catch(() => {
        if (active) setAccount(readCachedAccount())
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [storeAccount])

  // Grammaire et lectures Yidiano+ (src/content/plus.js) : téléchargées pour un compte qui y a droit, effacées sinon.
  const plusAllowed = account ? Boolean(account.access?.plus) : null
  useEffect(() => {
    if (plusAllowed === true) syncPlusContent().catch(() => {})
    if (plusAllowed === false) clearPlusContent()
  }, [plusAllowed])

  const value = useMemo(() => ({
    account,
    loading,
    hasPlus: effectivePlus(account) && !previewFree,
    previewFree,
    setPreviewFree,
    refresh,
  }), [account, loading, previewFree, refresh])

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>
}

