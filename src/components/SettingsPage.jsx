import { useEffect, useState } from 'react'
import { Check, LogOut, Trash2 } from 'lucide-react'
import { useAccess } from '../access/context.js'
import { CONSENT_EVENT, consent, resetAnalytics, setConsent } from '../analytics.js'
import { clearPlusContent } from '../content/plus.js'
import { wipeLocalProgress } from '../db/index.js'
import { LANGS, LANG_NAMES } from '../i18n/text.js'
import { useLang } from '../i18n/useLang.js'
import { Button, Screen, SectionLabel, TopBar } from './ui.jsx'
import { ICON } from './uiStyles.js'

const CREDITS = [
  { key: 'settings.credit.cedict', href: 'https://cc-cedict.org/wiki/' },
  { key: 'settings.credit.cfdict', href: 'https://chine.in/mandarin/dictionnaire/CFDICT/' },
  { key: 'settings.credit.hsk', href: 'https://github.com/krmanik/HSK-3.0' },
  { key: 'settings.credit.audio', href: 'https://github.com/hugolpz/audio-cmn' },
  { key: 'settings.credit.tts', href: 'https://cloud.google.com/text-to-speech' },
  { key: 'settings.credit.strokes', href: 'https://github.com/chanind/hanzi-writer-data' },
  { key: 'settings.credit.unihan', href: 'https://www.unicode.org/charts/unihan.html' },
  { key: 'settings.credit.fsrs', href: 'https://github.com/open-spaced-repetition/ts-fsrs' },
]

const LEGAL = [
  { key: 'settings.legalNotices', href: '/legal/mentions-legales.html' },
  { key: 'settings.legalTerms', href: '/legal/conditions.html' },
  { key: 'settings.legalPrivacy', href: '/legal/confidentialite.html' },
  { key: 'settings.legalRefunds', href: '/legal/remboursement.html' },
  { key: 'settings.legalLicences', href: '/legal/licences.html' },
]


async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' })
  localStorage.removeItem('yidiano.account')
  clearPlusContent()
  resetAnalytics()
  location.assign('/login/')
}

/** Mesure d'audience (src/analytics.js) : le choix du bandeau, modifiable à tout moment. */
function AnalyticsSetting() {
  const { t } = useLang()
  const [granted, setGranted] = useState(() => consent() === 'granted')
  useEffect(() => {
    const update = event => setGranted(event.detail === 'granted')
    window.addEventListener(CONSENT_EVENT, update)
    return () => window.removeEventListener(CONSENT_EVENT, update)
  }, [])
  return (
    <>
      <SectionLabel className="mt-10">{t('consent.title')}</SectionLabel>
      <label className="flex items-start gap-3 rounded-2xl border border-line bg-card p-4 text-sm text-fg-2">
        <input type="checkbox" className="mt-0.5" checked={granted} onChange={event => setConsent(event.target.checked ? 'granted' : 'denied')} />
        <span>{t('consent.setting')}</span>
      </label>
    </>
  )
}

/** Suppression définitive du compte (RGPD) : l'adresse retapée confirme ; un abonnement en cours est résilié. */
function DeleteAccount({ email }) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [state, setState] = useState('idle')
  const matches = typed.trim().toLowerCase() === email

  async function remove() {
    setState('deleting')
    try {
      const response = await fetch('/api/account', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: typed }),
      })
      if (!response.ok) throw new Error(`Suppression refusée (${response.status})`)
      await wipeLocalProgress()
      localStorage.clear()
      location.assign('/')
    } catch {
      setState('error')
    }
  }

  if (!open) {
    return <Button variant="secondary" className="mt-2" onClick={() => setOpen(true)}><Trash2 {...ICON} />{t('settings.delete')}</Button>
  }
  return (
    <div className="mt-3 rounded-2xl border border-bad/40 bg-card p-4">
      <p className="text-[15px] leading-relaxed text-fg-2">{t('settings.deleteWarning')}</p>
      <label className="mt-4 block text-sm text-fg-2">
        {t('settings.deleteConfirm')}
        <input
          type="email"
          value={typed}
          onChange={event => setTyped(event.target.value)}
          autoComplete="off"
          className="mt-2 h-12 w-full rounded-[10px] border border-line bg-raised px-4 text-base text-fg outline-none focus:border-line-2"
        />
      </label>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => setOpen(false)}>{t('settings.deleteCancel')}</Button>
        <Button onClick={remove} disabled={!matches || state === 'deleting'}>{t(state === 'deleting' ? 'settings.deleting' : 'settings.deleteFinal')}</Button>
      </div>
      {state === 'error' && <p role="alert" className="mt-3 text-sm text-bad">{t('settings.deleteError')}</p>}
    </div>
  )
}

export function SettingsPage({ onBack, onOpenPlus, onOpenAdmin, onOpenReferral }) {
  const { lang, setLang, t } = useLang()
  const { account, hasPlus, previewFree, setPreviewFree } = useAccess()
  return (
    <Screen>
      <TopBar onBack={onBack} backLabel={t('nav.back')} title={t('settings.title')} bordered />

      <div className="flex flex-col px-5 py-6">
        <SectionLabel className="mb-1">{t('settings.language')}</SectionLabel>
        <p className="mb-3 text-sm text-fg-3">{t('settings.languageHint')}</p>
        <ul role="radiogroup" aria-label={t('settings.language')} className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
          {LANGS.map(code => (
            <li key={code}>
              <button
                type="button"
                role="radio"
                aria-checked={code === lang}
                lang={code}
                onClick={() => setLang(code)}
                className="flex h-14 w-full items-center justify-between px-4 text-left text-base text-fg transition-colors duration-150 ease-out hover:bg-raised"
              >
                {LANG_NAMES[code]}
                {code === lang && <Check {...ICON} className="text-accent" />}
              </button>
            </li>
          ))}
        </ul>

        {account && (
          <>
            <SectionLabel className="mt-10">{t('settings.plan')}</SectionLabel>
            <div className="rounded-2xl border border-line bg-card p-4">
              <p className="text-base font-medium text-fg">{hasPlus ? t('plus.badge') : t('plus.freePlan')}</p>
              <p className="mt-1 text-sm text-fg-3">{t(`admin.role.${account.role}`)}</p>
              {account.role === 'admin' && (
                <label className="mt-4 flex items-center gap-3 text-sm text-fg-2">
                  <input type="checkbox" checked={previewFree} onChange={event => setPreviewFree(event.target.checked)} />
                  {t('settings.previewFree')}
                </label>
              )}
            </div>
            <Button variant="secondary" className="mt-3" onClick={onOpenPlus}>{t('settings.openPlus')}</Button>
            <Button variant="secondary" className="mt-2" onClick={onOpenReferral}>{t('ref.cardTitle')}</Button>
            {account.role === 'admin' && <Button variant="secondary" className="mt-2" onClick={onOpenAdmin}>{t('settings.admin')}</Button>}
          </>
        )}

        {account && (
          <>
            <SectionLabel className="mt-10">{t('settings.account')}</SectionLabel>
            <p className="mb-3 break-all text-[15px] text-fg">{account.login}</p>
            <Button variant="secondary" onClick={logout}><LogOut {...ICON} />{t('settings.logout')}</Button>
            <DeleteAccount email={account.login} />
          </>
        )}

        <SectionLabel className="mt-10">{t('settings.legal')}</SectionLabel>
        <ul className="flex flex-col gap-2 text-sm text-fg-2">
          {LEGAL.map(item => (
            <li key={item.key}>
              <a href={item.href} target="_blank" rel="noreferrer" className="underline decoration-line-2 underline-offset-2 hover:text-fg">
                {t(item.key)}
              </a>
            </li>
          ))}
        </ul>

        <AnalyticsSetting />

        <SectionLabel className="mt-10">{t('settings.credits')}</SectionLabel>
        <p className="mb-3 text-sm text-fg-3">{t('settings.creditsIntro')}</p>
        <ul className="flex flex-col gap-2 text-sm text-fg-2">
          {CREDITS.map(c => (
            <li key={c.key}>
              <a href={c.href} target="_blank" rel="noreferrer" className="underline decoration-line-2 underline-offset-2 hover:text-fg">
                {t(c.key)}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </Screen>
  )
}
