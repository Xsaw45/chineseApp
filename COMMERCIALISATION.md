# Commercialisation — application de chinois

Notes de la discussion des 10 et 11 novembre 2026. Décisions prises par Erwan, propositions en attente de décision.

## Décidé

- **Abonnement**, en **web d'abord** (PWA). Si ça marche : Android, puis Apple.
- **Version gratuite permanente** et **essai Yidiano+ de 7 jours**, déclenché par l'utilisateur, sans carte bancaire.
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

Les contenus verrouillés restent visibles avec un cadenas, sans aperçu du premier élément payant. La progression est
conservée à la fin de l'essai ou de l'abonnement ; seul l'accès se referme.

| Module | Gratuit | Yidiano+ |
| --- | --- | --- |
| Pinyin et tons | Les 7 leçons et le tableau des sons | Identique |
| Vocabulaire | HSK 1 (502 mots) | HSK 1 à 9 |
| Caractères | HSK 1 (300 caractères) | HSK 1 à 9 |
| Clés | Les 20 premières | Toutes |
| Grammaire | Les 16 points HSK 1 | HSK 1 à 4 |
| Lecture | « Se présenter » et « Au restaurant » | Tous les textes |
| Classificateurs | « Personnes & général » et « Objets selon leur forme » | Tous les groupes |
| Aujourd'hui | Séance sur les contenus gratuits | Tous les contenus accessibles |
| Synchronisation et hors ligne | Inclus | Inclus |

- L'essai Yidiano+ dure 7 jours, commence à la demande et ne peut être utilisé qu'une fois.
- Le rôle `admin` a l'accès complet et peut afficher l'application comme un compte gratuit.
- Le rôle `beta` a l'accès complet pendant la bêta. Au lancement commercial, les bêta-testeurs recevront un mois
  offert, puis deviendront des utilisateurs ordinaires sauf abonnement.
- Le rôle `user` suit les droits gratuits, l'essai et l'abonnement.
- Les restrictions sont d'abord appliquées dans le client. Avant d'ouvrir les inscriptions publiques, les contenus
  payants devront aussi être servis uniquement après contrôle des droits côté serveur.

## Proposé (à décider)

- **Prix** de départ : 7,99 €/mois et 49,99 €/an (annuel mis en avant). Les concurrents (HelloChinese, Duolingo
  Super) seraient autour de 10-13 €/mois : à vérifier. Modifiable sans toucher au code.
- **Parrainage**, récompense des deux côtés : le filleul a 14 jours d'essai au lieu de 7 ; le parrain gagne 1 mois
  offert quand le filleul paie son premier mois (après le délai de remboursement, contre les faux comptes) ;
  plafond 12 mois par an ; lien personnel et compteur d'amis parrainés dans l'app.

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
