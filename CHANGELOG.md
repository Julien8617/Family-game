# Changelog

Une ligne par déploiement, pour vérifier après coup que la mise à jour attendue
est bien arrivée sur l'iPad — voir aussi le repère de version discret dans
l'écran « Joueurs » (coin bas, format `commit · date`).

## Non publié

- Ouverture de la partie « musique » : une tuile « Musique » dans le menu
  ouvre un sous-menu de mini-jeux. Premier jeu : « Tape avec moi », une
  comptine (« Au clair de la lune », « Frère Jacques », « Ah ! vous
  dirai-je, maman », « Sur le pont d'Avignon ») dont on tape la pulsation
  sur un grand tapis tactile, quatre tempos du plus lent au plus rapide, un
  métronome à pendule pour cadencer le temps pendant qu'on tape. Avant la
  première partie de rythme, une courte calibration (tapé huit fois sur un
  disque, en rythme) mesure le décalage tactile de l'appareil, aussi
  accessible à tout moment depuis l'écran Joueurs. Un compte à rebours au
  même tempo précède désormais aussi bien la calibration que chaque
  chanson, le temps de se caler avant que les taps comptent vraiment.
- Rejet de la paume : un enfant qui pose la paume sur l'écran en tapant du
  doigt n'empêche plus le jeu de répondre. Activé par défaut ; interrupteur
  de secours sur l'écran Joueurs si besoin de le désactiver.
- Écran « Qui joue ? » : avec plusieurs profils enregistrés, présélectionne
  maintenant l'équipe (et le mode) de la dernière partie jouée à *ce* jeu,
  pas seulement quand il n'y a qu'un seul profil.
- Nouveau jeu : Mémoire sonore, premier jeu solo (pas besoin d'un deuxième
  joueur ni d'un adversaire). Une séquence de pads lumineux et sonores à
  répéter, de plus en plus longue ; difficulté = nombre de pads (2, 4, 6 ou
  8) et vitesse (lent à très rapide). Score de la partie et meilleur score
  affichés en fin de partie, gardés séparément par nombre de pads.
- Nouveau jeu : Puissance 4, en famille ou contre l'ordinateur (quatre
  niveaux, comme la course des poussins). Plateau à trous sur panneau
  sombre, jeton qui tombe avec un petit rebond à l'arrivée.
- La course des poussins : la case de départ et la case d'arrivée du
  dernier coup (joueur ou ordinateur) sont maintenant surlignées, bien
  visibles sur case claire comme foncée.
- Écran « Qui commence ? » : plus de mention « Blancs »/« Noirs » sous les
  photos, et le bouton « Retour » est maintenant séparé d'« Au hasard », en
  bas de l'écran.
- Choisir une photo ou un avatar n'est plus obligatoire pour créer un
  joueur : un avatar par défaut est déjà en place, à remplacer si on veut.
- Morpion : nouveau mode « Contre l'ordinateur », trois niveaux (Facile,
  Moyen, Imbattable — ce dernier ne perd jamais). Contre l'Imbattable, une
  série de défaites d'affilée adoucit discrètement le niveau réellement joué
  (Moyen à partir de 3 défaites, Facile à partir de 5), remis à zéro dès une
  victoire ou un match nul. Choix de qui commence avant chaque partie, comme
  pour la course des poussins ; en famille, chacun a maintenant aussi son
  repère de tour dupliqué haut/bas.
- Écran « Qui joue ? » : les boutons de mode (En famille/Contre
  l'ordinateur) et de niveau ne montrent plus que leur icône, sans texte —
  une rangée « NIVEAU » identifie le sélecteur de niveau.
- Écran de création de profil : les 8 couleurs sont maintenant présentées en
  grille fixe (2 lignes de 4), pas un empilement qui varie selon la largeur
  de l'écran.
- Avec un seul profil enregistré, l'écran « Qui joue ? » d'un jeu jouable
  contre l'ordinateur démarre directement sur ce profil et ce mode — plus
  besoin de taper deux fois pour lancer une partie.
- Support iPhone à égalité avec l'iPad : l'app est maintenant verrouillée en
  **portrait** sur les deux appareils (avant : iPad uniquement, en paysage).
  Le mode famille (deux profils, appareil partagé) fonctionne à l'identique
  sur iPhone. Sur les jeux à grille dense (l'échiquier de la course des
  poussins), les cases sont plus petites sur iPhone que sur iPad faute de place
  à l'écran — reste jouable, cible tactile réduite mais conforme au minimum
  recommandé par Apple.
- Spec 04 — La course des poussins : premier palier vers les échecs. Vrai
  échiquier 8×8, coordonnées, avance et prise en diagonale. Les pions
  reprennent la couleur de profil de leur joueur plutôt qu'un blanc/noir
  classique : intérieur blanc pour les Blancs, intérieur teinté (sombre) pour
  les Noirs, même contour dans la couleur du joueur des deux côtés. Choix de
  qui commence (Blancs, Noirs, ou au hasard)
  avant chaque partie. Plateau fixe pour toute la partie : orientation
  standard en famille (deux profils, on se passe l'iPad), orientée sur son
  propre camp du début à la fin contre l'ordinateur (un profil, quatre
  niveaux : l'œuf, le poussin, la poule, le coq — du hasard pur à un vrai
  moteur de recherche, chaque niveau illustré par une icône animée qui
  s'anime pendant qu'il est sélectionné), quelle que soit la couleur
  choisie. En famille, un
  repère (photo, nom) dupliqué en haut et en bas de l'écran — chacun voit
  le sien à l'endroit, sait d'un coup d'œil si c'est son tour, sans que le
  plateau ne bouge.
- Bouton « Quitter » sur tous les jeux (coin haut gauche) : rester appuyé
  0,6 seconde pour interrompre une partie en cours et revenir au menu — un
  simple tap ne fait rien, pour éviter qu'une partie soit coupée par
  mégarde.

## 2026-09-07 — Avatar facultatif et recadrage repositionnable

- Photo de profil facultative : possibilité de choisir un avatar (20
  personnages, dessins OpenMoji vendorisés — voir
  `src/players/avatars/LICENSE.md`) à la place d'une vraie photo.
- Recadrage repositionnable et zoomable : on peut glisser la photo pour la
  recentrer dans le cercle et régler le zoom (curseur, jusqu'à ×3) avant de
  valider, plutôt qu'un centrage automatique fixe.

## 2026-09-07 — Correctif mise à jour PWA

- Correctif : l'app installée ne se remettait pas à jour toute seule après un
  déploiement — iOS réveille souvent la PWA depuis un état suspendu plutôt que
  de vraiment la recharger, ce qui empêchait la vérification native de
  nouvelle version de se déclencher. L'app revérifie maintenant elle-même à
  chaque retour au premier plan (`src/pwa.ts`).
- Repère de version (commit + date de build) affiché dans l'écran « Joueurs ».
- Spec 03 — son, confettis, célébration :
  - Effets sonores ZzFX (coup, coup invalide, tour, victoire, égalité, tap
    menu), vendorisés dans `src/vendor/`, avec interrupteur dans l'écran
    « Joueurs » (persisté, activé par défaut).
  - Confettis (canvas-confetti, vendorisé) à la victoire, aux couleurs du
    gagnant ; rien sur un match nul.
  - Morpion : ligne gagnante tracée sur le plateau (`getWinningLine`), avant
    l'écran de résultat.
  - Écran de résultat : grande photo du gagnant ; les deux photos côte à côte
    sur un match nul.
  - Stockage consolidé dans `src/storage/` (joueurs + réglages), seul module
    de l'app à toucher `localStorage`.

## 2026-09-06 — Spec 02 : profils joueurs et photos

- Vrais profils (photo, prénom, couleur) à la place des joueurs codés en dur :
  création/modification/suppression depuis un écran dédié, accessible par un
  bouton discret du menu.
- Sélection des joueurs par photo avant chaque partie.
- Photos recadrées en carré et redimensionnées à 200×200 avant stockage.
- Correctif : le clavier ne s'ouvrait pas sur le champ prénom sur iPadOS
  (effet de bord d'un `user-select: none` global posé en spec 01).
- Correctif de déploiement : le job de publication GitHub Pages avait été
  annulé silencieusement par la file d'attente de GitHub la première fois.

## 2026-09-06 — Spec 01 : fondations, PWA installable, morpion jouable

- Projet Vite + React + TypeScript, Tailwind v3, PWA installable et
  fonctionnelle hors ligne (précache complet, `registerType: 'autoUpdate'`).
- Déploiement automatique sur GitHub Pages à chaque push sur `main`.
- Contrat de jeu (`GameModule`) et premier jeu : le morpion, à deux joueurs
  codés en dur en attendant les vrais profils.
