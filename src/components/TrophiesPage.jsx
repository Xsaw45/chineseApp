import { useEffect } from 'react'
import { Trophy, X } from 'lucide-react'
import { useLang } from '../i18n/useLang.js'
import { earnedCount, TROPHIES, TROPHY_GROUPS, trophyContext, trophyDate, trophyName } from '../utils/trophies.js'
import { ProgressBar, Screen, SectionLabel, TopBar } from './ui.jsx'
import { ICON, ICON_SM } from './uiStyles.js'

const TOAST_MS = 6000

function TrophyCard({ trophy, ctx, progressMap }) {
  const { t, lang } = useLang()
  const date = trophyDate(progressMap, trophy.id)
  const progress = trophy.progress(ctx)
  return (
    <li className={`flex items-center gap-3 rounded-2xl border p-4 ${date ? 'border-accent/40 bg-card' : 'border-line bg-page'}`}>
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${date ? 'bg-accent text-white' : 'bg-raised text-fg-3'}`}>
        <Trophy size={20} strokeWidth={1.75} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-base font-medium ${date ? 'text-fg' : 'text-fg-2'}`}>{trophyName(t, lang, trophy)}</span>
        {date ? (
          <span className="mt-0.5 block text-sm text-fg-3">
            {t('trophies.earnedOn', { date: new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`)) })}
          </span>
        ) : progress && progress.goal > 1 ? (
          <>
            <ProgressBar value={progress.value / progress.goal} className="mt-2" />
            <span className="mt-1 block text-xs tabular-nums text-fg-3">
              {new Intl.NumberFormat(lang).format(Math.min(progress.value, progress.goal))} / {new Intl.NumberFormat(lang).format(progress.goal)}
            </span>
          </>
        ) : (
          <span className="mt-0.5 block text-sm text-fg-3">{t('trophies.locked')}</span>
        )}
      </span>
    </li>
  )
}

/** Tous les trophées par section : obtenus (avec leur date) ou en cours (progression vers le palier). */
export function TrophiesPage({ progressMap, levelStats, social, onBack }) {
  const { t } = useLang()
  const ctx = trophyContext(progressMap, levelStats, social)
  return (
    <Screen>
      <TopBar onBack={onBack} title={<>{t('trophies.title')} <span className="chinese-text text-fg-2">奖杯</span></>} bordered />
      <div className="flex flex-col px-5 py-6">
        <p className="text-[15px] text-fg-2">{t('trophies.count', { n: earnedCount(progressMap), total: TROPHIES.length })}</p>
        {TROPHY_GROUPS.map(group => (
          <section key={group}>
            <SectionLabel className="mt-8">{t(`trophies.group.${group}`)}</SectionLabel>
            <ul className="flex flex-col gap-2">
              {TROPHIES.filter(trophy => trophy.group === group).map(trophy => (
                <TrophyCard key={trophy.id} trophy={trophy} ctx={ctx} progressMap={progressMap} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Screen>
  )
}

/** Annonce d'un trophée obtenu, en bas de l'écran ; la toucher ouvre la page Trophées. */
export function TrophyToast({ earned, onOpen, onDismiss }) {
  const { t, lang } = useLang()
  useEffect(() => {
    if (!earned.length) return undefined
    const timer = setTimeout(onDismiss, TOAST_MS)
    return () => clearTimeout(timer)
  }, [earned, onDismiss])
  if (!earned.length) return null
  const text = earned.length === 1 ? t('trophies.toastOne', { name: trophyName(t, lang, earned[0]) }) : t('trophies.toastMany', { n: earned.length })
  return (
    <div role="status" className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-xl px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
      <div className="flex items-center gap-3 rounded-2xl border border-accent/40 bg-raised p-3 shadow-lg">
        <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-white">
            <Trophy {...ICON} />
          </span>
          <span className="text-[15px] font-medium leading-snug text-fg">{text}</span>
        </button>
        <button type="button" onClick={onDismiss} aria-label={t('trophies.dismiss')} className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-fg-3 hover:text-fg">
          <X {...ICON_SM} />
        </button>
      </div>
    </div>
  )
}
