# Feuille de route — application de chinois

Objectif à terme : vendre l'application de chinois seule (sans l'italien), en français et en anglais pour commencer.

## Fait

- Modules : Pinyin et tons (7 leçons, audio, tableau des sons), Vocabulaire HSK 1–9 (répétition espacée),
  Caractères (2 998 caractères HSK 3.0, ordre des traits, tracé au doigt, 125 clés), Grammaire (41 points HSK 1–4),
  Lecture (16 textes et dialogues HSK 1–4), Classificateurs (56).
- Bouton écouter sur les mots (enregistrements CC BY-SA, sinon synthèse Google pour les mots de plusieurs
  caractères), sur les caractères sans syllabe enregistrée dans un mot qui fixe leur lecture, et sur toutes les
  phrases (grammaire, classificateurs, lecture : une voix par personnage des dialogues).
- Design (passe unslop), icônes lucide, mises à jour visibles sans fermer l'app, hors ligne.
- Langue de l'utilisateur (français / anglais) dans les paramètres ; définitions du vocabulaire en français
  (CFDICT) et en anglais (CC-CEDICT) ; lecture des caractères corrigée d'après la liste HSK 3.0.
- Recherche dans la liste des mots, tous niveaux : caractères, pinyin avec ou sans tons, sens.
- Page « Aujourd'hui » : toutes les révisions dues en une séance ; jours d'affilée (un jour compte dès une réponse),
  éléments maîtrisés et temps de pratique (aujourd'hui, 7 jours ; pauses de plus de 90 s non comptées).
- Révision adaptative (FSRS, ts-fsrs, MIT) pour tous les modules : intervalles calculés selon la mémoire de chaque
  élément (3, 14, 57… jours, un an au plus) ; une erreur raccourcit l'intervalle sans tout effacer, 4 oublis renvoient
  en apprentissage ; 20 mots en cours au plus, les nouveaux arrivent quand on en maîtrise ; anciennes progressions
  reprises sans perte.
- Amis, classement et trophées : demandes réciproques, profil pseudonyme, blocage, XP et classement hebdomadaire ;
  continuation guidée débutante dans Aujourd'hui après les cinq séances. Les sélections par niveau et contenus gratuits
  existants restent accessibles. Les XP sont calculés par l'appareil et plafonnés pour le classement.

## Priorités

1. **Vocabulaire juste** — fait : définitions dans la langue de l'utilisateur, bonne lecture des caractères à
   plusieurs prononciations (听 tīng, 说 shuō, 吗 ma…) et définitions françaises complètes du HSK 1 à 6.
   Reste : 412 mots sans définition française au HSK 7–9, affichés en anglais.
2. **Tests de vocabulaire plus variés** — fait : le type de question suit la progression du mot (QCM de sens, puis
   écoute → caractère et pinyin avec les tons, puis saisie quand le mot est presque connu).
3. **Caractères** — fait : 300 caractères par niveau HSK 1 à 6 et 1 200 pour le 7–9 (liste officielle) ; ordre des
   traits animé, clé en couleur ; un caractère nouveau se trace sur le modèle, puis s'écrit de mémoire (Hanzi Writer) ;
   les 125 clés courantes avec leur sens et un test. Données de traits : licence Arphic, vente autorisée en
   fournissant le texte de la licence (`public/hanzi/LICENSE-ARPHIC.txt`).
4. **Lire et écouter des phrases** — fait du HSK 1 au 4 : 16 textes et dialogues (se présenter, restaurant,
   chemin, achats, médecin, téléphone, famille, journée, week-end, apprendre le chinois, hôtel, voyage, anniversaire,
   entretien d'embauche, location, santé) ; pinyin et traduction affichables, sens de chaque mot au toucher, phrases
   enregistrées ; questions de compréhension et phrases à remettre dans l'ordre. Reste : textes HSK 5 et plus.
   Les trois textes HSK 4 écrits pour l'app doivent être relus par un locuteur natif.
5. **Test de niveau** — fait : test de placement (8 questions par niveau, du HSK 1 vers le haut tant que 75 % sont
   réussis), proposé sur l'accueil d'un nouvel utilisateur et sur la page Vocabulaire ; bouton « Passer le test » sur
   le premier niveau verrouillé (20 mots du niveau précédent, 80 %). Mots d'un niveau réussi planifiés en révision
   (réussis : 2 à 6 semaines ; non testés : 3 à 20 semaines), pas comptés comme appris. Grammaire : test d'un niveau,
   2 questions par point, un point sans faute est validé.
6. **Contenu restant** — fait : 132 définitions françaises ajoutées au HSK 1 à 6, 8 points de grammaire HSK 4,
   3 lectures HSK 4 et son des particules au ton neutre présenté dans un mot (的 dans 我的, 了 dans 好了, 吗 dans
   你好吗…). Reste, en option : phrases d'exemple pour les mots du HSK 1 à 3.

## Parcours gratuit et acquisition

- [x] **Lot 1 — Gratuit au quotidien.** Aujourd'hui, trois fiches (是, 吗, 有) et le dialogue *Se présenter* ;
  vocabulaire HSK 1 sans quota. En fin d'essai, continuer sur les révisions gratuites sans perdre sa progression.
- [x] **Lot 2 — Parcours débutant.** Après la langue, proposer « Je débute » / « J'ai déjà des bases ». Cinq
  séances courtes enchaînables : se présenter, répondre à une question oui/non, parler de son origine, commander
  et demander le prix. Réutiliser *Se présenter* et *Au restaurant*, cibler 25 caractères avec tracé facultatif,
  reprendre le parcours depuis Aujourd'hui sur chaque appareil. Après le restaurant : extrait de *Demander son chemin*,
  puis choix entre le dialogue complet avec Yidiano+ et les révisions gratuites.
- [x] **Lot 3 — Reprendre à son niveau.** Test de placement facultatif ou choix direct. HSK 1 : accès direct
  aux dialogues débutants ; HSK 2 : *Acheter un vêtement* ; HSK 3 : *À l'hôtel* ; HSK 4 : *Un entretien
  d'embauche* ; HSK 5–6 et 7–9 : vocabulaire et écoute, sans promettre de nouvelles lectures. Environ 15 mots
  fixes par séance, révisables gratuitement sans ouvrir tout le niveau. Séparer l'estimation du niveau de la
  planification des révisions pour ne pas programmer de mots verrouillés.
- [x] **Lot 4 — Démo et distribution.** Quiz de tons et tracé sans compte, guides `/tons-chinois/` et
  `/dialogue-chinois/`, trois clips verticaux et liens de campagne dans [COMMERCIALISATION.md](COMMERCIALISATION.md).
- [ ] **Après déploiement.** Publier les clips et partager les guides auprès des communautés et profs
  francophones. Garder le prix et l'essai stables ; attendre un signal de rétention avant la pub payante.

## Secondaire

- Grammaire HSK 5 et plus (fait jusqu'au HSK 4 : 把, 被, compléments de résultat, de direction et de possibilité,
  越来越, 是…的, 有点儿 / 一点儿, 连…都, 不但…而且, 只要…就, 只有…才, 不管…都, 越…越).
- Relecture par un locuteur natif du contenu écrit sans source, notamment les nouveaux points et textes HSK 4,
  la grammaire, les classificateurs et les leçons pinyin, dans les deux langues.
- Prononciation : enregistrement de sa voix et comparaison avec le modèle (sans note automatique des tons, peu
  fiable).

## Bêta et ouverture (bêta décidée le 16/11/2026, inscriptions ouvertes le 20/11/2026)

Inscriptions ouvertes à tous depuis le 20/11/2026 : https://yidiano.com, connexion par e-mail, rôles `admin` / `beta` /
`user`, version gratuite et essai Yidiano+ de 15 jours avec carte (voir [COMMERCIALISATION.md](COMMERCIALISATION.md)).
Les bêta-testeurs gardent le rôle `beta` en parallèle.

Pendant la bêta :
- Envoyer aux testeurs et à Elisa le message de changement d'adresse (yidiano.com, reconnexion par e-mail, icône à
  réinstaller) et le lien du formulaire d'avis.
- Recruter quelques testeurs de plus (rôle `beta` depuis la page Admin) et suivre leurs retours.
- Relecture par un locuteur natif (voir « Secondaire »).
- Page de présentation publiée avec prix, captures réelles et liens légaux.
- Vidéo de présentation montée ; reste la mesure d'usage minimale (voir « Mesure d'audience »).

## Avant de vendre

Abonnement, web d'abord, version gratuite et essai de 15 jours avec carte, parrainage, entreprise individuelle au régime
micro-entreprise et paiement Paddle décidés. Nom, domaine et détails : voir [COMMERCIALISATION.md](COMMERCIALISATION.md).

- **Prix** : 7,99 €/mois et 59,99 €/an TTC (prix Paddle, TVA incluse).
- **Paiement** : Paddle live en production depuis le 19/11/2026 (compte vérifié, domaine yidiano.com approuvé,
  produit Yidiano+ à 7,99 €/mois et 59,99 €/an TTC, webhook `https://yidiano.com/api/paddle/webhook`, lien de
  paiement par défaut ; clé API valable jusqu'au 18/11/2027, à renouveler avant). Restent : nom légal du compte
  Paddle à corriger (« RoneTrade » → Erwan Houadec, affichage Yidiano ; demande envoyée à sellers@paddle.com, réponse
  attendue). Essai : prix Paddle avec 15 jours d'essai et carte obligatoire créés le 20/11/2026
  (`pri_01m7wm9ggs1px5ryc0vcv6bdne` mensuel, `pri_01m7wm9gpvmnter9jrhkbkyvqq` annuel). Contrôle du 20/11/2026 :
  webhook prod (signature) et prix live vérifiés ; paiement réel non testé (choix d'Erwan). Libellé bancaire passé de
  `RONETRADE` à `YIDIANO` le 20/11/2026. Reste dans Paddle : versements (Payout Settings vides : type de compte, nom,
  moyen de paiement). Un remboursement fait dans Paddle ne résilie probablement pas l'abonnement : résilier aussi
  l'abonnement à chaque remboursement.
- **Bêta-testeurs** : gardent le rôle `beta` (accès complet) sans date de fin ; Erwan décide quand arrêter (alors :
  fin d'accès Yidiano+ à date + 1 mois dans la page Admin, puis rôle `user`).
- **Contenu payant protégé** : fiches et lectures payantes absentes du code de l'app, servies par `/api/content`
  aux seuls comptes Yidiano+. Vocabulaire et caractères restent dans l'app (verrouillés côté client).
- **Inscriptions ouvertes** : fait le 20/11/2026 (`AUTH_ALLOWED_EMAILS` vide), avec la limite d'envois par IP. Les
  bêta-testeurs gardent leur rôle `beta` (enregistré dans la base, pas dans la liste).
- **Comptes** : connexion par e-mail et avec Google (20/11/2026) faites ; reste Apple.
- **E-mails** : depuis le 20/11/2026, Yidiano <no-reply@yidiano.com> via Brevo (compte dédié Yidiano,
  smtp-relay.brevo.com:465, clé SMTP sans expiration mais révoquée après 90 jours sans envoi). Domaine authentifié :
  brevo-code, DKIM `brevo1`/`brevo2._domainkey`, DMARC `p=none` dans la zone OVH. Avant : Gmail personnel.
- **Légal** : immatriculation, mentions légales, conditions d'utilisation et de vente, confidentialité, remboursement
  sous 14 jours et suppression du compte sont en ligne. Restent : adhésion à un médiateur de la consommation, reportée
  par Erwan le 20/11/2026 malgré l'obligation dès la première vente à un particulier (choix proposé : CM2C, 48 € pour
  3 ans, 36 € par médiation à distance), puis ses coordonnées sur le site et dans les CGV ;
  relecture des textes par un juriste ; vérifier que l'activité déclarée (code APE 47.91A, vente à distance) couvre
  bien l'édition d'une application par abonnement.
- **Marque et domaines** : recherche TMview du 19/11/2026 : aucune marque « Yidiano » enregistrée ; marques proches
  seulement en Chine (YIDIAN, YIDIAO) ou hors de nos classes. Reste à décider : dépôt INPI (classes 9, 41, 42),
  yidiano.app et yidiano.fr.
- **Produit** : parrainage fait le 21/11/2026 (voir COMMERCIALISATION.md) ; reste l'objectif par jour au premier lancement.
  Les captures de la page de présentation sont faites.
- **Technique** : découper le chargement (3,4 Mo d'un bloc ; niveaux HSK chargés à l'ouverture) ; tests sur vrais
  iPhone et Android (son, encoche, hors ligne).
- **Distribution** : PWA sur le web, puis Play Store (TWA) et App Store (Capacitor) avec achats intégrés.
- **Licences et mentions** : fait. Page `legal/licences.html` (liée depuis le site, les pages légales et les
  paramètres de l'app) avec toutes les sources ; dictionnaire modifié publié sous CC BY-SA 4.0 dans
  `/licences/yidiano-dictionnaire.json`, généré au build (vite.config.js).
- **Langues** : ajouter d'autres langues d'interface (espagnol, allemand…) avec le même système de traduction.

## Mesure d'audience

- Pendant la bêta : la base du serveur contient déjà la progression de chaque testeur (réponses, temps de pratique,
  séries) ; une page Admin de statistiques suffit pour ces quelques comptes.
- PostHog fait le 20/11/2026 : projet « Yidiano » (eu.posthog.com, projet 178420, fuseau Europe/Paris), chargé
  seulement après consentement (bandeau sur la page de présentation et dans l'app, Paramètres « Mesure d'audience »,
  lien « Cookies » en bas de la page de présentation ; `src/analytics.js`). Stockage localStorage, sans cookie ;
  compte identifié par l'empreinte SHA-256 de l'adresse. Envoi par le relais Caddy `/relay` de yidiano.com (noms
  neutres contre les bloqueurs ; ancien chemin `/ingest` gardé dans Caddy pour les versions en cache, à retirer).
  Propriétés de chaque événement : `surface` (landing / login / app), `installed` (app ouverte depuis l'écran
  d'accueil), et celles de PostHog (`$os`, `$device_type`, `$browser`). Événements : pages vues, `screen_viewed`,
  `signed_up` (premier lancement), `plus_viewed`, `checkout_opened`, `checkout_completed`
  (`plan`, `trial`) ; page de connexion : `login_code_requested`, `login_code_failed` (`step`, `error`),
  `login_google_started`, `login_google_failed`, `login_succeeded` (`method` code / link). Tableau de bord PostHog
  « Yidiano — acquisition et abonnements » (entonnoirs d'achat et de connexion, appareils, rétention). La page de
  connexion n'affiche pas de bandeau : elle suit le choix fait sur la page de présentation ou dans l'app.
- Parcours gratuit : `learning_profile_chosen`, `learning_level_chosen`, `learning_session_completed` (`first`,
  `profile`, `step` ou `level`), `learning_activity_day`, `learning_offer_viewed` (`offer`) ; le canal initial
  `learning_source` n'est mémorisé qu'après consentement. Mesurer le retour à J7 par la rétention de la première
  séance (`first=true`) vers `learning_activity_day` ; pour l'essai, entonnoir offre → `plus_viewed` →
  `checkout_completed` (`trial=true`, même `offer`). Ventiler les rapports par profil et canal.
