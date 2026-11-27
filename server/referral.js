import { createHash, randomInt } from 'node:crypto'
import { extendBilling } from './paddle.js'

/*
 * Parrainage. Chaque compte a un lien personnel https://yidiano.com/?ref=CODE. Le visiteur qui l'ouvre reçoit le
 * cookie REF_COOKIE (30 jours) ; s'il crée son compte (première connexion, e-mail ou Google), il devient filleul du
 * propriétaire du code. Quand ce filleul enregistre sa carte (abonnement Paddle « trialing » ou « active », essai de
 * 15 jours compris), le parrain gagne un mois de Yidiano+ :
 *   - abonné Paddle en cours (actif ou en essai, sans résiliation programmée) : prochain prélèvement repoussé d'un
 *     mois, sans frais (Paddle, next_billed_at) ;
 *   - sinon : 30 jours de Yidiano+ (bonus_until), ajoutés après l'accès déjà ouvert.
 * Une adresse ne rapporte qu'une fois ; au plus MAX_MONTHS_PER_YEAR mois par parrain sur 365 jours glissants.
 */

export const REF_COOKIE = 'yidiano_ref'
export const REF_TTL = 30 * 24 * 3600 // s
export const MAX_MONTHS_PER_YEAR = 12
const BONUS = 30 * 24 * 3600_000
const YEAR = 365 * 24 * 3600_000
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sans 0/O, 1/I
export const REF_CODE = /^[A-HJ-NP-Z2-9]{8}$/

export const newReferralCode = () => Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')
const refereeHash = (email) => createHash('sha256').update(email).digest('hex')

/** Compte arrivé par un lien de parrainage : son essai Yidiano+ dure REFERRAL_TRIAL_DAYS jours (server/paddle.js). */
export const isReferee = (db, email) => db.referrals.referrerOf(refereeHash(email)) !== null

/** Première connexion d'un compte arrivé par un lien de parrainage (code du cookie) : l'enregistre comme filleul. */
export function attachReferral(db, email, code, now = Date.now()) {
  if (!db.accounts.firstLogin(email, now) || !REF_CODE.test(code || '')) return false
  const referrer = db.accounts.byReferralCode(code)
  if (!referrer || referrer.email === email) return false
  // Une invitation sociale est facultative : un plafond ou un blocage ne doit pas annuler le parrainage.
  db.social.request(email, referrer.email, now)
  return db.referrals.add(refereeHash(email), referrer.email, now)
}

/**
 * Le filleul vient d'enregistrer sa carte : récompense son parrain (une seule fois par filleul). Renvoie la
 * récompense : 'billing_delay' | 'access' | 'capped' | 'gone', ou null si l'adresse n'est pas un filleul à récompenser.
 */
export async function rewardReferrer(db, paddle, refereeEmail, log, now = Date.now()) {
  const hash = refereeHash(refereeEmail)
  const referrerEmail = db.referrals.qualify(hash, now)
  if (!referrerEmail) return null
  const referrer = db.accounts.get(referrerEmail)
  let reward
  if (!referrer) reward = 'gone'
  else if (db.referrals.stats(referrerEmail, now - YEAR).monthsYear >= MAX_MONTHS_PER_YEAR) reward = 'capped'
  else {
    const renewing = ['active', 'trialing'].includes(referrer.paddle_status) && !referrer.paddle_cancel_at
    if (paddle && referrer.paddle_subscription_id && renewing) {
      try {
        await extendBilling(paddle, referrer.paddle_subscription_id)
        reward = 'billing_delay'
      } catch (err) {
        // Prélèvement imminent ou refusé par Paddle : le mois est donné en accès, à vérifier dans Paddle.
        log.warn({ err, referrer: referrerEmail }, 'parrainage : report du prélèvement Paddle impossible, mois offert en accès')
      }
    }
    if (!reward) {
      const from = Math.max(now, referrer.bonus_until || 0, referrer.plus_expires_at || 0)
      db.accounts.setBonusUntil(referrerEmail, from + BONUS)
      reward = 'access'
    }
  }
  db.referrals.setReward(hash, reward)
  log.info({ referrer: referrerEmail, reward }, 'parrainage récompensé')
  return reward
}
