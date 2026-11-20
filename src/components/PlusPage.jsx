import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { useAccess } from '../access/context.js'
import { fetchPaddleConfig, loadPaddle, onPaddleEvent } from '../access/paddle.js'
import { useLang } from '../i18n/useLang.js'
import { Button, Screen, TopBar } from './ui.jsx'
import { ICON_SM } from './uiStyles.js'

const PLANS = ['yearly', 'monthly']
// Après le paiement, Paddle prévient le serveur par webhook : on relit le compte jusqu'à voir l'abonnement.
const POLL_MS = 2000
const POLL_LIMIT_MS = 30_000

function dateLabel(timestamp, lang) {
  return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric' }).format(timestamp)
}

/** Montant Paddle (unités mineures : centimes pour l'euro) écrit dans la langue de l'app. */
function priceLabel({ amount, currency }, lang) {
  const format = new Intl.NumberFormat(lang, { style: 'currency', currency })
  return format.format(amount / 10 ** format.resolvedOptions().maximumFractionDigits)
}

export function PlusPage({ onBack }) {
  const { account, refresh } = useAccess()
  const { lang, t } = useLang()
  const [now] = useState(Date.now)
  // undefined : en cours de lecture ; null : abonnement pas encore en vente
  const [paddle, setPaddle] = useState(undefined)
  const [prices, setPrices] = useState({})
  const [plan, setPlan] = useState('yearly')
  // idle | opening | activating | slow | error
  const [checkout, setCheckout] = useState('idle')
  const [portal, setPortal] = useState('idle')
  const access = account?.access
  const subscribed = access?.source === 'subscription'
  const canSubscribe = account?.role === 'user' && !subscribed

  const status = account?.role === 'admin' || account?.role === 'beta'
    ? t('plus.roleAccess', { role: t(`admin.role.${account.role}`).toLowerCase() })
    : subscribed && access.subscription?.cancelAt
      ? t('plus.cancelScheduled', { date: dateLabel(access.subscription.cancelAt, lang) })
      : subscribed && access.subscription?.status === 'trialing' && access.subscription.renewsAt
        ? t('plus.trialRenews', { date: dateLabel(access.subscription.renewsAt, lang) })
        : subscribed && access.subscription?.renewsAt
          ? t('plus.subscriptionRenews', { date: dateLabel(access.subscription.renewsAt, lang) })
          : subscribed && access.plusExpiresAt > now
            ? t('plus.subscriptionActive', { date: dateLabel(access.plusExpiresAt, lang) })
            : t('plus.freePlan')

  useEffect(() => {
    if (!canSubscribe) return
    let active = true
    fetchPaddleConfig()
      .then(async config => {
        if (!active) return
        if (!config) return setPaddle(null)
        const Paddle = await loadPaddle(config)
        if (!active) return
        setPaddle({ Paddle, config })
        // Prix calculés par Paddle (devise et TVA du pays de la personne), écrits dans la langue de l'app
        const preview = await Paddle.PricePreview({
          items: PLANS.map(name => ({ priceId: config.prices[name], quantity: 1 })),
        })
        if (active) {
          const currency = preview.data.currencyCode
          setPrices(Object.fromEntries(preview.data.details.lineItems.map(item => [item.price.id, { amount: Number(item.totals.total), currency }])))
        }
      })
      .catch(() => {
        if (active) setPaddle(current => current ?? null)
      })
    return () => { active = false }
  }, [canSubscribe])

  useEffect(() => onPaddleEvent(event => {
    if (event.name === 'checkout.loaded') setCheckout('idle')
    if (event.name === 'checkout.completed') setCheckout('activating')
  }), [])

  useEffect(() => {
    if (checkout !== 'activating') return
    // Abonnement visible : le paiement Paddle (encore ouvert sur son écran de succès) se ferme.
    if (subscribed) {
      paddle?.Paddle.Checkout.close()
      return
    }
    const poll = setInterval(refresh, POLL_MS)
    const giveUp = setTimeout(() => setCheckout('slow'), POLL_LIMIT_MS)
    return () => {
      clearInterval(poll)
      clearTimeout(giveUp)
    }
  }, [checkout, subscribed, refresh, paddle])

  // Essai : prix Paddle avec période d'essai (carte demandée, premier prélèvement à la fin), proposé par le serveur
  // à un compte jamais abonné (/api/paddle/config, trial).
  const trial = paddle?.config.trial
  const priceText = name => {
    const price = paddle && prices[paddle.config.prices[name]]
    return price && t(name === 'yearly' ? 'plus.perYear' : 'plus.perMonth', { price: priceLabel(price, lang) })
  }

  function subscribe() {
    setCheckout('opening')
    try {
      paddle.Paddle.Checkout.open({
        items: [{ priceId: (trial?.prices ?? paddle.config.prices)[plan], quantity: 1 }],
        customer: { email: account.login },
        // relie l'abonnement au compte dans le webhook (server/app.js)
        customData: { email: account.login },
        settings: { displayMode: 'overlay', locale: lang, theme: 'dark', allowLogout: false },
      })
    } catch {
      setCheckout('error')
    }
  }

  async function openPortal() {
    setPortal('opening')
    try {
      const response = await fetch('/api/paddle/portal', { method: 'POST' })
      if (!response.ok) throw new Error(`Espace client indisponible (${response.status})`)
      location.assign((await response.json()).url)
    } catch {
      setPortal('error')
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

        {canSubscribe && paddle && (
          <div className="mt-8">
            <ul role="radiogroup" aria-label={t('plus.title')} className="grid gap-2">
              {PLANS.map(name => {
                const price = priceText(name)
                return (
                  <li key={name}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={plan === name}
                      onClick={() => setPlan(name)}
                      className={`flex h-14 w-full items-center justify-between rounded-2xl border bg-card px-4 text-left transition-colors duration-150 ease-out ${plan === name ? 'border-accent' : 'border-line hover:bg-raised'}`}
                    >
                      <span className="text-base font-medium text-fg">{t(`plus.${name}`)}</span>
                      {price && <span className="text-[15px] text-fg-2">{price}</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
            <Button className="mt-4" onClick={subscribe} disabled={checkout === 'opening' || checkout === 'activating'}>
              {checkout === 'opening' ? t('plus.opening') : trial ? t('plus.startTrial', { days: trial.days }) : t('plus.subscribe')}
            </Button>
            {trial && <p className="mt-3 text-center text-sm text-fg-2">{t('plus.trialTerms', { days: trial.days })}</p>}
            <p className="mt-3 text-center text-sm text-fg-3">{t('plus.noCommitment')}</p>
            <p className="mt-2 text-center text-sm text-fg-3">
              {t('plus.legalIntro')}{' '}
              <a className="underline decoration-line-2 underline-offset-2 hover:text-fg" href="/legal/conditions.html" target="_blank" rel="noreferrer">{t('settings.legalTerms')}</a>
              {' · '}
              <a className="underline decoration-line-2 underline-offset-2 hover:text-fg" href="/legal/confidentialite.html" target="_blank" rel="noreferrer">{t('settings.legalPrivacy')}</a>
              {' · '}
              <a className="underline decoration-line-2 underline-offset-2 hover:text-fg" href="/legal/remboursement.html" target="_blank" rel="noreferrer">{t('settings.legalRefunds')}</a>
            </p>
          </div>
        )}
        {checkout === 'activating' && !subscribed && <p role="status" className="mt-3 text-center text-[15px] text-fg-2">{t('plus.activating')}</p>}
        {checkout === 'slow' && !subscribed && <p role="status" className="mt-3 text-center text-[15px] text-fg-2">{t('plus.activationSlow')}</p>}
        {checkout === 'error' && <p role="alert" className="mt-3 text-center text-sm text-bad">{t('plus.paymentError')}</p>}

        {canSubscribe && paddle === null && !access?.plus && (
          <p className="mt-8 text-center text-[15px] text-fg-2">{t('plus.availableSoon')}</p>
        )}

        {access?.subscription && (
          <div className="mt-8">
            <Button variant="secondary" onClick={openPortal} disabled={portal === 'opening'}>{t('plus.manage')}</Button>
            {portal === 'error' && <p role="alert" className="mt-2 text-center text-sm text-bad">{t('plus.manageError')}</p>}
          </div>
        )}
      </div>
    </Screen>
  )
}
