import { DatabaseSync } from 'node:sqlite'

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

  const currentSeq = db.prepare('SELECT seq FROM counter WHERE id = 1')
  const nextSeq = db.prepare('UPDATE counter SET seq = seq + 1 WHERE id = 1 RETURNING seq')
  const upsert = db.prepare(`
    INSERT INTO records (user, app, key, value, updated_at, seq) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (user, app, key) DO UPDATE
      SET value = excluded.value, updated_at = excluded.updated_at, seq = excluded.seq
      WHERE excluded.updated_at > records.updated_at
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
  // Un événement plus ancien que le dernier appliqué ne change rien (livraison dans le désordre).
  const applySubscription = db.prepare(`
    UPDATE accounts
    SET paddle_customer_id = ?, paddle_subscription_id = ?, paddle_status = ?, paddle_cancel_at = ?,
        plus_expires_at = ?, paddle_event_at = ?
    WHERE email = ? AND (paddle_event_at IS NULL OR paddle_event_at <= ?)
    RETURNING *
  `)
  // Suppression d'un compte (RGPD) : progression, sessions, demande de connexion et compte.
  const deleteStatements = ['records WHERE user = ?', 'sessions WHERE email = ?', 'login_requests WHERE email = ?',
    'accounts WHERE email = ?'].map(target => db.prepare(`DELETE FROM ${target}`))

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


    /** Copie coherente de la base (sauvegardes), meme pendant les ecritures. */
    snapshot(dest) {
      snapshotTo.run(dest)
    },

    close() {
      db.close()
    },
  }
}
