import { useEffect, useState } from 'react'
import { useLang } from '../i18n/useLang.js'
import { Screen, SectionLabel, TopBar } from './ui.jsx'

const ROLES = ['user', 'beta', 'admin']

/** Usage d'un compte (server/db.js, accounts.usage) : jours pratiqués, temps, éléments maîtrisés, dernière pratique. */
function Usage({ stats, createdAt }) {
  const { lang, t } = useLang()
  const day = value => new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`))
  const joined = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short' }).format(createdAt)
  if (!stats?.days) return <p className="mt-2 text-sm text-fg-3">{t('admin.joined', { date: joined })} · {t('admin.neverPracticed')}</p>
  return (
    <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
      {[
        [t('admin.days'), `${stats.days}`, t('admin.thisWeek', { n: stats.daysWeek })],
        [t('admin.time'), `${stats.minutes} min`, null],
        [t('admin.learned'), `${stats.learned}`, t('admin.started', { n: stats.items })],
        [t('admin.lastDay'), day(stats.lastDay), t('admin.joined', { date: joined })],
      ].map(([label, value, hint]) => (
        <div key={label} className="rounded-xl bg-raised px-1 py-2">
          <dt className="text-xs text-fg-3">{label}</dt>
          <dd className="text-base font-medium tabular-nums text-fg">{value}</dd>
          {hint && <dd className="text-[11px] leading-tight text-fg-3">{hint}</dd>}
        </div>
      ))}
    </dl>
  )
}

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
      // La réponse ne contient que le compte et ses droits : l'usage déjà affiché est gardé.
      setAccounts(current => current.map(account => account.login === login ? { ...account, ...changed } : account))
    } finally {
      setSaving(null)
    }
  }

  // Les plus actifs d'abord : dernière pratique, puis inscription.
  const sorted = [...accounts].sort((a, b) =>
    (b.stats?.lastDay || '').localeCompare(a.stats?.lastDay || '') || b.createdAt - a.createdAt)
  const activeWeek = accounts.filter(account => account.stats?.daysWeek > 0).length
  const practiced = accounts.filter(account => account.stats?.days > 0).length

  return (
    <Screen>
      <TopBar onBack={onBack} title={t('admin.title')} bordered />
      <div className="px-5 pt-6">
        <dl className="grid grid-cols-3 gap-2 text-center">
          {[[t('admin.accounts'), accounts.length], [t('admin.practicedOnce'), practiced], [t('admin.activeWeek'), activeWeek]].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-line bg-card px-2 py-3">
              <dd className="text-2xl font-medium tabular-nums text-fg">{value}</dd>
              <dt className="mt-1 text-xs text-fg-3">{label}</dt>
            </div>
          ))}
        </dl>
        <SectionLabel className="mt-8">{t('admin.list')}</SectionLabel>
      </div>
      <ul className="flex flex-col divide-y divide-line px-5 pb-8">
        {sorted.map(account => (
          <li key={account.login} className="py-5">
            <p className="break-all text-[15px] font-medium text-fg">{account.login}</p>
            <Usage stats={account.stats} createdAt={account.createdAt} />
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
