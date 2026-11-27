import { useEffect, useState } from 'react'
import { Ban, Check, Copy, Flame, Pencil, Share2, Trophy, UserPlus, X } from 'lucide-react'
import { capture } from '../analytics.js'
import { useLang } from '../i18n/useLang.js'
import { XP_ANSWER, XP_LEARNED, XP_LESSON } from '../utils/activity.js'
import { Button, Screen, SectionLabel, Seal, TopBar } from './ui.jsx'
import { ICON, ICON_SM } from './uiStyles.js'

const inputClass = 'h-12 w-full rounded-[10px] border border-line bg-raised px-4 text-base text-fg outline-none focus:border-line-2'
const linkButton = 'inline-flex items-center gap-1.5 text-sm font-medium text-fg-2 transition-colors duration-150 ease-out hover:text-fg'

// Erreurs que la page sait expliquer (friends.error.*) ; les autres deviennent « generic ».
const KNOWN_ERRORS = new Set(['invalid_name', 'name_taken', 'profile_required', 'not_found', 'self', 'blocked', 'too_many', 'recipient_full'])

/** Appel de /api/social/* : { ok, data } ou { ok: false, error } (code de friends.error.*). */
async function send(method, path, body) {
  try {
    const response = await fetch(`/api/social${path}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = await response.json().catch(() => ({}))
    return response.ok ? { ok: true, data } : { ok: false, error: KNOWN_ERRORS.has(data.error) ? data.error : 'generic' }
  } catch {
    return { ok: false, error: 'offline' }
  }
}

/** Avatar : le caractère choisi dans le sceau ; 人 pour un compte sans profil. */
function Avatar({ person, className = '' }) {
  return <Seal className={className}>{person.avatar || '人'}</Seal>
}

function personName(t, person) {
  return person.name || t('friends.noName')
}

/** Pseudo et avatar du profil social. */
function ProfileForm({ social, onSaved, onCancel }) {
  const { t } = useLang()
  const [name, setName] = useState(social.profile?.name || '')
  const [avatar, setAvatar] = useState(social.profile?.avatar || social.avatars[0])
  const [state, setState] = useState({ saving: false, error: null })

  async function save(event) {
    event.preventDefault()
    setState({ saving: true, error: null })
    const result = await send('PUT', '/profile', { name, avatar })
    if (!result.ok) return setState({ saving: false, error: result.error })
    if (!social.profile) capture('profile_created')
    if (!await onSaved()) setState({ saving: false, error: 'refresh' })
  }

  return (
    <form onSubmit={save} className="rounded-2xl border border-line bg-card p-4">
      <p className="text-[15px] leading-relaxed text-fg-2">{t('friends.profileIntro')}</p>
      <label className="mt-4 block text-sm text-fg-2">
        {t('friends.name')}
        <input
          value={name}
          onChange={event => setName(event.target.value)}
          maxLength={20}
          autoComplete="nickname"
          className={`mt-2 ${inputClass}`}
        />
      </label>
      <p className="mt-1 text-xs text-fg-3">{t('friends.nameRules')}</p>
      <fieldset className="mt-4">
        <legend className="text-sm text-fg-2">{t('friends.avatar')}</legend>
        <div className="mt-2 grid grid-cols-8 gap-2">
          {social.avatars.map(char => (
            <button
              key={char}
              type="button"
              aria-pressed={char === avatar}
              onClick={() => setAvatar(char)}
              className={`hanzi-display flex aspect-square items-center justify-center rounded-lg text-xl transition-colors duration-150 ease-out ${char === avatar ? 'bg-seal text-white' : 'bg-raised text-fg-2 hover:bg-raised-2'}`}
            >
              {char}
            </button>
          ))}
        </div>
      </fieldset>
      {state.error && <p role="alert" className="mt-3 text-sm text-bad">{t(`friends.error.${state.error}`)}</p>}
      <div className={`mt-4 grid gap-2 ${onCancel ? 'grid-cols-2' : ''}`}>
        {onCancel && <Button variant="secondary" onClick={onCancel}>{t('friends.cancel')}</Button>}
        <Button type="submit" disabled={state.saving || [...name.trim()].length < 3}>{t('friends.saveProfile')}</Button>
      </div>
    </form>
  )
}

/** Classement de la semaine : moi et mes amis ; un ami touché montre Retirer et Bloquer. */
function Leaderboard({ social, onAction, busy }) {
  const { t, lang } = useLang()
  const [open, setOpen] = useState(null)
  const date = day => new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`))
  const daysLeft = Math.round((Date.parse(social.week.end) - Date.parse(social.week.today)) / 86_400_000)

  return (
    <section>
      <SectionLabel className="mt-8 mb-1">{t('friends.weekTitle')}</SectionLabel>
      <p className="mb-3 text-sm text-fg-3">
        {t('friends.weekRange', { start: date(social.week.start), end: date(social.week.end) })} · {daysLeft === 0 ? t('friends.endsToday') : daysLeft === 1 ? t('friends.endsTomorrow') : t('friends.endsIn', { n: daysLeft })}
      </p>
      <ol className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
        {social.leaderboard.map((row, index) => (
          <li key={row.code}>
            <button
              type="button"
              disabled={row.me}
              onClick={() => setOpen(open === row.code ? null : row.code)}
              aria-expanded={row.me ? undefined : open === row.code}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 ease-out enabled:hover:bg-raised ${row.me ? 'bg-accent/10' : ''}`}
            >
              <span className={`w-6 shrink-0 text-center text-base font-medium tabular-nums ${index === 0 && row.xp > 0 ? 'text-accent' : 'text-fg-3'}`}>{index + 1}</span>
              <Avatar person={row} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-medium text-fg">
                  {personName(t, row)}{row.me && <span className="font-normal text-fg-3"> · {t('friends.you')}</span>}
                </span>
                <span className="mt-0.5 flex items-center gap-3 text-sm tabular-nums text-fg-3">
                  <span className="inline-flex items-center gap-1"><Flame {...ICON_SM} className={row.streak > 0 ? 'text-accent' : ''} />{row.streak}</span>
                  <span className="inline-flex items-center gap-1"><Trophy {...ICON_SM} />{row.trophies}</span>
                </span>
              </span>
              <span className="shrink-0 text-base font-medium tabular-nums text-fg">{t('friends.xp', { n: row.xp })}</span>
            </button>
            {open === row.code && (
              <div className="flex gap-5 px-4 pb-3 pl-[4.25rem]">
                <button type="button" disabled={busy} className={linkButton} onClick={() => onAction('DELETE', `/friends/${row.code}`)}>
                  <X {...ICON_SM} />{t('friends.remove')}
                </button>
                <button type="button" disabled={busy} className={linkButton} onClick={() => onAction('POST', '/blocks', { code: row.code })}>
                  <Ban {...ICON_SM} />{t('friends.block')}
                </button>
              </div>
            )}
          </li>
        ))}
      </ol>
      {social.leaderboard.length === 1 && <p className="mt-3 text-sm text-fg-2">{t('friends.alone')}</p>}
      <p className="mt-3 text-xs leading-relaxed text-fg-3">{t('friends.xpRules', { answer: XP_ANSWER, learned: XP_LEARNED, lesson: XP_LESSON })}</p>
    </section>
  )
}

/** Mon lien et mon code, et l'ajout d'un ami par son code (pré-rempli quand l'app s'ouvre avec ?ref=CODE). */
function AddFriend({ social, initialCode, onAdded }) {
  const { t } = useLang()
  const [code, setCode] = useState(initialCode || '')
  const [message, setMessage] = useState(null) // { good, key }
  const [copied, setCopied] = useState(false)

  async function add(event) {
    event.preventDefault()
    const result = await send('POST', '/friends', { code: code.trim().toUpperCase() })
    if (!result.ok) return setMessage({ good: false, key: `friends.error.${result.error}` })
    capture('friend_request_sent', { status: result.data.status })
    setCode('')
    setMessage({ good: true, key: result.data.status === 'accepted' ? 'friends.nowFriends' : 'friends.requestSent' })
    if (!await onAdded()) setMessage({ good: false, key: 'friends.error.refresh' })
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(social.link)
      capture('friend_link_shared', { method: 'copy' })
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      setMessage({ good: false, key: 'friends.error.generic' })
    }
  }

  async function share() {
    try {
      await navigator.share({ title: 'Yidiano', text: t('friends.shareText'), url: social.link })
      capture('friend_link_shared', { method: 'share' })
    } catch (error) {
      if (error.name !== 'AbortError') setMessage({ good: false, key: 'friends.error.generic' })
    }
  }

  const canShare = typeof navigator.share === 'function'
  return (
    <section>
      <SectionLabel className="mt-8">{t('friends.addTitle')}</SectionLabel>
      <div className="rounded-2xl border border-line bg-card p-4">
        <p className="text-sm text-fg-3">{t('friends.yourCode')}</p>
        <p className="mt-1 font-mono text-xl font-medium tracking-widest text-fg">{social.code}</p>
        <p className="mt-2 text-sm leading-relaxed text-fg-2">{t('friends.linkHint')}</p>
        <div className={`mt-3 grid gap-2 ${canShare ? 'grid-cols-2' : ''}`}>
          {canShare && <Button onClick={share}><Share2 {...ICON} />{t('friends.share')}</Button>}
          <Button variant={canShare ? 'secondary' : 'primary'} onClick={copy}>
            {copied ? <Check {...ICON} /> : <Copy {...ICON} />}{t(copied ? 'ref.copied' : 'ref.copy')}
          </Button>
        </div>
      </div>
      <form onSubmit={add} className="mt-3 rounded-2xl border border-line bg-card p-4">
        <label className="block text-sm text-fg-2">
          {t('friends.friendCode')}
          <input
            value={code}
            onChange={event => setCode(event.target.value.toUpperCase())}
            maxLength={8}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="ABCD2345"
            className={`mt-2 font-mono tracking-widest uppercase ${inputClass}`}
          />
        </label>
        <Button type="submit" className="mt-3" disabled={code.trim().length !== 8}><UserPlus {...ICON} />{t('friends.sendRequest')}</Button>
        {message && <p role="status" className={`mt-3 text-sm ${message.good ? 'text-good' : 'text-bad'}`}>{t(message.key)}</p>}
      </form>
    </section>
  )
}

/**
 * Amis (server/social.js) : pseudo et avatar, demandes reçues, classement de la semaine en XP, ajout d'un ami par
 * lien ou code, demandes envoyées, comptes bloqués. social : données de useSocial ; refresh : les recharge.
 */
export function FriendsPage({ social, refresh, initialCode, onBack, onOpenTrophies }) {
  const { t } = useLang()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    refresh().then(data => { if (active && !data) setError('offline') })
    return () => { active = false }
  }, [refresh])

  async function act(method, path, body) {
    setBusy(true)
    setError(null)
    try {
      const result = await send(method, path, body)
      if (!result.ok) return setError(result.error)
      if (!await refresh()) setError('refresh')
    } finally {
      setBusy(false)
    }
  }

  const trophies = (
    <button type="button" onClick={onOpenTrophies} className={`-mr-2 h-9 rounded-lg px-2 ${linkButton}`}>
      <Trophy {...ICON} />{t('trophies.title')}
    </button>
  )

  let content
  if (!social) {
    content = <p role="alert" className="mt-8 text-center text-[15px] text-fg-2">{t('friends.offline')}</p>
  } else if (!social.profile || editing) {
    content = (
      <ProfileForm
        social={social}
        onCancel={social.profile ? () => setEditing(false) : null}
        onSaved={async () => {
          const data = await refresh()
          if (data) setEditing(false)
          return data
        }}
      />
    )
  } else {
    content = (
      <>
        <div className="flex items-center gap-3">
          <Avatar person={social.profile} />
          <p className="min-w-0 flex-1 truncate text-lg font-medium text-fg">{social.profile.name}</p>
          <button type="button" onClick={() => setEditing(true)} className={linkButton}><Pencil {...ICON_SM} />{t('friends.edit')}</button>
        </div>

        {social.incoming.length > 0 && (
          <section>
            <SectionLabel className="mt-8">{t('friends.incoming')}</SectionLabel>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-accent/40 bg-card">
              {social.incoming.map(person => (
                <li key={person.code} className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar person={person} />
                    <span className="min-w-0 flex-1 truncate text-base font-medium text-fg">{personName(t, person)}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button variant="secondary" disabled={busy} onClick={() => act('DELETE', `/friends/${person.code}`)}>{t('friends.decline')}</Button>
                    <Button disabled={busy} onClick={() => act('POST', '/friends', { code: person.code })}><Check {...ICON} />{t('friends.accept')}</Button>
                  </div>
                  <button type="button" disabled={busy} className={`mt-2 ${linkButton}`} onClick={() => act('POST', '/blocks', { code: person.code })}>
                    <Ban {...ICON_SM} />{t('friends.block')}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <Leaderboard social={social} onAction={act} busy={busy} />
        <AddFriend social={social} initialCode={initialCode} onAdded={refresh} />

        {social.outgoing.length > 0 && (
          <section>
            <SectionLabel className="mt-8">{t('friends.outgoing')}</SectionLabel>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
              {social.outgoing.map(request => (
                <li key={request.code} className="flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1 text-[15px] text-fg-2">{t('friends.pendingCode')} <span className="font-mono tracking-widest text-fg">{request.code}</span></span>
                  <button type="button" disabled={busy} className={linkButton} onClick={() => act('DELETE', `/friends/${request.code}`)}>{t('friends.cancel')}</button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {social.blocked.length > 0 && (
          <section>
            <SectionLabel className="mt-8">{t('friends.blocked')}</SectionLabel>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
              {social.blocked.map(person => (
                <li key={person.code} className="flex items-center gap-3 px-4 py-3">
                  <Avatar person={person} className="opacity-40" />
                  <span className="min-w-0 flex-1 truncate text-[15px] text-fg-2">{personName(t, person)}</span>
                  <button type="button" disabled={busy} className={linkButton} onClick={() => act('DELETE', `/blocks/${person.code}`)}>{t('friends.unblock')}</button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </>
    )
  }

  return (
    <Screen>
      <TopBar onBack={onBack} title={<>{t('friends.title')} <span className="chinese-text text-fg-2">朋友</span></>} aside={trophies} bordered />
      <div className="flex flex-col px-5 py-6">
        {error && <p role="alert" className="mb-4 text-sm text-bad">{t(`friends.error.${error}`)}</p>}
        {content}
      </div>
    </Screen>
  )
}
