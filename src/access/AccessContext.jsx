import { useCallback, useEffect, useMemo, useState } from 'react'
import { AccessContext } from './context.js'

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
  const expiresAt = account.access.source === 'trial' ? account.access.trialExpiresAt : account.access.plusExpiresAt
  return expiresAt > Date.now()
}

export function AccessProvider({ children }) {
  const [account, setAccount] = useState(null)
  const [loading, setLoading] = useState(true)
  const [previewFree, setPreviewFree] = useState(false)

  const storeAccount = useCallback(next => {
    setAccount(next)
    if (next) localStorage.setItem(CACHE_KEY, JSON.stringify(next))
  }, [])

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

  const startTrial = useCallback(async () => {
    const response = await fetch('/api/access/trial', { method: 'POST' })
    if (!response.ok) throw new Error((await response.json()).error || 'trial_failed')
    const next = await response.json()
    storeAccount(next)
    return next
  }, [storeAccount])

  const value = useMemo(() => ({
    account,
    loading,
    hasPlus: effectivePlus(account) && !previewFree,
    previewFree,
    setPreviewFree,
    startTrial,
    refresh,
  }), [account, loading, previewFree, startTrial, refresh])

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>
}

