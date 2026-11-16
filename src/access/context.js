import { createContext, useContext } from 'react'

export const AccessContext = createContext(null)

export function useAccess() {
  const value = useContext(AccessContext)
  if (!value) throw new Error('useAccess doit être utilisé dans AccessProvider')
  return value
}
