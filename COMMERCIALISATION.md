# Commercialisation — application de chinois

Notes de la discussion des 10 et 11 novembre 2026. Décisions prises par Erwan, propositions en attente de décision.

## Décidé

- **Abonnement**, en **web d'abord** (PWA). Si ça marche : Android, puis Apple.
- **Version gratuite permanente** et **essai Yidiano+ de 15 jours avec carte bancaire** (prix Paddle avec période
  d'essai, prélèvement automatique à la fin sauf résiliation), une fois par compte (décidé le 20/11/2026).
- **Parrainage** pour faire venir des utilisateurs.
- **Statut juridique** : entreprise individuelle (EI) sous le régime micro-entreprise pour démarrer seul.
- **Paiement web** : **Paddle**, vendeur officiel (« Merchant of Record ») qui encaisse les clients et gère les
  abonnements, les taxes sur les ventes et le support lié aux paiements.
- **Nom** : **Yidiano** (一点, « un peu »), domaine **yidiano.com** acheté chez OVH ; l'app y est en ligne depuis le
  16/11/2026.

## Nom et domaine

Retenu : **Yidiano**, yidiano.com (OVH, nom de domaine seul, sans hébergement).

Écartés :
- Hanzimo, d'abord préféré : trop proche d'apps existantes (Hanzio, Hanzii, Hanzijo, Hanzinote).
- Les noms en « Seal » : InkSeal existe déjà.
- Tingdong : nom d'une app existante.
- Pris en .com et .app (vérifié le 10/11/2026, RDAP) : pandarin, mandarine, xuexi, laoshi, zhongwen, tingshuo,
  kaishi, pinyo, hanzify…

À faire : vérifier qu'aucune marque « Yidiano » n'existe déjà (INPI, EUIPO) ; décider s'il faut aussi les extensions
.app et .fr en redirection.

## Freemium retenu

Les contenus verrouillés restent visibles avec un cadenas, sans aperçu. La progression est conservée à la fin de
l'essai ou de l'abonnement ; seul l'accès se referme. Règles dans `src/access/rules.js`.

| Module | Gratuit | Yidiano+ |
| --- | --- | --- |
| Pinyin et tons | Les 7 leçons et le tableau des sons | Identique |
| Vocabulaire | HSK 1 (502 mots), sans quota ; sélections de 15 mots par séance de découverte | HSK 1 à 9 |
| Caractères | Les 25 du parcours débutant et les 10 déjà accessibles | HSK 1 à 9 |
| Clés | Verrouillé | Toutes |
| Grammaire | 是, 吗 et 有 / 没有 | HSK 1 à 4 |
| Lecture | *Se présenter*, *Au restaurant*, *Acheter un vêtement*, *À l'hôtel* et *Un entretien d'embauche* | Tous les textes |
| Classificateurs | Verrouillé | Tous les groupes |
| Aujourd'hui | Révisions sur les contenus gratuits et reprise du parcours | Tous les contenus accessibles |
| Synchronisation et hors ligne | Inclus | Inclus |

- L'essai Yidiano+ dure 15 jours et demande une carte : il démarre l'abonnement Paddle (statut `trialing`), rien
  n'est prélevé avant sa fin. Proposé à un compte jamais abonné (`/api/paddle/config`, `trial`) ; prix d'essai
  `PADDLE_PRICE_MONTHLY_TRIAL` et `PADDLE_PRICE_YEARLY_TRIAL`, durée `TRIAL_DAYS` dans `server/paddle.js`.
- Le rôle `admin` a l'accès complet et peut afficher l'application comme un compte gratuit.
- Le rôle `beta` a l'accès complet pendant la bêta. Au lancement commercial, les bêta-testeurs recevront un mois
  offert, puis deviendront des utilisateurs ordinaires sauf abonnement.
- Le rôle `user` suit les droits gratuits, l'essai et l'abonnement.
- Les fiches et lectures gratuites sont intégrées à l'app (`content/split.js`) ; les autres sont servies par
  `/api/content` aux seuls comptes Yidiano+. L'accès aux caractères reste filtré dans l'app.

### Lancer l'acquisition francophone

Après déploiement, trois clips de 8 secondes (`node scripts/acquisition-clips.mjs` après build) ;
publier seulement dans les espaces qui acceptent les ressources externes :

| Clip | Texte de publication | Lien à partager |
| --- | --- | --- |
| `01-ton-mystere.mp4` | Tu reconnais le ton sans voir le pinyin ? Écoute et choisis. | `/demo/?utm_source=reels&utm_campaign=parcours_gratuit&utm_content=ton` |
| `02-tracer-ren.mp4` | Deux traits, un caractère : essaie 人 sans installer d'app. | `/demo/?utm_source=shorts&utm_campaign=parcours_gratuit&utm_content=trace` |
| `03-premier-dialogue.mp4` | Écoute la phrase, puis affiche la traduction pour vérifier. | `/dialogue-chinois/?utm_source=tiktok&utm_campaign=parcours_gratuit&utm_content=dialogue` |

Pour les profs : « Un exercice gratuit et sans compte sur les quatre tons du mandarin, avec audio et quiz.
Vous pouvez le donner à vos débutants : https://yidiano.com/tons-chinois/?utm_source=professeurs&utm_campaign=parcours_gratuit ».
Crédits des enregistrements et du tracé : [licences Yidiano](https://yidiano.com/legal/licences.html).

## Proposé (à décider)

- **Prix** de départ : 7,99 €/mois et 49,99 €/an (annuel mis en avant). Les concurrents (HelloChinese, Duolingo
  Super) seraient autour de 10-13 €/mois : à vérifier. Modifiable sans toucher au code.

## Parrainage (décidé et fait le 21/11/2026)

- Lien personnel `https://yidiano.com/?ref=CODE` (Paramètres, accueil, écran Yidiano+ ; page « Parrainage » avec
  partage, copie et compteurs). Le cookie `yidiano_ref` (30 jours) rattache le compte créé ensuite au parrain ; un
  compte déjà connecté une fois ne peut pas devenir filleul ; une adresse ne compte qu'une fois.
- Le parrain gagne **1 mois de Yidiano+ dès que le filleul enregistre sa carte** (essai de 15 jours ou abonnement,
  webhook Paddle `trialing`/`active`). Abonné : prochain prélèvement repoussé d'un mois (`next_billed_at`, sans
  facturation) ; sinon 30 jours de Yidiano+ (`bonus_until`). Plafond 12 mois sur 12 mois glissants.
- Filleul : essai Yidiano+ de **30 jours au lieu de 15** (décidé le 21/11/2026), avec carte comme l'essai normal. Prix
  Paddle dédiés `pri_01m7z98fxs6vnnjgya17tt1aj5` (mensuel) et `pri_01m7z98g4x0qhh6qc7mg0nx3dm` (annuel), variables
  `PADDLE_PRICE_*_TRIAL_REFERRAL`, proposés par `/api/paddle/config` aux seuls comptes arrivés par un lien.
- Risque connu : la même carte peut servir à plusieurs essais sous des adresses différentes ; le plafond et la
  possibilité d'annuler les parrainages abusifs (CGV, article 5) le limitent. Code : `server/referral.js`.

## Statut juridique retenu

**Entreprise individuelle (EI) sous le régime micro-entreprise**, sans société ni capital social au lancement.
Il n'y a donc pas de statuts de société à rédiger. L'activité à déclarer au guichet unique de l'INPI :

> Édition et exploitation d'une application web d'apprentissage linguistique ; fourniture, par abonnement, d'un
> accès à un service numérique en ligne.

- Immatriculation sur le [guichet unique des formalités](https://formalites.entreprises.gouv.fr/) avant la première
  vente. Choix recommandé : déclaration mensuelle du chiffre d'affaires.
- Le plafond 2026 du régime micro pour les prestations de services et activités libérales est de **83 600 € HT**.
  Le classement exact BIC ou BNC et le taux social correspondant doivent être confirmés par l'INPI ou l'Urssaf lors
  de l'immatriculation ; ils ne sont pas devinés dans l'application.
- Le chiffre d'affaires à déclarer est la recette réellement encaissée. Paddle ne remplace ni les déclarations
  Urssaf, ni l'impôt français, ni la CFE, ni la tenue du livre des recettes.
- Revoir le choix avec un expert-comptable en approchant du plafond, avant d'embaucher ou de faire entrer un associé,
  ou si les frais réels deviennent importants ; une EURL ou une SASU pourra alors être plus adaptée.

Texte de base pour les mentions légales, à compléter après l'immatriculation sans inventer les champs manquants :

> Éditeur : Erwan [nom complet], entrepreneur individuel sous le régime micro-entreprise, exerçant sous le nom
> commercial [nom retenu], SIREN [numéro], domicilié [adresse professionnelle], contact : [adresse e-mail].

Sources officielles : [régime micro-social](https://entreprendre.service-public.gouv.fr/vosdroits/F37353) et
[régime micro-fiscal](https://entreprendre.service-public.gouv.fr/vosdroits/F23267), vérifiés en 2026.

## Prestataire retenu : Paddle

Paddle devient le vendeur officiel des abonnements web. Son offre sans abonnement mensuel est actuellement facturée
**5 % + 0,50 $ par transaction**. Elle comprend le paiement, le checkout, la facturation récurrente, le calcul,
l'encaissement et le reversement des taxes sur les ventes et de la TVA, les factures clients, la fraude, les
contestations de paiement et l'assistance liée aux paiements.

Pour l'application, il reste à intégrer le checkout Paddle, vérifier les webhooks côté serveur et ouvrir ou fermer
l'accès premium selon l'état de l'abonnement. Paddle ne prend pas en charge l'immatriculation française, les
déclarations Urssaf et fiscales, la CFE, les CGU/CGV, le RGPD ni la comptabilité propre de l'activité.

Ce choix coûte plus cher qu'un simple encaissement Stripe, particulièrement sur l'abonnement mensuel à petit prix,
mais évite de gérer la TVA consommateur pays par pays. Il est donc cohérent avec la demande d'un prestataire qui
prend en charge le maximum. Source : [tarification et périmètre Paddle](https://www.paddle.com/pricing).

## Obligations légales (France, vente aux particuliers)

- Statut retenu : entreprise individuelle au régime micro-entreprise ; immatriculation et champs légaux encore à
  compléter avant la première vente.
- CGV avec case à cocher de renonciation au délai de rétractation de 14 jours (contenu numérique fourni tout de suite).
- Mentions légales, politique de confidentialité (RGPD), gestion et suppression des données de compte.
- Médiateur de la consommation : obligatoire pour vendre aux particuliers.
- Licences des données : voir « Avant de vendre » dans ROADMAP.md (CFDICT à citer sur les pages de vente).

## Stores (plus tard)

- Android : app web emballée (TWA ou Capacitor).
- Apple : un abonnement acheté dans l'app passe par l'achat intégré (15 % pour un petit développeur).
- Avec des comptes, un abonnement pris sur le web débloque aussi les apps.

## Travaux techniques, dans l'ordre

1. App séparée sur son domaine (fait : https://yidiano.com, dépôt Xsaw45/chineseApp).
2. Comptes : connexion par lien ou code envoyé par e-mail (fait), puis avec Google ; progression rattachée au compte.
3. Essai, version gratuite et abonnement avec Paddle.
4. Parrainage.
5. Page de présentation avec tarifs ; pages légales.
6. Premier lancement guidé : langue puis test de placement (fait), objectif par jour (reste).

## Décision encore attendue

1. Le prix final.
