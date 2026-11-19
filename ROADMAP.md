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

## Secondaire

- Grammaire HSK 5 et plus (fait jusqu'au HSK 4 : 把, 被, compléments de résultat, de direction et de possibilité,
  越来越, 是…的, 有点儿 / 一点儿, 连…都, 不但…而且, 只要…就, 只有…才, 不管…都, 越…越).
- Relecture par un locuteur natif du contenu écrit sans source, notamment les nouveaux points et textes HSK 4,
  la grammaire, les classificateurs et les leçons pinyin, dans les deux langues.
- Prononciation : enregistrement de sa voix et comparaison avec le modèle (sans note automatique des tons, peu
  fiable).

## Bêta en cours (décidé le 16/11/2026)

L'app reste en bêta sur invitation : https://yidiano.com, connexion par e-mail, rôles `admin` / `beta` / `user`,
version gratuite et essai Yidiano+ de 7 jours en place (voir [COMMERCIALISATION.md](COMMERCIALISATION.md)). Rien
n'est vendu tant que les tâches « Avant de vendre » ne sont pas faites.

Pendant la bêta :
- Envoyer aux testeurs et à Elisa le message de changement d'adresse (yidiano.com, reconnexion par e-mail, icône à
  réinstaller) et le lien du formulaire d'avis.
- Recruter quelques testeurs de plus (rôle `beta` depuis la page Admin) et suivre leurs retours.
- Relecture par un locuteur natif (voir « Secondaire »).
- Page de présentation publiée avec prix, captures réelles et liens légaux ; les inscriptions restent sur invitation.
- Vidéo de présentation montée ; reste la mesure d'usage minimale (voir « Mesure d'audience »).

## Avant de vendre

Abonnement, web d'abord, version gratuite et essai de 7 jours, parrainage, entreprise individuelle au régime
micro-entreprise et paiement Paddle décidés. Nom, domaine et détails : voir [COMMERCIALISATION.md](COMMERCIALISATION.md).

- **Prix** : 7,99 €/mois et 59,99 €/an TTC (prix Paddle, TVA incluse).
- **Paiement** : Paddle live en production depuis le 19/11/2026 (compte vérifié, domaine yidiano.com approuvé,
  produit Yidiano+ à 7,99 €/mois et 59,99 €/an TTC, webhook `https://yidiano.com/api/paddle/webhook`, lien de
  paiement par défaut ; clé API valable jusqu'au 18/11/2027, à renouveler avant). Restent : nom légal du compte
  Paddle à corriger (« RoneTrade » → Erwan Houadec, affichage Yidiano ; demande à sellers@paddle.com) et un vrai
  paiement de test remboursé.
- **Bêta-testeurs** : premier mois offert au lancement, puis rôle `user`.
- **Contenu payant protégé** : fait pour la grammaire, les lectures et les niveaux HSK 2+ ; ils sont servis par
  `/api/content` aux seuls comptes autorisés et ne sont plus lisibles dans le code de l'app.
- **Inscriptions ouvertes** : retirer la liste d'invités (`AUTH_ALLOWED_EMAILS`) une fois le paiement en place.
- **Comptes** : connexion par e-mail faite ; restent Google, puis Apple.
- **E-mails** : fait depuis no-reply@yidiano.com via Brevo, domaine authentifié.
- **Légal** : immatriculation, mentions légales, conditions d'utilisation et de vente, confidentialité, remboursement
  sous 14 jours et suppression du compte sont en ligne. Restent l'adhésion à un médiateur de la consommation et la
  relecture des textes par un juriste.
- **Marque et domaines** : vérifier « Yidiano » à l'INPI et à l'EUIPO ; décider de yidiano.app et yidiano.fr.
- **Produit** : objectif par jour au premier lancement et parrainage (filleul 14 jours d'essai, parrain 1 mois offert).
  Les captures de la page de présentation sont faites.
- **Technique** : découper le chargement (3,4 Mo d'un bloc ; niveaux HSK chargés à l'ouverture) ; tests sur vrais
  iPhone et Android (son, encoche, hors ligne).
- **Distribution** : PWA sur le web, puis Play Store (TWA) et App Store (Capacitor) avec achats intégrés.
- **Licences et mentions** (page « À propos / crédits » dans l'app et sur la page de vente) :
  - CC-CEDICT (définitions anglaises) : CC BY-SA 4.0.
  - CFDICT (définitions françaises) : CC BY-SA 3.0, citer https://chine.in/mandarin/dictionnaire/CFDICT/ dans
    l'app et sur les pages de présentation.
  - Liste HSK : drkameleon/complete-hsk-vocabulary (MIT) ; lectures : krmanik/HSK-3.0 (Pleco, MIT / CC BY-SA 4.0).
  - Enregistrements : hugolpz/audio-cmn (Chen Wang, Yue Tan / Shtooka), CC BY-SA.
  - Tracés des caractères : Make Me a Hanzi via hanzi-writer-data, Arphic Public License (joindre la licence) ;
    bibliothèque Hanzi Writer : MIT ; clés : Unihan (licence Unicode).
  - Révision espacée : ts-fsrs (MIT) et sa dépendance srs-kit (BSD 3-Clause : reproduire l'avis de copyright,
    fait dans les crédits de l'app).
  - Le partage à l'identique (BY-SA) s'applique aux données, pas au code de l'app : publier les données modifiées
    (définitions nettoyées) sous la même licence.
- **Langues** : ajouter d'autres langues d'interface (espagnol, allemand…) avec le même système de traduction.

## Mesure d'audience

- Pendant la bêta : la base du serveur contient déjà la progression de chaque testeur (réponses, temps de pratique,
  séries) ; une page Admin de statistiques suffit pour ces quelques comptes.
- Avant l'ouverture publique : PostHog (hébergement UE) pour l'entonnoir page de présentation → inscription → essai
  → abonnement et la rétention, avec bandeau de consentement ; pas d'enregistrement de session sans consentement.
