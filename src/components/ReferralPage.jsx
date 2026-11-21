import { useEffect, useState } from 'react'
import { Check, Copy, Gift, Share2 } from 'lucide-react'
import { capture } from '../analytics.js'
import { useLang } from '../i18n/useLang.js'
import { Button, Screen, TopBar } from './ui.jsx'
import { ICON, ICON_SM } from './uiStyles.js'

/**
 * Parrainage (server/referral.js) : lien personnel, partage, et ce qu'il a rapporté. Un ami qui crée son compte avec
 * le lien puis enregistre sa carte (essai Yidiano+ de 15 jours) rapporte un mois de Yidiano+ au parrain.
 */
export function ReferralPage({ onBack }) {
  const { t } = useLang()
  // undefined : en cours ; null : indisponible (hors ligne)
  const [data, setData] = useState(undefined)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/referral')
      .then(response => (response.ok ? response.json() : null))
      .then(setData, () => setData(null))
  }, [])

  async function copy() {
    await navigator.clipboard.writeText(data.link)
    capture('referral_shared', { method: 'copy' })
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  async function share() {
    try {
      await navigator.share({ title: 'Yidiano', text: t('ref.shareText'), url: data.link })
      capture('referral_shared', { method: 'share' })
    } catch {
      // partage annulé
    }
  }

  return (
    <Screen>
      <TopBar onBack={onBack} title={t('ref.title')} bordered />
      <div className="flex flex-col px-5 py-8">
        <header className="text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
            <Gift size={28} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-[28px] font-medium leading-tight text-fg">{t('ref.headline')}</h1>
          <p className="mt-3 text-[16px] leading-relaxed text-fg-2">{t('ref.intro')}</p>
        </header>

        <ol className="mt-8 grid gap-3">
          {['ref.step1', 'ref.step2', 'ref.step3'].map((key, index) => (
            <li key={key} className="flex gap-3 rounded-2xl border border-line bg-card p-4">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-medium text-white">{index + 1}</span>
              <span className="text-[15px] leading-relaxed text-fg">{t(key)}</span>
            </li>
          ))}
        </ol>

        {data === null && <p role="alert" className="mt-8 text-center text-[15px] text-fg-2">{t('ref.offline')}</p>}
        {data && (
          <>
            <div className="mt-8 rounded-2xl border border-accent/40 bg-card p-4">
              <p className="text-sm text-fg-3">{t('ref.yourLink')}</p>
              <p className="mt-1 break-all font-medium text-fg">{data.link}</p>
            </div>
            <div className="mt-3 grid gap-2">
              {typeof navigator.share === 'function' && (
                <Button onClick={share}><Share2 {...ICON} />{t('ref.share')}</Button>
              )}
              <Button variant={typeof navigator.share === 'function' ? 'secondary' : 'primary'} onClick={copy}>
                {copied ? <Check {...ICON} /> : <Copy {...ICON} />}{t(copied ? 'ref.copied' : 'ref.copy')}
              </Button>
            </div>

            <dl className="mt-8 grid grid-cols-3 gap-2 text-center">
              {[[t('ref.invited'), data.invited], [t('ref.qualified'), data.qualified], [t('ref.months'), data.months]].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-line bg-card px-2 py-3">
                  <dd className="text-2xl font-medium tabular-nums text-fg">{value}</dd>
                  <dt className="mt-1 text-xs leading-tight text-fg-3">{label}</dt>
                </div>
              ))}
            </dl>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-sm text-fg-3">
              <Check {...ICON_SM} className="text-good" />{t('ref.cap', { n: data.monthsYear, max: data.maxMonthsPerYear })}
            </p>
          </>
        )}

        <p className="mt-8 text-center text-sm leading-relaxed text-fg-3">{t('ref.terms')}</p>
      </div>
    </Screen>
  )
}
