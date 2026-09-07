# Changelog

Une ligne par déploiement, pour vérifier après coup que la mise à jour attendue
est bien arrivée sur l'iPad — voir aussi le repère de version discret dans
l'écran « Joueurs » (coin bas, format `commit · date`).

## Non publié

- Spec 04 — La course des poussins : premier palier vers les échecs. Vrai
  échiquier 8×8, coordonnées, pièces blanches/noires classiques, avance et
  prise en diagonale. Choix de qui commence (Blancs, Noirs, ou au hasard)
  avant chaque partie. Plateau fixe pour toute la partie : orientation
  standard en famille (deux profils, on se passe l'iPad), orientée sur son
  propre camp du début à la fin contre l'ordinateur (un profil, quatre
  niveaux : l'œuf, le poussin, la poule, le coq — du hasard pur à un vrai
  moteur de recherche), quelle que soit la couleur choisie. En famille, un
  repère (photo, nom) dupliqué en haut et en bas de l'écran — chacun voit
  le sien à l'endroit, sait d'un coup d'œil si c'est son tour, sans que le
  plateau ne bouge.

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
