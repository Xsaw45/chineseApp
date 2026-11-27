import { newReferralCode, REF_CODE } from './referral.js'
export { MAX_RELATIONS } from './db.js'

/*
 * Amis, classement de la semaine et trophées des amis. Un compte se montre aux autres par un pseudo et un avatar
 * (profiles), jamais par son adresse. On devient amis par une demande acceptée : demande envoyée avec le code ami
 * (le code du lien de parrainage, server/referral.js) ou faite en créant son compte depuis ce lien. Rien n'est visible
 * d'un compte tant que la demande n'est pas acceptée, sauf le pseudo du demandeur pour celui qui la reçoit.
 *
 * Classement : XP gagnés par chaque ami du lundi au dimanche, d'après ses journées d'activité synchronisées
 * (act_AAAA-MM-JJ, src/utils/activity.js ; jours UTC, comme l'app). L'appareil écrit lui-même ses XP : une journée
 * compte au plus DAY_XP_CAP XP. Ce plafond limite les abus mais ne vérifie pas les XP déclarés par le client.
 */

export const DAY_XP_CAP = 3000
// Avatars proposés : un caractère dans le sceau vermillon de l'app.
export const AVATARS = ['龙', '虎', '猫', '熊', '马', '鸟', '鱼', '兔', '狗', '猴', '羊', '牛', '蛇', '鸡', '猪', '鼠']
const NAME = /^[\p{L}\p{N}][\p{L}\p{N} _.-]*$/u
const NAME_MIN = 3
const NAME_MAX = 20
const RESERVED = ['yidiano', 'admin', 'moderat']

const DAY = 24 * 3600_000
const dayOf = (time) => new Date(time).toISOString().slice(0, 10)
const addDays = (day, n) => dayOf(Date.parse(`${day}T00:00:00Z`) + n * DAY)
/** Lundi de la semaine du jour (AAAA-MM-JJ, UTC). */
export const weekStart = (day) => addDays(day, -((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7))

/** Pseudo affiché et forme comparée (unique), ou null s'il n'est pas valable. */
export function cleanName(raw) {
  const name = String(raw ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ')
  const length = [...name].length
  if (length < NAME_MIN || length > NAME_MAX || !NAME.test(name)) return null
  const nameKey = name.toLocaleLowerCase('fr')
  if (RESERVED.some(word => nameKey.replace(/[\s_.-]/g, '').includes(word))) return null
  return { name, nameKey }
}

/**
 * XP de la semaine en cours et de la précédente, et série de jours (jusqu'à aujourd'hui, ou hier tant
 * qu'aujourd'hui n'est pas pratiqué, comme activityStats dans l'app). days : journées, la plus récente d'abord.
 */
export function weekStats(days, today) {
  const start = weekStart(today)
  const previous = addDays(start, -7)
  let xp = 0
  let lastWeekXp = 0
  const practiced = new Set()
  for (const { day, practiced: active, xp: dayXp } of days) {
    const capped = Math.min(Math.max(0, Number(dayXp) || 0), DAY_XP_CAP)
    if (day >= start && day <= today) xp += capped
    else if (day >= previous && day < start) lastWeekXp += capped
    if (active) practiced.add(day)
  }
  let streak = 0
  for (let day = practiced.has(today) ? today : addDays(today, -1); practiced.has(day); day = addDays(day, -1)) streak++
  return { xp, lastWeekXp, streak }
}

/** Routes /api/social/* (session obligatoire, voir server/app.js). */
export function socialRoutes({ db, publicUrl }) {
  const codeOf = (email) => db.accounts.referralCode(email, newReferralCode)
  /** Compte d'un code ami, ou null. */
  const byCode = (code) => (REF_CODE.test(code || '') ? db.accounts.byReferralCode(code) : null)
  const codeBody = {
    type: 'object', required: ['code'], additionalProperties: false,
    properties: { code: { type: 'string', maxLength: 20 } },
  }
  const codeParams = { type: 'object', required: ['code'], properties: { code: { type: 'string', maxLength: 20 } } }

  return async (api) => {
    // Tout ce que la page Amis affiche : profil, classement de la semaine, demandes reçues et envoyées, blocages.
    api.get('/', async (request) => {
      const me = request.user.login
      const today = dayOf(Date.now())
      const profile = db.social.profile(me)
      const relations = db.social.relations(me).map(row => ({ ...row, code: row.code || codeOf(row.other) }))
      const person = (row) => ({ code: row.code, name: row.name ?? null, avatar: row.avatar ?? null })

      const entry = (email, extra) => {
        const stats = weekStats(db.social.activity(email), today)
        return { row: { ...extra, xp: stats.xp, streak: stats.streak, trophies: db.social.trophies(email) }, lastWeekXp: stats.lastWeekXp }
      }
      const friends = relations.filter(row => row.status === 'accepted')
      const board = [
        entry(me, { me: true, code: codeOf(me), name: profile?.name ?? null, avatar: profile?.avatar ?? null }),
        ...friends.map(row => entry(row.other, { me: false, ...person(row) })),
      ]
      // Rang de la semaine passée parmi les amis d'aujourd'hui (trophée « premier de la semaine ») : seulement avec
      // au moins un ami et des XP cette semaine-là.
      const mine = board[0].lastWeekXp
      const lastWeek = board.length > 1 && mine > 0
        ? { rank: 1 + board.filter(other => other.lastWeekXp > mine).length, size: board.length }
        : null
      const leaderboard = board
        .map(item => item.row)
        .sort((a, b) => b.xp - a.xp || b.streak - a.streak || (a.name || '').localeCompare(b.name || ''))

      const start = weekStart(today)
      return {
        profile,
        code: codeOf(me),
        link: `${publicUrl}/?ref=${codeOf(me)}`,
        avatars: AVATARS,
        week: { start, end: addDays(start, 6), today },
        leaderboard,
        lastWeek,
        incoming: relations.filter(row => row.status === 'pending' && !row.mine).map(person),
        // Demande envoyée : le pseudo de l'autre n'est montré qu'une fois la demande acceptée.
        outgoing: relations.filter(row => row.status === 'pending' && row.mine).map(row => ({ code: row.code })),
        blocked: relations.filter(row => row.status === 'blocked' && row.mine).map(person),
      }
    })

    api.put('/profile', {
      schema: {
        body: {
          type: 'object', required: ['name', 'avatar'], additionalProperties: false,
          properties: { name: { type: 'string', maxLength: 100 }, avatar: { type: 'string', enum: AVATARS } },
        },
      },
    }, async (request, reply) => {
      const clean = cleanName(request.body.name)
      if (!clean) return reply.code(400).send({ error: 'invalid_name' })
      if (!db.social.setProfile(request.user.login, { ...clean, avatar: request.body.avatar })) {
        return reply.code(409).send({ error: 'name_taken' })
      }
      return db.social.profile(request.user.login)
    })

    // Demande d'ami avec un code ; accepte la demande déjà reçue de ce compte. Un compte qui m'a bloqué répond
    // comme un code inconnu.
    api.post('/friends', { schema: { body: codeBody } }, async (request, reply) => {
      const me = request.user.login
      if (!db.social.profile(me)) return reply.code(403).send({ error: 'profile_required' })
      const other = byCode(request.body.code.trim().toUpperCase())
      if (!other) return reply.code(404).send({ error: 'not_found' })
      if (other.email === me) return reply.code(400).send({ error: 'self' })
      const pair = db.social.pair(me, other.email)
      if (pair?.status === 'blocked') {
        return pair.requester === me ? reply.code(409).send({ error: 'blocked' }) : reply.code(404).send({ error: 'not_found' })
      }
      if (pair?.status === 'accepted') return { status: 'accepted' }
      if (pair?.status === 'pending') {
        if (pair.requester === me) return { status: 'pending' }
        db.social.accept(other.email, me)
        return { status: 'accepted' }
      }
      const result = db.social.request(me, other.email)
      if (result !== 'pending') return reply.code(409).send({ error: result })
      return { status: result }
    })

    // Retire un ami, refuse une demande reçue ou annule une demande envoyée (pas un blocage).
    api.delete('/friends/:code', { schema: { params: codeParams } }, async (request) => {
      const other = byCode(request.params.code)
      const pair = other && db.social.pair(request.user.login, other.email)
      if (pair && pair.status !== 'blocked') db.social.unlink(request.user.login, other.email)
      return { ok: true }
    })

    // Bloquer : la relation disparaît des deux côtés et ce compte ne peut plus envoyer de demande.
    api.post('/blocks', { schema: { body: codeBody } }, async (request, reply) => {
      const me = request.user.login
      const other = byCode(request.body.code)
      if (!other) return reply.code(404).send({ error: 'not_found' })
      if (other.email === me) return reply.code(400).send({ error: 'self' })
      db.social.block(me, other.email)
      return { ok: true }
    })

    api.delete('/blocks/:code', { schema: { params: codeParams } }, async (request) => {
      const me = request.user.login
      const other = byCode(request.params.code)
      if (other) db.social.unblock(me, other.email)
      return { ok: true }
    })
  }
}
