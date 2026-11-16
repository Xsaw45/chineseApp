# Yidiano

Application web (PWA) pour apprendre le chinois : pinyin et tons, vocabulaire HSK 1–9 en répétition espacée,
caractères, classificateurs, grammaire, lecture. En ligne sur https://yidiano.com, connexion par e-mail.
Feuille de route : [ROADMAP.md](ROADMAP.md) ; vente : [COMMERCIALISATION.md](COMMERCIALISATION.md).

| Chemin | Contenu |
|---|---|
| `src/` | app React 19 + Vite + Tailwind 4, servie à la racine (`base: '/'`) |
| `public/login/` | page de connexion (lien ou code à 6 chiffres) |
| `landing.html`, `src/landing/` | page de présentation, servie à `/` aux visiteurs sans session (l'app pour une session ouverte) ; captures dans `public/landing/` |
| `server/` | Node 24 + Fastify : fichiers statiques, connexion par e-mail, synchronisation, SQLite (`node:sqlite`) |
| `scripts/` | construction des données (vocabulaire, audio, caractères) |

## Synchronisation et comptes

- **Connexion** (`server/auth.js`) : lien ou code à 6 chiffres valables 15 minutes, session d'un an (cookie
  `HttpOnly`). L'identifiant est l'adresse e-mail en minuscules. Un envoi par minute et 5 par heure au plus par
  adresse ; 5 essais de code. Sans `SMTP_URL` (développement), le lien et le code sont écrits dans le journal.
- **Données** : la progression est gardée dans IndexedDB et l'app fonctionne hors ligne. Les modifications sont
  découpées en enregistrements (`hsk1_0100`, `settings`, …) et envoyées à `POST /api/sync/zh` (`src/db/sync.js`).
- **Fusion** : par enregistrement, le plus récent gagne (horloge de l'appareil). Le serveur renvoie ce qui a changé
  depuis le curseur de l'appareil, plus sa version des enregistrements refusés.
- **Quand** : au démarrage (attente de 4 s max), 1,5 s après chaque modification, au retour en ligne ou sur l'onglet,
  et toutes les minutes.
- **Appareil passé à un autre compte** : le serveur répond 409, l'appareil efface ses données locales et recharge
  celles du nouveau compte. Sans session, il répond 401 et l'app redirige vers `/login/`.

Variables du serveur : `DB_PATH`, `PUBLIC_DIR` (chemin absolu du build), `PUBLIC_URL` (liens des e-mails), `PORT`,
`SMTP_URL` (`smtps://identifiant:mot-de-passe@hôte:465`), `MAIL_FROM`, `AUTH_ALLOWED_EMAILS` (adresses invitées
séparées par des virgules ; vide = toutes).

## Développement

```bash
npm install && npm run dev                        # interface seule, http://localhost:5173
npm run build
cd server && npm install && npm test
DB_PATH=/tmp/y.db PUBLIC_DIR="$PWD/../dist" PUBLIC_URL=http://localhost:8081 PORT=8081 npm start   # app complète
```

Données (dans `scripts/`) :
- `node scripts/build-data.js` : vocabulaire HSK (drkameleon/complete-hsk-vocabulary), lecture enseignée par le HSK
  (krmanik/HSK-3.0), définitions anglaises (CC-CEDICT) et françaises ([CFDICT](https://chine.in/mandarin/dictionnaire/CFDICT/),
  CC BY-SA 3.0 : citer la source dans l'app et sur les pages de présentation).
- puis `node scripts/fetch-audio.js` : copie dans `public/audio/` les enregistrements de
  [hugolpz/audio-cmn](https://github.com/hugolpz/audio-cmn) (syllabes : Chen Wang ; mots HSK : Yue Tan / Shtooka ;
  licence CC BY-SA) et écrit `src/data/audio.json`.
- puis `node scripts/fetch-tts-audio.js` : enregistre avec Google Cloud Text-to-Speech (voix Chirp 3 HD) les phrases
  (grammaire, classificateurs, lecture, une voix par personnage des dialogues) et les mots HSK de plusieurs caractères
  sans enregistrement humain, dans `public/audio/tts/`, et écrit `src/data/ttsAudio.json`. Clé `GOOGLE_TTS_KEY` dans
  `.env.local` (non commitée) ; seuls les textes nouveaux sont demandés (environ 12 500 caractères en tout,
  gratuit). Restent lus par la voix chinoise du téléphone : les caractères seuls au ton neutre sans enregistrement.
- puis `node scripts/build-hanzi.js` : caractères par niveau (krmanik/HSK-3.0, « HSK Hanzi »), clé (Unihan), sens
  (CC-CEDICT, CFDICT) dans `src/data/hanzi.json` ; copie les tracés de `hanzi-writer-data` (Make Me a Hanzi, Arphic
  Public License, texte joint dans `public/hanzi/`) dans `public/hanzi/`.

Langues de l'interface : l'utilisateur choisit français ou anglais au premier lancement et dans les paramètres
(réglage synchronisé). Textes d'interface dans `src/i18n/strings.js` ; contenus (leçons, grammaire,
classificateurs) en `{ fr, en }` dans `src/data`.

## Production

VPS, `/srv/services/yidiano` (configuration dans le dépôt `vps-config`) : image construite depuis ce dépôt
(`Dockerfile`), Caddy → `127.0.0.1:8030`, base dans `data/yidiano.db`, secrets dans `.env`. Mise à jour :
`./deploy.sh` (copie de la base avant chaque déploiement). La progression d'avant le déménagement vient de
LanguesApp (`server/import-langues.js`, reprise unique le 16/11/2026).
