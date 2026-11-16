import { useState } from 'react'
import { Check } from 'lucide-react'
import { useAccess } from '../access/context.js'
import { useLang } from '../i18n/useLang.js'
import { Button, Screen, TopBar } from './ui.jsx'
import { ICON_SM } from './uiStyles.js'

function dateLabel(timestamp, lang) {
  return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric' }).format(timestamp)
}

export function PlusPage({ onBack }) {
  const { account, startTrial } = useAccess()
  const { lang, t } = useLang()
  const [starting, setStarting] = useState(false)
  const [now] = useState(Date.now)
  const [error, setError] = useState(false)
  const access = account?.access

  const status = account?.role === 'admin' || account?.role === 'beta'
    ? t('plus.roleAccess', { role: t(`admin.role.${account.role}`).toLowerCase() })
    : access?.source === 'trial' && access.trialExpiresAt > now
      ? t('plus.trialActive', { date: dateLabel(access.trialExpiresAt, lang) })
      : access?.source === 'subscription' && access.plusExpiresAt > now
        ? t('plus.subscriptionActive', { date: dateLabel(access.plusExpiresAt, lang) })
        : t('plus.freePlan')

  async function activateTrial() {
    setStarting(true)
    setError(false)
    try {
      await startTrial()
    } catch {
      setError(true)
    } finally {
      setStarting(false)
    }
  }

  return (
    <Screen>
      <TopBar onBack={onBack} title={t('plus.title')} bordered />
      <div className="flex flex-1 flex-col px-5 py-8">
        <header className="text-center">
          <p className="hanzi-display text-5xl text-accent">一点</p>
          <h1 className="mt-4 text-3xl font-medium text-fg">{t('plus.title')}</h1>
          <p className="mt-2 text-[16px] leading-relaxed text-fg-2">{t('plus.subtitle')}</p>
          <p className="mt-4 inline-flex rounded-full bg-raised px-3 py-1.5 text-sm font-medium text-fg-2">{status}</p>
        </header>

        <div className="mt-8 grid gap-3">
          <section className="rounded-2xl border border-line bg-card p-5">
            <h2 className="flex items-center gap-2 font-medium text-fg"><Check {...ICON_SM} className="text-good" />{t('plus.freeIncluded')}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-fg-2">{t('plus.freeDetail')}</p>
          </section>
          <section className="rounded-2xl border border-accent/40 bg-card p-5">
            <h2 className="flex items-center gap-2 font-medium text-fg"><Check {...ICON_SM} className="text-accent" />{t('plus.fullIncluded')}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-fg-2">{t('plus.fullDetail')}</p>
          </section>
        </div>

        {access?.trialAvailable && account?.role === 'user' && !access.plus ? (
          <div className="mt-8">
            <Button onClick={activateTrial} disabled={starting}>{t(starting ? 'plus.starting' : 'plus.startTrial')}</Button>
            <p className="mt-3 text-center text-sm text-fg-3">{t('plus.noCard')}</p>
            {error && <p role="alert" className="mt-2 text-center text-sm text-bad">{t('plus.error')}</p>}
          </div>
        ) : account?.role === 'user' && !access?.plus ? (
          <p className="mt-8 text-center text-[15px] text-fg-2">{t('plus.availableSoon')}</p>
        ) : null}
      </div>
    </Screen>
  )
}
