# CLAUDE.md

Contexte permanent du projet. Lire `ARCHITECTURE.md` pour le détail des
contrats, et `NOTES.md` pour l'historique d'implémentation — décisions
prises, pièges déjà rencontrés, specs livrées.

## Le projet

App de jeux familiale, hors ligne, installée en PWA sur l'écran d'accueil d'un iPad
familial. Menu général, sélection du joueur par photo, jeux ajoutés progressivement.
Joueurs : deux adultes et deux jeunes enfants (dont un qui ne lit pas encore).

Jeux livrés : morpion (tic-tac-toe) et la course des poussins (dames-échecs
simplifié). Les deux se jouent en famille (profils réels) ou contre l'ordinateur
(adversaire artificiel à plusieurs niveaux, jamais persisté comme un vrai joueur).

## Cible matérielle — non négociable

Deux appareils à égalité, tous deux verrouillés en **portrait** via le manifest —
l'iPad n'est plus paysage, c'est un choix assumé (l'app tournait en paysage
jusqu'à la spec 04 ; le verrouillage portrait qui suit l'annule volontairement).

| | iPad | iPhone |
|---|---|---|
| Appareil | iPad Air 2 (2015), A8X, 2 Go de RAM | iPhone X (référence) |
| OS | iPadOS 15.8.8 — figé, aucune mise à jour possible | iOS 15.x et plus récent |
| Moteur | Safari / WebKit 15.8 | Safari / WebKit iOS |
| Écran | 2048×1536 physiques, **768×1024 points** en portrait | 375×812 points |
| Orientation | Portrait verrouillée via le manifest | Portrait verrouillée via le manifest |
| Réseau | **Aucun**. L'appareil doit fonctionner en mode avion, indéfiniment | idem |

Tout le code doit tourner sur ces deux navigateurs. En cas de doute sur une API,
vérifier sa disponibilité en Safari 15.0 avant de l'utiliser. Ne jamais introduire
une dépendance sans vérifier sa cible de compilation.

### Disponible

`?.` · `??` · logical assignment · `aspect-ratio` · `gap` en flexbox · `<dialog>` ·
`structuredClone` · `crypto.randomUUID` · `Array.at()` · ES modules · service workers ·
WebRTC (`RTCPeerConnection`, `RTCDataChannel`) · `getUserMedia` en PWA installée

### Indisponible — ne pas utiliser

- **Tailwind v4** (cible Safari 16.4). Le projet est verrouillé sur **Tailwind v3**.
- Container queries, CSS nesting natif, View Transitions, `text-wrap: balance`
- Toute API postérieure à Safari 15.4

## Stack

- Vite + React + TypeScript
- Tailwind **v3** — vérifier la version dans `package.json` avant toute modification
- `vite-plugin-pwa` pour le manifest et le service worker
- Vitest pour la logique de jeu
- `build.target: 'safari15'` dans `vite.config.ts`

Aucun backend. Aucune base de données. Aucun Supabase. Aucun appel réseau,
à l'exécution comme au démarrage.

## Règles absolues

1. **Zéro CDN.** Toute dépendance externe est copiée dans `src/vendor/` et servie
   depuis le bundle. Un `<script src="https://...">` casse l'app hors ligne.
2. **La logique de jeu est pure.** `applyMove(state, move)` ne touche jamais au DOM,
   ne mute jamais son entrée, ne lit ni l'horloge ni `Math.random()` directement.
3. **L'aléatoire passe par un PRNG seedé** rangé dans l'état du jeu. Sans ça, deux
   appareils divergent dès qu'un jeu utilise le hasard.
4. **Le composant `Board` n'applique aucun coup.** Il affiche l'état et appelle
   `onMove`. C'est le shell qui valide, applique et redistribue.
5. **Le shell ne connaît aucune règle de jeu.** Ajouter un jeu = créer un dossier
   sous `src/games/` et ajouter une ligne à `registry.ts`. Rien d'autre.
6. **Pas de photo brute en `localStorage`.** Redimensionner en canvas à 200 px de côté
   avant sérialisation, sinon le quota de 5 Mo saute à trois joueurs.
7. **L'`AudioContext` se débloque au premier tap** sur le menu. iOS refuse tout son
   avant une interaction tactile réelle.

## Conventions de code

- Le code, les identifiants et les commentaires sont en anglais.
- L'interface utilisateur est en français.
- Types stricts, pas de `any`. `strict: true` dans `tsconfig.json`.
- Un jeu = un dossier contenant `logic.ts` (pur, testé), `Board.tsx` (rendu),
  `index.ts` (assemble le `GameModule`).
- `logic.ts` n'importe jamais React ni quoi que ce soit du DOM. C'est la garantie
  qu'il est testable et transportable sur le réseau.
- Tout état persistant passe par `src/storage/index.ts`. Aucun appel direct à
  `localStorage` ailleurs dans le code.

## Commandes

```bash
npm run dev       # serveur local
npm run build     # build de production
npm run preview   # vérifier le build avant déploiement
npm test          # tests de la logique de jeu
npm run lint
```

Test sur l'appareil réel : `npm run dev -- --host`, puis ouvrir l'IP locale depuis
l'iPad. Le service worker exige HTTPS ou localhost — pour tester l'installation et
le mode hors ligne, passer par le déploiement GitHub Pages.

Chaque déploiement qui change quelque chose d'observable ajoute une entrée dans
`CHANGELOG.md`. Ça sert à vérifier, après coup, qu'une mise à jour attendue est
bien arrivée sur l'iPad — voir aussi le repère `commit · date` affiché dans
l'écran Joueurs.

## Direction visuelle

Le sujet est une boîte de jeux de société posée sur la table du salon, pas une
application. Surfaces franches, aplats mats, formes que la main a envie de toucher.
Le jeu occupe l'écran ; l'interface se tait autour.

- Cibles tactiles de **80 px minimum**. Un enfant de quatre ans vise mal.
  Exception documentée : sur iPhone (375 pt de large), une grille dense qui ne
  peut physiquement pas tenir en 80 px/case (l'échiquier 8×8 de la course des
  poussins demanderait 640 px) descend jusqu'à ~44-46 px — la norme tactile
  minimale d'Apple, pas un choix arbitraire. Cette exception ne concerne que les
  grilles denses sur écran étroit ; partout ailleurs (dont le morpion, 3×3,
  ~125 px/case même sur iPhone), 80 px reste la règle.
- Chaque écran doit être navigable **sans savoir lire** : photo du joueur, icône du
  jeu, couleur. Le texte accompagne, il ne porte jamais seul l'information.
- Les photos des joueurs sont l'élément identitaire principal de l'app. Elles sont
  grandes, rondes, et c'est sur elles que tombe l'attention.
- Le mouvement répond à une action : un pion qui se pose, un tour qui passe, une
  victoire. Rien ne bouge tout seul.
- Palette de base : `#1E3D34` plateau · `#F2E4C9` pièces claires ·
  `#F5A623` accent de victoire (jamais utilisé comme couleur de profil —
  se confondrait avec la ligne/l'anneau de victoire). Couleur de joueur :
  8 teintes fixes dans `src/players/palette.ts` (`PLAYER_COLORS`), assignées
  librement à la création du profil.
- Une seule famille de caractères, grasse et large. Pas de deuxième typo décorative.

À éviter, ce sont les réflexes par défaut et ils se voient :
fond crème avec serif à fort contraste et accent terracotta ; grille de cartes
arrondies identiques avec la même ombre grise sous chacune ; libellés en majuscules
espacées au-dessus des titres ; flèche `→` collée au bout des boutons ; dégradés
décoratifs.

## Bibliothèques retenues

| Usage | Choix | Licence | Note |
|---|---|---|---|
| Effets sonores | ZzFX | MIT | < 1 ko, sons générés en code, aucun fichier audio |
| Confettis de victoire | canvas-confetti | ISC | Baisser `particleCount`, respecter `prefers-reduced-motion` |
| Icônes, badges (avatars) | OpenMoji | CC BY-SA 4.0 | SVG copiés localement, pas de CDN |
| Icônes de niveau, avatar par défaut, icônes de mode | Flaticon (ou similaire) | Gratuite, **attribution obligatoire** | Fournies par l'utilisateur via un dossier `idée/` hors dépôt ; vendorisées avec un `LICENSE.md` par lot (`src/vendor/chess-race-levels/`, `default-avatar/`, `mode-icons/`) — **attribution exacte (auteur/pack, lien) encore à compléter dans chacun** avant toute publication |

## Ce qu'il ne faut jamais faire

- Ajouter une dépendance lourde sans mesurer l'impact sur le bundle. 2 Go de RAM.
- Mettre de la logique de jeu dans le shell, ou du rendu dans `logic.ts`.
- Utiliser `Math.random()` dans un jeu.
- Supposer qu'internet existe.
- Modifier `registry.ts` pour autre chose que déclarer un jeu.
- Passer à Tailwind v4.
- Repasser `injectRegister` à sa valeur par défaut dans `vite.config.ts`, ou
  supprimer `src/pwa.ts`. L'enregistrement du service worker est fait à la
  main exprès, pour revérifier une mise à jour à chaque retour au premier
  plan — sans ça, l'app installée reste bloquée sur une vieille version
  jusqu'à fermeture complète. Détail dans `NOTES.md`.
