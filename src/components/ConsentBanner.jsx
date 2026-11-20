import { useState } from 'react'
import { consent, setConsent } from '../analytics.js'
import { useLang } from '../i18n/useLang.js'
import { Button } from './ui.jsx'

/** Demande du consentement à la mesure d'audience (src/analytics.js), tant qu'aucun choix n'est fait. */
export function ConsentBanner() {
  const { t } = useLang()
  const [decided, setDecided] = useState(() => consent() !== null)
  if (decided) return null

  const choose = value => {
    setConsent(value)
    setDecided(true)
  }
  return (
    <div role="dialog" aria-label={t('consent.title')} className="fixed inset-x-0 bottom-0 z-50 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-lg rounded-2xl border border-line-2 bg-card p-4 shadow-xl">
        <p className="text-[15px] leading-snug text-fg">
          {t('consent.text')}{' '}
          <a href="/legal/confidentialite.html#mesure-audience" target="_blank" rel="noreferrer" className="underline decoration-line-2 underline-offset-2">
            {t('consent.more')}
          </a>
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="secondary" className="h-11" onClick={() => choose('denied')}>{t('consent.refuse')}</Button>
          <Button variant="secondary" className="h-11" onClick={() => choose('granted')}>{t('consent.accept')}</Button>
        </div>
      </div>
    </div>
  )
}
