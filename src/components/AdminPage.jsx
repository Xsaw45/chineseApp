import { useEffect, useState } from 'react'
import { useLang } from '../i18n/useLang.js'
import { Screen, TopBar } from './ui.jsx'

const ROLES = ['user', 'beta', 'admin']

export function AdminPage({ onBack }) {
  const { t } = useLang()
  const [accounts, setAccounts] = useState([])
  const [saving, setSaving] = useState(null)

  useEffect(() => {
    fetch('/api/admin/accounts')
      .then(response => response.ok ? response.json() : [])
      .then(setAccounts)
      .catch(() => {})
  }, [])

  async function changeRole(login, role) {
    setSaving(login)
    try {
      const response = await fetch(`/api/admin/accounts/${encodeURIComponent(login)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      if (!response.ok) return
      const changed = await response.json()
      setAccounts(current => current.map(account => account.login === login ? changed : account))
    } finally {
      setSaving(null)
    }
  }

  return (
    <Screen>
      <TopBar onBack={onBack} title={t('admin.title')} bordered />
      <ul className="flex flex-col divide-y divide-line px-5 pb-8">
        {accounts.map(account => (
          <li key={account.login} className="py-5">
            <p className="break-all text-[15px] font-medium text-fg">{account.login}</p>
            <div className="mt-3 flex items-center gap-3">
              <select
                value={account.role}
                disabled={saving === account.login}
                onChange={event => changeRole(account.login, event.target.value)}
                aria-label={`${account.login} — ${t('settings.plan')}`}
                className="h-10 flex-1 rounded-[10px] border border-line bg-card px-3 text-sm text-fg outline-none disabled:opacity-60"
              >
                {ROLES.map(role => <option key={role} value={role}>{t(`admin.role.${role}`)}</option>)}
              </select>
              <span className="text-sm text-fg-3">{saving === account.login ? t('admin.saving') : account.access.plan === 'plus' ? t('plus.badge') : t('plus.freePlan')}</span>
            </div>
          </li>
        ))}
      </ul>
    </Screen>
  )
}
