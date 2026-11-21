import { DatabaseSync } from 'node:sqlite'

// Journées d'activité (src/utils/activity.js) : chaque appareil écrit ses propres totaux du jour.
const ACTIVITY = /^act_\d{4}-\d{2}-\d{2}$/
const isPracticed = day => day.practiced !== false // absent : enregistrement d'avant ce champ, toujours pratiqué

/** Union de deux versions d'une même journée : pratiquée si l'une l'est, totaux maximaux, étapes réunies. */
function mergeActivity(a, b) {
  const max = field => Math.max(a[field] || 0, b[field] || 0)
  const merged = { ...a, ...b, practiced: isPracticed(a) || isPracticed(b), learned: max('learned'), seconds: max('seconds') }
  if (a.done || b.done) merged.done = [...new Set([...(a.done || []), ...(b.done || [])])]
  if ('vocabTests' in a || 'vocabTests' in b) merged.vocabTests = max('vocabTests')
  return merged
}

/** JSON indépendant de l'ordre des clés, pour comparer deux versions. */
const canonical = value => JSON.stringify(Object.keys(value).sort().map(key => [key, value[key]]))

// Progression par utilisateur : un enregistrement par (user, app, key), le plus recent (updated_at, horloge de
// l'appareil) gagne. seq = compteur global, incremente a chaque ecriture acceptee : un appareil demande
// "tout ce qui a change depuis seq N" (son curseur).
// Connexion par e-mail (acces public, voir auth.js) : une demande en cours par adresse (lien + code), sessions.
// Jetons et codes ne sont stockes que hashes (SHA-256).
export function openDb(path) {
  const db = new DatabaseSync(path)
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS records (
      user TEXT NOT NULL,
      app TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT,
      updated_at INTEGER NOT NULL,
      seq INTEGER NOT NULL,
      PRIMARY KEY (user, app, key)
    ) WITHOUT ROWID;
    CREATE INDEX IF NOT EXISTS records_by_seq ON records (user, app, seq);
    CREATE TABLE IF NOT EXISTS counter (id INTEGER PRIMARY KEY CHECK (id = 1), seq INTEGER NOT NULL);
    INSERT OR IGNORE INTO counter (id, seq) VALUES (1, 0);
    CREATE TABLE IF NOT EXISTS login_requests (
      email TEXT PRIMARY KEY,
      token_hash TEXT NOT NULL UNIQUE,
      code_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      attempts INTEGER NOT NULL,
      sent_at INTEGER NOT NULL,
      window_start INTEGER NOT NULL,
      sent_count INTEGER NOT NULL
    ) WITHOUT ROWID;
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    ) WITHOUT ROWID;
    CREATE TABLE IF NOT EXISTS accounts (
      email TEXT PRIMARY KEY,
      role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'beta', 'user')),
      plus_expires_at INTEGER,
      created_at INTEGER NOT NULL
    ) WITHOUT ROWID;
  `)
  // Abonnement Paddle (server/paddle.js) : colonnes ajoutées aux bases créées avant les paiements.
  // paddle_event_at : date du dernier événement appliqué (Paddle peut livrer les webhooks dans le désordre).
  const accountColumns = new Set(db.prepare('PRAGMA table_info(accounts)').all().map(column => column.name))
  for (const [name, type] of [
    ['paddle_customer_id', 'TEXT'], ['paddle_subscription_id', 'TEXT'], ['paddle_status', 'TEXT'],
    ['paddle_cancel_at', 'INTEGER'], ['paddle_event_at', 'INTEGER'],
  ]) {
    if (!accountColumns.has(name)) db.exec(`ALTER TABLE accounts ADD COLUMN ${name} ${type}`)
  }
  // Ancien essai de 7 jours sans carte, remplacé par l'essai Paddle : colonnes retirées des bases existantes.
  for (const name of ['trial_started_at', 'trial_expires_at']) {
    if (accountColumns.has(name)) db.exec(`ALTER TABLE accounts DROP COLUMN ${name}`)
  }
  db.exec('CREATE INDEX IF NOT EXISTS accounts_by_paddle_customer ON accounts (paddle_customer_id)')

  // Parrainage (server/referral.js). first_login_at : première connexion (seul un compte qui se connecte pour la
  // première fois peut être parrainé) ; referral_code : code du lien personnel ; bonus_until : Yidiano+ offert.
  for (const [name, type] of [['first_login_at', 'INTEGER'], ['referral_code', 'TEXT'], ['bonus_until', 'INTEGER']]) {
    if (accountColumns.has(name)) continue
    db.exec(`ALTER TABLE accounts ADD COLUMN ${name} ${type}`)
    // Comptes d'avant le parrainage : considérés comme déjà connectés, ils ne peuvent pas devenir filleuls.
    if (name === 'first_login_at') db.exec('UPDATE accounts SET first_login_at = created_at')
  }
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS accounts_by_referral_code ON accounts (referral_code)')
  // Un filleul par empreinte d'adresse (referee : SHA-256), gardée après la suppression de son compte : une adresse
  // ne rapporte qu'une fois. rewarded_at / reward : récompense du parrain quand le filleul a enregistré sa carte.
  db.exec(`
    CREATE TABLE IF NOT EXISTS referrals (
      referee TEXT PRIMARY KEY,
      referrer TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      rewarded_at INTEGER,
      reward TEXT
    ) WITHOUT ROWID;
    CREATE INDEX IF NOT EXISTS referrals_by_referrer ON referrals (referrer);
  `)

  const currentSeq = db.prepare('SELECT seq FROM counter WHERE id = 1')
  const nextSeq = db.prepare('UPDATE counter SET seq = seq + 1 WHERE id = 1 RETURNING seq')
  const upsert = db.prepare(`
    INSERT INTO records (user, app, key, value, updated_at, seq) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (user, app, key) DO UPDATE
      SET value = excluded.value, updated_at = excluded.updated_at, seq = excluded.seq
      WHERE excluded.updated_at > records.updated_at
  `)
  const putRecord = db.prepare(`
    INSERT INTO records (user, app, key, value, updated_at, seq) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (user, app, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, seq = excluded.seq
  `)
  const getRecord = db.prepare('SELECT key, value, updated_at, seq FROM records WHERE user = ? AND app = ? AND key = ?')
  const changedSince = db.prepare(
    'SELECT key, value, updated_at, seq FROM records WHERE user = ? AND app = ? AND seq > ? ORDER BY seq',
  )
  const snapshotTo = db.prepare('VACUUM INTO ?')

  const getLoginRequest = db.prepare('SELECT * FROM login_requests WHERE email = ?')
  const getLoginByToken = db.prepare('SELECT * FROM login_requests WHERE token_hash = ?')
  const putLoginRequest = db.prepare(`
    INSERT OR REPLACE INTO login_requests
      (email, token_hash, code_hash, expires_at, attempts, sent_at, window_start, sent_count)
    VALUES (?, ?, ?, ?, 0, ?, ?, ?)
  `)
  const countAttempt = db.prepare('UPDATE login_requests SET attempts = attempts + 1 WHERE email = ?')
  // La demande reste (sans jeton utilisable) pour garder le compteur d'envois de l'heure.
  const spendLoginRequest = db.prepare(
    "UPDATE login_requests SET token_hash = 'used:' || email, code_hash = '', expires_at = 0 WHERE email = ?",
  )
  const insertSession = db.prepare('INSERT INTO sessions (token_hash, email, expires_at) VALUES (?, ?, ?)')
  const getSession = db.prepare('SELECT email FROM sessions WHERE token_hash = ? AND expires_at > ?')
  const deleteSession = db.prepare('DELETE FROM sessions WHERE token_hash = ?')
  const deleteExpiredSessions = db.prepare('DELETE FROM sessions WHERE expires_at <= ?')
  const getAccount = db.prepare('SELECT * FROM accounts WHERE email = ?')
  const insertAccount = db.prepare("INSERT OR IGNORE INTO accounts (email, role, created_at) VALUES (?, 'user', ?)")
  const listAccounts = db.prepare('SELECT * FROM accounts ORDER BY created_at, email')
  // Usage par compte (page Admin), d'après la progression synchronisée : enregistrements du jour act_AAAA-MM-JJ
  // (src/utils/activity.js : practiced, seconds, learned) et éléments commencés (hors mots « placés » par le test de
  // niveau). ? : premier jour de la fenêtre des 7 derniers jours (AAAA-MM-JJ).
  const usageByUser = db.prepare(`
    SELECT user,
      SUM(act AND practiced) AS days,
      SUM(act AND practiced AND substr(key, 5) >= ?) AS days_week,
      MAX(CASE WHEN act AND practiced THEN substr(key, 5) END) AS last_day,
      SUM(CASE WHEN act THEN coalesce(json_extract(value, '$.seconds'), 0) ELSE 0 END) AS seconds,
      SUM(CASE WHEN act THEN coalesce(json_extract(value, '$.learned'), 0) ELSE 0 END) AS learned,
      SUM(NOT act AND key <> 'settings' AND coalesce(json_extract(value, '$.placed'), 0) = 0) AS items
    FROM (
      SELECT user, key, value, key LIKE 'act\\_%' ESCAPE '\\' AS act,
        coalesce(json_extract(value, '$.practiced'), 1) <> 0 AS practiced
      FROM records WHERE app = 'zh' AND value IS NOT NULL
    )
    GROUP BY user
  `)
  const setAccountRole = db.prepare(`
    INSERT INTO accounts (email, role, created_at) VALUES (?, ?, ?)
    ON CONFLICT (email) DO UPDATE SET role = excluded.role
  `)
  const setPlusExpiry = db.prepare('UPDATE accounts SET plus_expires_at = ? WHERE email = ?')
  const getAccountByPaddleCustomer = db.prepare('SELECT * FROM accounts WHERE paddle_customer_id = ?')
  const markFirstLogin = db.prepare('UPDATE accounts SET first_login_at = ? WHERE email = ? AND first_login_at IS NULL RETURNING email')
  const getByReferralCode = db.prepare('SELECT * FROM accounts WHERE referral_code = ?')
  const setReferralCode = db.prepare('UPDATE accounts SET referral_code = ? WHERE email = ? AND referral_code IS NULL')
  const setBonusUntil = db.prepare('UPDATE accounts SET bonus_until = ? WHERE email = ? RETURNING *')
  const insertReferral = db.prepare('INSERT OR IGNORE INTO referrals (referee, referrer, created_at) VALUES (?, ?, ?)')
  const qualifyReferral = db.prepare(`
    UPDATE referrals SET rewarded_at = ?, reward = 'pending' WHERE referee = ? AND rewarded_at IS NULL RETURNING referrer
  `)
  const setReferralReward = db.prepare('UPDATE referrals SET reward = ? WHERE referee = ?')
  const referralStats = db.prepare(`
    SELECT count(*) AS invited, count(rewarded_at) AS qualified,
      coalesce(sum(reward IN ('access', 'billing_delay')), 0) AS months,
      coalesce(sum(reward IN ('access', 'billing_delay') AND rewarded_at > ?), 0) AS months_year
    FROM referrals WHERE referrer = ?
  `)
  // Un événement plus ancien que le dernier appliqué ne change rien (livraison dans le désordre).
  const applySubscription = db.prepare(`
    UPDATE accounts
    SET paddle_customer_id = ?, paddle_subscription_id = ?, paddle_status = ?, paddle_cancel_at = ?,
        plus_expires_at = ?, paddle_event_at = ?
    WHERE email = ? AND (paddle_event_at IS NULL OR paddle_event_at <= ?)
    RETURNING *
  `)
  // Suppression d'un compte (RGPD) : progression, sessions, demande de connexion, filleuls (comme parrain) et compte.
  // Comme filleul, seule l'empreinte de l'adresse reste dans referrals (une adresse ne rapporte qu'une fois).
  const deleteStatements = ['records WHERE user = ?', 'sessions WHERE email = ?', 'login_requests WHERE email = ?',
    'referrals WHERE referrer = ?', 'accounts WHERE email = ?'].map(target => db.prepare(`DELETE FROM ${target}`))

  const toChange = (row) => ({
    key: row.key,
    value: row.value === null ? null : JSON.parse(row.value),
    updatedAt: row.updated_at,
  })

  return {
    /**
     * Applique les changements d'un appareil puis renvoie ce qu'il doit appliquer localement :
     * tout ce qui a change depuis `since` (sauf ses propres ecritures acceptees), plus la version serveur
     * des cles dont l'ecriture a ete refusee (plus ancienne), pour que l'appareil converge.
     */
    sync(user, app, since, changes) {
      db.exec('BEGIN IMMEDIATE')
      try {
        const seq = changes.length ? nextSeq.get().seq : currentSeq.get().seq
        const accepted = new Map()
        const rejected = new Set()
        for (const { key, value, updatedAt } of changes) {
          // Journée d'activité (act_AAAA-MM-JJ) : fusionnée avec celle du serveur au lieu de la remplacer. Un appareil
          // qui ne l'a pas encore reçue repart d'une journée vide et effacerait sinon la pratique des autres.
          const existing = ACTIVITY.test(key) && value !== null ? getRecord.get(user, app, key) : null
          if (existing?.value) {
            const merged = mergeActivity(JSON.parse(existing.value), value)
            if (canonical(merged) === canonical(value) && updatedAt > existing.updated_at) {
              putRecord.run(user, app, key, JSON.stringify(value), updatedAt, seq)
              accepted.set(key, updatedAt)
            } else {
              // Version fusionnée, plus récente que les deux : renvoyée à l'appareil (pas marquée acceptée).
              putRecord.run(user, app, key, JSON.stringify(merged), Math.max(existing.updated_at, updatedAt) + 1, seq)
              accepted.delete(key)
            }
            rejected.delete(key)
            continue
          }
          const json = value === null ? null : JSON.stringify(value)
          if (upsert.run(user, app, key, json, updatedAt, seq).changes) {
            accepted.set(key, updatedAt)
            rejected.delete(key)
          } else if (!accepted.has(key)) {
            rejected.add(key)
          }
        }
        const rows = changedSince.all(user, app, since)
        const seen = new Set(rows.map((row) => row.key))
        for (const key of rejected) if (!seen.has(key)) rows.push(getRecord.get(user, app, key))
        db.exec('COMMIT')
        return {
          cursor: seq,
          changes: rows.filter((row) => accepted.get(row.key) !== row.updated_at).map(toChange),
        }
      } catch (err) {
        db.exec('ROLLBACK')
        throw err
      }
    },

    auth: {
      loginRequest: (email) => getLoginRequest.get(email),
      loginByToken: (tokenHash) => getLoginByToken.get(tokenHash),
      saveLoginRequest({ email, tokenHash, codeHash, expiresAt, sentAt, windowStart, sentCount }) {
        putLoginRequest.run(email, tokenHash, codeHash, expiresAt, sentAt, windowStart, sentCount)
      },
      countAttempt: (email) => countAttempt.run(email),
      spendLoginRequest: (email) => spendLoginRequest.run(email),
      createSession(tokenHash, email, expiresAt, now) {
        deleteExpiredSessions.run(now)
        insertSession.run(tokenHash, email, expiresAt)
      },
      sessionEmail: (tokenHash, now) => getSession.get(tokenHash, now)?.email ?? null,
      deleteSession: (tokenHash) => deleteSession.run(tokenHash),
    },
    accounts: {
      ensure(email, now = Date.now()) {
        insertAccount.run(email, now)
        return getAccount.get(email)
      },
      get: (email) => getAccount.get(email) || null,
      list: () => listAccounts.all(),
      /** Map adresse → { days, daysWeek, lastDay, minutes, learned, items } ; weekStart : AAAA-MM-JJ d'il y a 6 jours. */
      usage(weekStart) {
        return new Map(usageByUser.all(weekStart).map(row => [row.user, {
          days: row.days, daysWeek: row.days_week, lastDay: row.last_day,
          minutes: Math.round(row.seconds / 60), learned: row.learned, items: row.items,
        }]))
      },
      setRole(email, role, now = Date.now()) {
        setAccountRole.run(email, role, now)
        return getAccount.get(email)
      },
      setPlusExpiresAt(email, expiresAt, now = Date.now()) {
        insertAccount.run(email, now)
        setPlusExpiry.run(expiresAt, email)
        return getAccount.get(email)
      },
      byPaddleCustomer: (customerId) => getAccountByPaddleCustomer.get(customerId) || null,
      /** Applique un événement d'abonnement Paddle ; null s'il est plus ancien que le dernier appliqué. */
      applySubscription(email, { customerId, subscriptionId, status, cancelAt, expiresAt, eventAt }, now = Date.now()) {
        insertAccount.run(email, now)
        return applySubscription.get(customerId, subscriptionId, status, cancelAt, expiresAt, eventAt, email, eventAt) || null
      },
      /** Première connexion du compte : vrai une seule fois (le compte peut alors devenir filleul). */
      firstLogin: (email, now = Date.now()) => Boolean(markFirstLogin.get(now, email)),
      byReferralCode: (code) => getByReferralCode.get(code) || null,
      /** Code de parrainage du compte, créé au premier besoin avec newCode() (réessayé si déjà pris). */
      referralCode(email, newCode) {
        for (let attempt = 0; attempt < 5 && !getAccount.get(email).referral_code; attempt++) {
          try {
            setReferralCode.run(newCode(), email)
          } catch (err) {
            if (!String(err.message).includes('UNIQUE')) throw err
          }
        }
        return getAccount.get(email).referral_code
      },
      setBonusUntil: (email, until) => setBonusUntil.get(until, email) || null,
      /** Efface tout ce qui concerne l'adresse (progression comprise), en une transaction. */
      delete(email) {
        db.exec('BEGIN IMMEDIATE')
        try {
          for (const statement of deleteStatements) statement.run(email)
          db.exec('COMMIT')
        } catch (err) {
          db.exec('ROLLBACK')
          throw err
        }
      },
    },

    /** Parrainage : refereeHash = empreinte SHA-256 de l'adresse du filleul (server/referral.js). */
    referrals: {
      add: (refereeHash, referrer, now = Date.now()) => insertReferral.run(refereeHash, referrer, now).changes > 0,
      /** Filleul qui enregistre sa carte : renvoie le parrain la première fois seulement, sinon null. */
      qualify: (refereeHash, now = Date.now()) => qualifyReferral.get(now, refereeHash)?.referrer ?? null,
      setReward: (refereeHash, reward) => setReferralReward.run(reward, refereeHash),
      /** { invited, qualified, months, monthsYear } : yearStart = début de la fenêtre du plafond annuel. */
      stats(referrer, yearStart) {
        const row = referralStats.get(yearStart, referrer)
        return { invited: row.invited, qualified: row.qualified, months: row.months, monthsYear: row.months_year }
      },
    },


    /** Copie coherente de la base (sauvegardes), meme pendant les ecritures. */
    snapshot(dest) {
      snapshotTo.run(dest)
    },

    close() {
      db.close()
    },
  }
}
