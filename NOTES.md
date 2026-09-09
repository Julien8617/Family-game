# Notes d'implémentation

Historique à l'usage des sessions futures (humaines ou IA) : ce qui a été
tranché, pourquoi, et les pièges déjà payés une fois. Différent de
`CHANGELOG.md` (ce qui a été livré, pour l'utilisateur) et d'`ARCHITECTURE.md`
(les contrats stables) — ici, le raisonnement et les erreurs à ne pas refaire.

## Spec 01 — Fondations, PWA installable, morpion jouable

- Police : `ui-rounded` (rend SF Pro Rounded nativement sur iPadOS Safari) au
  lieu de vendoriser une police web — zéro octet, zéro dépendance, et c'est
  justement la cible réelle qui en profite. Décidé seul, validé ensuite.
- Icônes PWA (192/512/apple-touch) générées par un script Node (encodeur PNG
  à la main via `zlib`) faute d'artwork réel — un placeholder fonctionnel, pas
  un choix design définitif.
- **Piège déploiement #1** : au tout premier déploiement, GitHub Pages était
  resté sur la source par défaut « Deploy from a branch », qui entrait en
  conflit avec le workflow GitHub Actions et servait parfois le code source
  brut non buildé. Réglage Settings → Pages → Source à mettre sur
  « GitHub Actions » avant même le premier push si possible.

## Spec 02 — Profils joueurs et photos

- Schéma de stockage versionné dès le début (`{ version, players }`), même
  avec une seule version existante — c'est ce qui a permis à la spec 03 de
  déplacer le module de stockage sans migration (voir plus bas).
- Orientation EXIF : WebKit applique déjà la rotation au décodage d'un
  `<img>`/`drawImage` ; `naturalWidth`/`naturalHeight` reflètent l'image déjà
  corrigée. **Ne jamais ré-appliquer de rotation manuelle par-dessus** — c'est
  le piège classique de double-rotation. Vérifié pour de vrai sur l'iPad avec
  une photo prise en portrait.
- `user-select: none` posé globalement sur `<body>` (pour l'effet « appli, pas
  page web ») empêchait WebKit de placer un curseur éditable dans les
  `<input>` — le clavier ne s'ouvrait jamais sur iPadOS. Fix : `user-select:
  text` explicite sur `input, textarea`. Invisible en dev (pas de clavier
  virtuel sur desktop), n'est apparu qu'au test réel sur iPad.
- `PlayerListScreen.tsx` ajouté sans être dans l'arborescence d'origine
  d'`ARCHITECTURE.md` — nécessaire comme point d'entrée pour choisir *quel*
  profil modifier (la spec ne décrivait que `PlayerEditor.tsx`).
- **Piège déploiement #2** : un job de déploiement peut être annulé
  silencieusement par la file d'attente de GitHub Pages
  (« Canceling since a higher priority waiting request for pages exists »)
  alors que la liste des runs dans l'UI affiche « Success ». Toujours vérifier
  le contenu réellement servi, pas juste le statut du run.

## Spec 03 — Son, confettis, célébration

- Stockage consolidé : `players/storage.ts` → `src/storage/index.ts`, seul
  module de l'app à toucher `localStorage` (joueurs *et* réglages). La clé
  `players` et sa version n'ont pas changé → zéro migration, les profils
  existants survivent au refactor sans rien faire de spécial.
- **ZzFX modifié** : l'original crée `new AudioContext` à l'évaluation du
  module. Ça casse tout import sous Vitest (pas d'`AudioContext` en
  environnement `node`) et rendait la règle « déblocage audio au premier tap »
  vraie par chance plutôt que par construction. Fix : `AudioContext` créé
  paresseusement (`zzfxContext()`), déclenché par `zzfxUnlock()`. Documenté
  dans `src/vendor/LICENSES.md`.
- Le déclenchement des sons vit entièrement dans le handler synchrone du
  transport (`GameScreen`), jamais dans un updater `setState` (React peut
  l'invoquer deux fois en `StrictMode`/dev → son joué deux fois) ni dans un
  `useEffect` (asynchrone par rapport au geste, risque avec la politique
  autoplay de Safari). L'état précédent est lu via une ref tenue à jour, pas
  via une closure sur `state` (qui serait périmée entre deux appels).
- Au morpion, un coup valide non terminal change toujours le joueur courant
  (alternance stricte) → `move` et `turn` sonnent toujours ensemble en milieu
  de partie. Décision : accepté tel quel (deux sons courts, timbres
  différents) ; sur le coup qui termine la partie, seul le son victoire/nul
  joue (move/turn supprimés). Un futur jeu à tours multiples ferait diverger
  ces deux sons naturellement, sans changer le code du shell.
- Confettis : utiliser l'export par défaut de `canvas-confetti` (pas
  `.create()`) — il gère déjà tout seul un canvas plein écran qu'il retire du
  DOM à la fin de l'animation. Aucune gestion manuelle nécessaire.
- Ligne gagnante : une vraie ligne SVG tracée entre les centres des cases
  (pas seulement l'anneau par case, gardé en plus), pour coller au mot
  « trace » de la spec. Entièrement interne à `tictactoe/logic.ts` +
  `Board.tsx`, zéro changement du contrat `GameModule`.
- Ordre ligne → photo → confettis : `GameScreen` attend 900 ms après une
  victoire/égalité avant de basculer sur `ResultScreen` (le temps de voir la
  ligne) ; `ResultScreen` attend encore 200 ms avant les confettis (le temps
  de voir la photo).
- **Correctif mise à jour PWA** : le script d'enregistrement du service
  worker auto-injecté ne revérifie une nouvelle version que sur une vraie
  navigation. Une PWA installée sur iPad est presque toujours *réveillée*
  depuis un état suspendu par iOS, pas rechargée — cette vérification ne se
  déclenche donc quasiment jamais. Fix : enregistrement manuel
  (`src/pwa.ts`, `injectRegister: false` dans `vite.config.ts`), qui
  revérifie explicitement à chaque `visibilitychange` vers `visible`, plus un
  filet de sécurité toutes les heures. **Ne pas revenir en arrière
  là-dessus** (voir la règle correspondante dans `CLAUDE.md`).
- **Piège déploiement #3** : la file d'attente de GitHub Pages peut annuler
  des déploiements en cascade si on repousse plusieurs commits vides de
  retrigger trop vite les uns après les autres (le nouveau push annule le
  précédent via `concurrency: cancel-in-progress`, et l'environnement Pages
  ne semble pas gérer proprement des annulations répétées rapprochées). Fix :
  pousser **un seul** commit vide, puis attendre plusieurs minutes sans rien
  pousser de plus avant de revérifier.
- `WebFetch` qui résume la page HTML des Actions GitHub a rapporté « Success »
  pour un run dont le job `deploy` avait en réalité été annulé — deux fois.
  Utiliser l'API REST publique (`api.github.com/repos/<owner>/<repo>/actions/
  runs[/…/jobs]`) donne le vrai statut structuré, mais elle est limitée à 60
  requêtes/heure sans authentification : ne pas la solliciter en boucle
  serrée. Vérifier directement la taille/le hash du bundle JS servi en
  production (`curl`) est illimité et plus direct de toute façon.
- Même une fois le nouveau contenu bien en ligne côté serveur, une PWA déjà
  installée garde son ancien service worker et son ancien cache tant qu'il
  n'a pas eu l'occasion de se mettre à jour une fois — le correctif de mise à
  jour ne peut pas s'appliquer rétroactivement à lui-même. Sur iPad : Réglages
  → Safari → Avancé → Données de sites web → supprimer le site, puis
  réinstaller. Après ce cycle unique, les déploiements suivants devraient se
  mettre à jour tout seuls.
- Repère de version (commit court + date de build, `vite.config.ts` → `define`
  + `git rev-parse --short HEAD`) affiché dans l'écran Joueurs, pour qu'un
  humain puisse confirmer qu'un déploiement est bien arrivé sans avoir à
  demander une vérification par `curl` à chaque fois.

## Amélioration post-spec-03 : avatar facultatif + recadrage repositionnable/zoomable

- La photo devient facultative : un onglet « Avatar » propose 20 personnages
  (dessins OpenMoji, vendorisés dans `src/vendor/avatars/`). Stockés comme
  `data:image/svg+xml` dans `player.photo` — exactement le même champ qu'une
  vraie photo, donc **zéro changement** dans les écrans qui l'affichent déjà
  (`Board`, `GameScreen`, `ResultScreen`, `PlayerPickScreen`,
  `PlayerListScreen`).
- **Piège** : un import SVG standard de Vite n'est transformé en data URI que
  sous ~4 Ko (`assetsInlineLimit`) ; plusieurs des 20 avatars dépassent cette
  taille et seraient devenus des fichiers séparés référencés par une URL — ce
  qui aurait fait échouer le validateur de `storage/index.ts` (qui exige que
  `photo` commence par `data:image/`), et silencieusement fait disparaître ces
  profils au rechargement. Fix : import `?raw` (texte brut, toujours, quelle
  que soit la taille) + construction manuelle du data URI dans `avatars.ts`.
- Recadrage repositionnable et zoomable (glisser pour recentrer, curseur de
  zoom ×1 à ×3) : la position est stockée en **fraction** (0..1) de la marge
  de défilement possible, pas en pixels bruts — reste valide automatiquement
  quand le zoom change, pas besoin de reclamper à la main.
- `photo.ts` scindé en `loadImage` (charge le fichier, garde le blob vivant
  via un `revoke()` explicite à appeler seulement une fois le recadrage
  confirmé ou annulé — un revoke prématuré casse le `<img>` du cadreur qui
  réutilise cette même URL de blob) et `cropToDataUrl` (pure, prend
  maintenant `sx`/`sy`/`side` explicites au lieu de calculer un centrage fixe
  en interne).

## Avatar par défaut : choisir une photo/un avatar devient facultatif

- Jusqu'ici la photo était devenue facultative (section précédente) mais il
  fallait quand même choisir *quelque chose* — `photo.length > 0` était une
  condition de `canSave`. Retiré : un nouveau profil démarre déjà avec un
  avatar par défaut (silhouette blanche sur fond doré, fourni par
  l'utilisateur, `idée/utilisateur.png`), pas un état vide à remplir. On peut
  enregistrer un joueur en ne renseignant que le prénom et la couleur.
- **Même piège de taille d'inlining Vite** que pour les avatars OpenMoji
  (section précédente), mais pas la même solution : `?raw` ne marche que
  pour du texte (SVG), pas pour un PNG binaire. Résolu en pré-encodant une
  bonne fois en base64 (script Node ponctuel, pas une dépendance de build) et
  en collant le résultat comme constante `data:image/png;base64,...` dans
  `players/defaultAvatar.ts` — même intention que `?raw` (un data URI
  toujours auto-suffisant, quelle que soit la taille), juste sans plugin.
- Redimensionné 512×512 → 200×200 avant encodage (`sharp-cli` via `npx`,
  outil ponctuel), comme n'importe quelle photo de profil (`players/photo.ts`)
  — sinon chaque joueur sans photo alourdirait `localStorage` inutilement,
  exactement le risque que la règle des 200 px existe déjà pour éviter.
- Licence Flaticon (ou similaire) déclarée à l'utilisateur avant d'intégrer,
  même démarche que pour les GIF de niveau de la course des poussins —
  documentée dans `src/vendor/default-avatar/LICENSE.md`, attribution exacte
  encore à compléter.
- Aucun autre écran à toucher : `player.photo` n'est jamais vide, donc `Board`,
  `GameScreen`, `ResultScreen`, `PlayerPickScreen`, `PlayerListScreen`
  continuent de l'afficher sans rien savoir de ce changement — même bénéfice
  que le choix initial de stocker les avatars dans le même champ qu'une photo.

## Patron réutilisable : vendoriser une librairie ou des assets externes

Utilisé pour ZzFX, canvas-confetti, et les 20 avatars OpenMoji :

1. `npm install --no-save <paquet>` — jamais `--save` : ce n'est pas une
   dépendance à l'exécution, seulement une façon d'obtenir le fichier source
   exact.
2. Copier le(s) fichier(s) tel(s) quel(s) depuis `node_modules/<paquet>/…`
   vers `src/vendor/` (sous-dossier dédié si ce sont des assets de contenu
   plutôt que du code, ex. `src/vendor/avatars/`) — `Read` puis `Write`,
   jamais un résumé ou une reformulation.
3. Documenter source, licence, attribution et modifications éventuelles dans
   un `LICENSE(S).md` colocalisé.
4. `npm uninstall <paquet>`.
5. Toute modification du fichier vendorisé (ex. `zzfx.js`) se documente dans
   ce même fichier de licence, avec le pourquoi.

## Spec 04 — La course des poussins (premier palier vers les échecs)

- Contrat étendu de façon additive (`GameModule.bot?`), sur le modèle de
  `supportsRemote` : un jeu qui connaît un adversaire artificiel expose
  `bot.levels` et `bot.chooseMove(state, level)`, purs et déterministes. Le
  shell ne sait toujours rien des règles — il se contente d'appeler
  `chooseMove` au bon moment (voir plus bas). La frontière a tenu, y compris
  pour un plateau 8×8 avec deux modes de jeu.
- **Recherche vs budget de temps, une tension réelle** : le niveau 4
  (« le coq ») s'approfondit par itération jusqu'à 500 ms mesurés à
  l'horloge (`iterativeDeepen` dans `bot.ts`) — mais lire l'horloge contredit
  en toute rigueur « chooseMove pure et déterministe ». Résolu en séparant
  clairement les deux : `searchBestMove(state, depth)` est la brique pure,
  profondeur fixée, utilisée telle quelle par le niveau 3 (profondeur 4) et
  par tous les tests automatisés (déterminisme, force). Seule
  `iterativeDeepen` lit l'horloge, et seulement pour décider de lancer *une
  profondeur de plus* — jamais pour interrompre une recherche en cours.
  Chaque profondeur terminée reste donc un résultat pur ; le critère « jamais
  plus de 500 ms » (critère 8) se vérifie sur l'iPad réel, pas en test
  unitaire.
- **Test de force (critère 6) : rejouer 200 fois le niveau 4 réel aurait pris
  ~20 minutes** (500 ms × ~15 coups × 200 parties) et aurait introduit une
  variance dépendante de la machine (JIT chaud ou non). `bot.test.ts` utilise
  donc `searchBestMove` à une profondeur fixe (5, contre 4 pour le niveau 3)
  comme représentant fidèle du niveau 4 pour ces 200 parties simulées — le
  vrai `chooseMove(level: 4)` n'est exercé que par un test de fumée à part
  (une seule recherche, marge large). Profondeur 6 marchait aussi (validé)
  mais faisait grimper cette seule suite à 121 s ; profondeur 5 tient le même
  résultat (>95 %) en 49 s.
- **200 parties identiques sinon** : sans variation, les niveaux 2/3/4
  (aucun hasard par construction, glouton et minimax) rejouent exactement la
  même partie sur les 200 seeds testées — le taux de victoire tombe à 0 % ou
  100 %, jamais « plus de 75 % ». Fix : un tie-break *seedé* (le même
  `mulberry32(state.seed, state.moveCount)` que le niveau 1) départage les
  coups à score égal, aux niveaux 2, 3 et 4 — toujours déterministe (même
  state ⇒ même coup), juste dépendant du seed comme le reste du jeu. Écart
  par rapport à la lettre de la spec (qui ne décrit le seed que pour le
  niveau 1) mais nécessaire pour que le critère 6 ait un sens ; les deux
  appariements alternent aussi qui joue en premier pour ne pas biaiser le
  résultat par l'avantage de la première case.
- **Le son `invalid` exige que `Board` tente le coup, pas qu'il l'empêche** :
  contrairement au morpion (`disabled={cell !== null}`), `chess-race/Board.tsx`
  appelle toujours `onMove({from, to})` dès qu'une pièce est sélectionnée et
  qu'on touche une autre case — légale ou non. C'est `GameScreen`
  (`isValidMove`) qui tranche et joue `move` ou `invalid`. La sélection ne
  retombe que sur un vrai changement d'état (`useEffect` sur `state`), pas
  sur une tentative refusée : on peut réessayer tout de suite sans retoucher
  la pièce.
- **Couleurs de pièces fixes, pas la couleur de profil — et littéralement
  blanc/noir** : contrairement au morpion (marque = `player.color`), les
  pièces sont blanches/noires de façon fixe (`chessWhite`/`chessBlack` dans
  `tailwind.config.js`) — un vrai jeu d'échecs n'est pas teinté par qui le
  joue. Deux itérations avant d'arriver là : d'abord jaune/roux (thème
  « poussin » porté par la pièce elle-même, avec un petit bec), rejeté par
  l'utilisateur deux fois de suite — d'abord « garde l'esthétique d'un vrai
  jeu d'échecs » (le bec est resté, juste sur une vraie silhouette de pion),
  puis « pas de bec, un vrai échiquier ». Le thème poussin ne vit plus que
  dans le nom du jeu et les icônes de niveau ; la pièce posée sur l'échiquier
  est un pion classique, sans ornement. La couleur de profil reste
  l'identifiant dans la barre de tour et l'écran de résultat. Contour clair
  sur les pièces noires (`rgba(250,246,236,0.4)`) pour qu'elles ne se
  fondent pas dans la case foncée — l'inverse (contour sombre) sur les
  blanches. Troisième itération : « exactement comme chess.com ». Impossible
  au sens littéral — app hors ligne (zéro appel réseau) et artwork
  propriétaire d'un tiers, pas question de le copier même si le réseau
  existait. La forme Staunton générique qu'il reprend, elle, n'appartient à
  personne (motif de 1849) : silhouette redessinée à la main avec des
  proportions plus fidèles — col net sous la tête (ellipse séparée, pas
  fondue dans le corps), épaule évasée, socle à deux niveaux (`Pawn` dans
  `Board.tsx`, viewBox 45×45 pour plus de finesse que les 24×24 précédents).
- **Revirement ultérieur : couleur de pièce = couleur de profil, comme
  partout ailleurs** — la décision ci-dessus (pièces blanches/noires fixes)
  est explicitement abandonnée. Nouvelle silhouette apportée par
  l'utilisateur (tête ronde, col en gélule, jupe évasée, socle plat, sans le
  socle à deux niveaux — `Pawn.tsx`), avec un skin calculé par
  `pawnSkin(playerColor, side)` (`pawnSkin.ts`) plutôt qu'un skin fixe ou
  choisissable. `tailwind.config.js` : `chessWhite`/`chessBlack` restent
  utilisés, mais seulement pour les rangées d'arrivée, plus pour les pièces.
  Trois itérations sur la table de skins (`pawnSkin.ts`), chaque fois
  affinée par l'utilisateur :
  1. Contour = couleur du joueur brute pour les Blancs, remplissage =
     couleur du joueur brute pour les Noirs (contour sombre fixe partout).
  2. Table `DARK_PAWN_SKINS` : remplissage très sombre teinté par couleur
     (L≈12 %, ne se distingue pas de la case foncée — le camp Noirs reste
     lisiblement « le foncé »), contour de la même teinte remonté à L≈68 %.
  3. Version retenue, table `PLAYER_PAWN_SKINS` : remplissage = couleur du
     joueur telle quelle (pas assombrie), contour = même teinte poussée très
     sombre — deux tons d'une seule famille par joueur, la pièce se lit comme
     « le pion de ce joueur » plutôt que comme un pion bicolore générique
     (contrastes vérifiés par l'utilisateur : contour/remplissage 2,8:1 à
     4,4:1, contour/case claire 8,8:1 à 13,5:1). Les Blancs réutilisent ce
     même contour (par couleur de joueur) sur un remplissage blanc — c'est le
     contour, pas le remplissage, qui porte l'identité de couleur des deux
     côtés. Table indexée directement sur le hex de `player.color` plutôt que
     sur une seconde liste nommée de couleurs, pour ne pas dupliquer
     `PLAYER_COLORS` (`src/players/palette.ts`) comme second point de vérité.
- **« Qui commence ? » — extension générique du contrat, pas un cas
  particulier de chess-race** : `GameMeta.colorLabels?: [string, string]`
  (`['Blancs', 'Noirs']` pour ce jeu) sur le modèle de `supportsRemote`. Si
  défini, `PlayerPickScreen` ajoute une étape après la sélection des
  participants (famille ou bot compris) : deux boutons — un par participant,
  avec son nom et le premier libellé — plus « Au hasard », qui réordonnent
  `players[]` avant `onConfirm`. Le shell ne sait toujours pas *pourquoi*
  l'ordre compte, juste qu'il compte parfois ; un futur jeu à deux camps
  nommés profite du même mécanisme sans y toucher. `chess-race/logic.ts`
  traite déjà `players[0]` comme celui qui commence (c'était vrai depuis le
  début, juste jamais choisi explicitement) — aucun changement côté jeu.
- **Orientation du plateau : fixe pour toute la partie, pas une rotation à
  chaque tour** — corrigé après une première implémentation trop
  hâtive. Premier réflexe : faire tourner le plateau à chaque tour pour que
  le camp au trait soit toujours en bas (`localPlayer={turnPlayer.id}`, qui
  change de coup en coup). Faux : sur un jeu à deux humains qui se passent
  l'iPad, chacun est physiquement d'un côté de l'écran — le plateau d'une
  vraie table ne pivote pas tout seul entre deux coups, seul le joueur se
  penche. Contre l'ordinateur en revanche, l'humain ne bouge jamais : son
  camp doit rester en bas *toute la partie*, qu'il ait choisi Blancs ou
  Noirs. Fix : `GameScreen` calcule désormais un `localPlayer` **stable**,
  pas dérivé de `state.turn` — l'humain contre l'ordinateur (`bot` défini),
  un repère arbitraire mais fixe (`players[0]`) en famille (personne n'est
  plus « local » qu'un autre sur un appareil partagé, donc autant ne jamais
  bouger). `BoardProps.localPlayer` retrouve ainsi son sens d'origine
  (« qui tient cet appareil », spec 01) au lieu d'être détourné en « qui a
  le trait ». `chess-race/Board.tsx` en déduit
  `flipped = colorOf(state, localPlayer) === 'black'` une fois pour toute la
  partie, et inverse l'ordre de parcours des lignes *et* des colonnes
  (rotation 180°, pas un simple miroir). Piège resté valable malgré la
  correction : les bandeaux de rangée d'arrivée et les coordonnées se calent
  sur le bord *visuel* (haut/bas/gauche), recalculé selon `flipped`, jamais
  sur le numéro de case brut — sinon ils finiraient à l'intérieur du plateau
  une fois celui-ci retourné. Les coups eux-mêmes ne sont pas affectés :
  `handleTap` raisonne toujours en indices de case bruts, l'orientation
  n'est qu'un ordre de rendu.
- **Deux humains autour du même iPad : chacun son côté, sans jamais faire
  bouger le plateau** — la suite logique de la correction précédente.
  Question de l'utilisateur : comment chacun peut-il lire les pièces dans
  son sens, si le plateau ne pivote pas ? Réponse retenue : le plateau
  (les cases) ne bouge jamais, mais deux choses sont dupliquées/orientées
  par joueur, pas par tour :
  1. `BoardProps.sharedDevice` (nouveau champ générique, calculé par
     `GameScreen` comme `!bot` — vrai en famille, faux contre l'ordinateur
     et plus tard sur un jeu en réseau où chaque appareil n'a qu'un seul
     spectateur). `chess-race/Board.tsx` tourne à 180° (`transform: rotate
     (180deg)` sur le SVG) les pièces du camp visuellement en haut — en
     mode partagé, `flipped` vaut toujours `false` (cf. note précédente),
     donc c'est toujours les noirs — au lieu de les laisser à l'envers pour
     le joueur assis de ce côté-là.
  2. `GameScreen` remplace la barre de tour unique par deux badges compacts
     (photo + nom) quand `sharedDevice && game.meta.colorLabels` : un en
     haut (tourné à 180°, pour le joueur d'en face), un en bas (à l'endroit).
     Celui dont c'est le tour est mis en avant (anneau de sa couleur,
     opacité pleine), l'autre s'estompe — chacun voit instantanément si
     c'est son tour, depuis son propre côté de la table, sans avoir à lire
     à l'envers.
  Généricité préservée : ni `sharedDevice` ni la logique de duplication ne
  mentionnent les échecs — un futur jeu à deux camps orientés (`colorLabels`
  défini) en profite automatiquement ; le morpion (pas de `colorLabels`) et
  le mode contre l'ordinateur (`sharedDevice` faux) gardent la barre unique
  d'origine, vérifié sans régression dans les deux cas.
- **Taille du plateau a forcé un (petit) changement du shell** : `GameScreen`
  imposait un plateau fixe de 600×600 px à tous les jeux, insuffisant pour
  8×8 cases ≥ 80 px. Remplacé par une taille responsive
  (`min(94vw, calc(100vh - 132px))`) et un en-tête un peu plus compact — geste
  générique de layout, pas une connaissance des règles du jeu, mais un
  changement du shell hors du dossier `chess-race/` qui n'était pas explicite
  dans la spec. Vérifié en navigateur à 1024×768 (viewport iPad Air 2) :
  cases ≈ 80–85 px selon le jeu, morpion inchangé fonctionnellement (juste un
  peu plus grand).
- **Bug préexistant corrigé au passage** : `storage.getSettings()` ne
  fusionnait pas avec les valeurs par défaut — un champ ajouté après coup
  (comme `lastBotLevel`) aurait fait échouer la validation d'un réglage déjà
  stocké et silencieusement tout réinitialisé au défaut. Fix minimal
  (`{ ...DEFAULT_SETTINGS, ...data.settings }`), sans toucher au schéma
  existant.
- **`MenuScreen` doit connaître l'existence d'un bot, pas ses règles** : un
  jeu avec `bot` défini n'a besoin que d'un seul profil réel pour être
  jouable (le bot comble le reste) — sans ce correctif, une famille avec un
  seul profil enregistré verrait la tuile du jeu grisée à tort. Toujours
  générique (`game.bot ? 1 : game.meta.minPlayers`), aucune règle de jeu
  connue du shell.
- **`PlayerPickScreen` : un seul profil enregistré + jeu jouable contre
  l'ordinateur → mode et joueur présélectionnés** (`singlePlayerVsBot`,
  valeurs initiales de `mode`/`selected`, pas un `useEffect` après coup —
  ça évite un rendu intermédiaire sur « En famille » avant de basculer). Ce
  n'est qu'un point de départ : les boutons mode/joueur restent utilisables
  normalement ensuite, rien n'est verrouillé. Un jeu sans `bot` (morpion)
  n'est pas concerné : la condition inclut `Boolean(game.bot)`.
- **Icônes des 4 niveaux dessinées à la main** (`chess-race/levels/*.svg`),
  pas vendorisées comme les avatars OpenMoji — quatre formes simples
  (œuf → poussin → poule → coq), progression de taille/complexité lisible
  d'un coup d'œil sans lire, dans la palette existante. Pas de licence à
  documenter puisque rien n'est emprunté.
- **Revirement : icônes de niveau remplacées par des GIF Flaticon animés**,
  fournis par l'utilisateur (dossier `idée/` à la racine, hors dépôt). Les 4
  SVG dessinés à la main ci-dessus sont supprimés. Deux vrais blocages
  vérifiés avant d'intégrer, pas devinés :
  1. Ce sont de vrais GIF animés (40 à 120 images, boucle infinie, vérifié en
     parsant la structure de blocs GIF à la main faute d'ImageMagick/ffprobe
     disponibles dans l'environnement) — en contradiction directe avec la
     règle « rien ne bouge tout seul ». Résolu en gardant une image statique
     par défaut (`*-static.gif`, la première image de l'animation) et en ne
     basculant sur `*-animated.gif` que pendant que ce niveau est sélectionné
     (`BotLevel.animatedIcon`, `PlayerPickScreen.tsx`) — le mouvement répond
     bien à l'action de sélection du joueur.
  2. Licence inconnue au départ : demandé à l'utilisateur, réponse « licence
     Flaticon gratuite, attribution obligatoire ». Documentée dans
     `src/vendor/chess-race-levels/LICENSE.md` (même principe que
     `avatars/LICENSE.md`) — l'auteur/pack exact et le lien Flaticon d'origine
     restent à compléter par l'utilisateur (visibles sur la page de
     téléchargement Flaticon, pas dans les fichiers eux-mêmes).
  Poids original 640×640, ~4,4 Mo pour les 4 animations : beaucoup trop lourd
  pour une icône affichée à ~96 px sur un appareil précaché hors ligne.
  Réduit avec `gifsicle` (`--resize 200x200 -O3 --lossy=80`, exécuté une fois
  via `npx` — outil de préparation d'assets, pas une dépendance du projet) à
  ~990 Ko pour les 4, sans perte visible à la taille d'affichage réelle.
  `vite.config.ts` : `gif` ajouté à `globPatterns` du workbox — sans ça, ces
  fichiers auraient existé dans `dist/` mais jamais été précachés, cassant le
  niveau après le premier chargement une fois hors ligne (bug qui serait
  passé inaperçu en test local, seulement visible avion/hors ligne).
- **Bouton « Quitter » générique, dans `GameScreen` — pas dans chaque jeu** :
  rester appuyé 0,6 s (pas un simple tap) avant de couper une partie, pour
  qu'un enfant qui touche l'écran par mégarde ne perde jamais une partie en
  cours. Anneau de progression circulaire (SVG `stroke-dasharray` /
  `strokeDashoffset`, avancé par `requestAnimationFrame` plutôt qu'un
  `setInterval` — animation fluide, et le pourcentage se recalcule à partir
  d'un horodatage de départ, jamais d'un compteur de tics qui dériverait).
  `onPointerUp`/`onPointerLeave`/`onPointerCancel` remettent la progression
  à zéro : relâcher avant 0,6 s annule sans laisser de trace. Bouton placé
  avec de la marge (`left-6 top-6`, comme l'icône réglages du menu) plutôt
  que dans l'angle exact de l'écran : un anneau complet reste toujours
  entièrement visible, pas de demi-cercle nécessaire. Cible tactile à
  80 px (`h-20 w-20`), comme l'exige la direction visuelle. Testé par script
  (`PointerEvent` synthétique) faute de pouvoir simuler un appui maintenu
  avec les outils d'automatisation du navigateur : down+up immédiat
  n'annule rien côté partie (correct), un maintien franchissant 0,6 s déclenche
  bien le retour au menu.

## Support iPhone à égalité avec l'iPad (portrait obligatoire sur les deux)

- **Abandon volontaire du verrouillage paysage iPad**, marqué « non négociable »
  jusqu'ici. Décision explicite de l'utilisateur, confirmée après une question
  de clarification (la réponse initiale « portrait pour les deux » aurait pu
  n'être qu'un raccourci sur l'iPhone seul — j'ai vérifié plutôt que de deviner,
  vu que ça inverse une contrainte marquée non négociable et remet en jeu toute
  la mise en page déjà validée sur l'iPad réel). L'iPad et l'iPhone (référence :
  iPhone X, 375×812 pt) sont maintenant deux cibles à égalité, toutes deux
  verrouillées en portrait via le manifest (`vite.config.ts`, `orientation`).
- **`width=1024` en dur dans le viewport meta était une hypothèse iPad-only** :
  sur iPhone, Safari aurait rendu un layout 1024 px puis l'aurait zoomé pour
  tenir dans 375 pt — aucune mise en page responsive n'aurait pu s'appliquer.
  Remplacé par `width=device-width` (`index.html`).
- **Conflit physique tranché avec l'utilisateur** : un échiquier 8×8 plein
  écran ne peut pas avoir des cases de 80 px sur 375 pt de large (640 px
  minimum nécessaires). Choix retenu : cases ~44-46 px sur iPhone pour les
  grilles denses (norme tactile minimale d'Apple, pas un chiffre arbitraire),
  plutôt que de priver l'iPhone de ce jeu. Exception documentée dans
  `CLAUDE.md`, limitée aux grilles denses sur écran étroit — le morpion (3×3,
  ~125 px/case même sur iPhone) n'est pas concerné.
- **Un seul point de rupture Tailwind (`sm:`, 640px)**, pas de mise en page par
  appareil : il tombe naturellement entre 375pt (iPhone) et 768pt (iPad
  portrait), donc `défaut = compact iPhone / sm: = confortable iPad` suffit
  partout où une taille fixe en px doit changer. Pas de redesign, un ajustement
  de classes.
- **`h-screen`/`w-screen` remplacés par `h-full`/`w-full`** sur tous les écrans
  racines : nécessaire pour que le padding de zone de sécurité posé sur `body`
  (`env(safe-area-inset-*)`, pour l'encoche et la barre d'accueil de l'iPhone X)
  ait un effet réel. `100vh`/`100vw` ignorent le padding d'un ancêtre — sans ce
  changement, le padding ajouté n'aurait rien inséré du tout, les écrans
  auraient continué à dessiner sous l'encoche.
- **Formule de taille du plateau (`GameScreen`)** : gardée en `vh` (pas `dvh`,
  hors baseline Safari 15.0 déclarée dans `CLAUDE.md`) — sans risque de barre
  d'adresse dynamique puisque l'app tourne en `display: 'fullscreen'` une fois
  installée. Les insets de sécurité sont ajoutés directement dans le `calc()`
  de réservation de hauteur, parce que ce calc utilise `100vh` (unité de
  viewport brute) qui, contrairement au reste de la mise en page, ne bénéficie
  pas automatiquement du padding posé sur `body`.
- **Bug préexistant corrigé au passage** : le champ prénom de `PlayerEditor`
  (`w-80`, 320 px fixes) débordait déjà sur 375 pt d'écran une fois le padding
  horizontal soustrait — indépendant de ce chantier, mais découvert en
  l'auditant. Passé en `w-full max-w-xs` (fluide, plafonné à la même largeur).
- **Vérification** : seulement en Chrome redimensionné (375×812 et 768×1024)
  à ce stade — pas encore testé sur iPad ni iPhone réels. L'installation PWA,
  le verrouillage d'orientation effectif et les zones de sécurité ne se
  vérifient fiablement que sur l'appareil.

## Mode contre l'ordinateur pour le morpion

- **Contrat `GameModule.bot` déjà générique (spec 04) — aucune modification
  du shell nécessaire.** `MenuScreen`, `PlayerPickScreen`, `GameScreen`
  savaient déjà afficher/gérer un bot sans connaître ses règles ; ajouter
  `bot` à `tictactoe/index.ts` a suffi pour que le mode « Contre l'ordinateur »
  apparaisse, y compris la présélection à un seul profil ajoutée juste avant
  (`singlePlayerVsBot`). C'est la preuve que ce contrat, conçu pour un seul
  jeu, généralise vraiment.
- **Trois niveaux, pas quatre comme la course des poussins** : le morpion a un
  espace d'états minuscule (~5000 positions valides), une échelle à 4 niveaux
  façon échecs y aurait inventé une profondeur qui n'existe pas dans le jeu
  lui-même. Facile (coup aléatoire) → Moyen (gagne si possible, sinon bloque,
  sinon aléatoire) → Imbattable (minimax exhaustif, sans limite de profondeur
  ni horloge — contrairement à `chess-race/bot.ts`, le jeu est trop court
  pour en avoir besoin).
- **`LINES` exporté de `logic.ts`** plutôt que dupliqué dans `bot.ts` : une
  seule liste des lignes gagnantes, réutilisée par `getWinningLine` et par le
  niveau imbattable (`wouldWin`, qui teste un coup pour n'importe quel joueur,
  indépendamment de `state.turn` — nécessaire pour évaluer aussi bien son
  propre coup gagnant que la menace de l'adversaire).
- **Pas de champ `moveCount` dans `TicTacToeState`** (contrairement à
  `ChessRaceState`) : le nombre de cases déjà jouées (`board.filter(c => c
  !== null).length`) suffit pour dériver la seed du tirage aléatoire à
  chaque coup — inutile d'ajouter un champ d'état pour ça.
- **Tests de force réduits de 100 à 30 parties** pour les deux invariants
  « l'imbattable ne perd jamais » : ce n'est pas une mesure statistique (comme
  les seuils de pourcentage de chess-race) mais un invariant prouvé par la
  recherche exhaustive — 30 parties (premier joueur alterné, seeds variés)
  suffisent à l'exercer. Passage de 32 s à 12 s pour ce fichier de tests ;
  chaque partie relance une recherche minimax complète à chaque coup de
  l'imbattable, sans mémoïsation ni table de transposition.
- **Icônes dessinées à la main puis abandonnées** : première version (dé,
  ampoule, étoile, patron des icônes d'origine de la course des poussins) —
  remplacée ensuite, à la demande de l'utilisateur, par les GIF Flaticon
  poussin/poule/coq déjà vendorisés pour la course des poussins
  (`src/vendor/chess-race-levels/`). Même vocabulaire visuel de progression
  dans les deux jeux plutôt qu'un second jeu d'icônes pour trois niveaux
  seulement — les fichiers `easy.svg`/`medium.svg`/`hard.svg` sont supprimés.
- **Vérifié en jouant contre le niveau imbattable** (navigateur, coups
  choisis à la main pour tester un piège classique du morpion — double coin
  adverse) : match nul, comme attendu d'un minimax correct. Pas de partie
  perdue possible à tester, l'invariant est déjà prouvé par les tests.
- **Adoucissement discret de l'Imbattable après une série de défaites**
  (`tictactoe/bot.ts`, `adjustLevel`) : un enfant de 5 ans qui enchaîne les
  défaites contre un adversaire parfait risque de se lasser du jeu, pas
  seulement de perdre. 3 défaites d'affilée → la partie suivante se joue en
  Moyen ; 5 → Facile. Toute victoire ou tout nul remet le compteur à zéro.
  Le sélecteur de niveau reste sur « Imbattable » tout du long — rien
  n'indique à l'enfant que le niveau réel a changé, l'effet est voulu
  invisible (mécanique de « pitié », comme dans beaucoup de jeux).
  - **Extension générique du contrat, pas une exception pour le morpion** :
    `GameModule.bot.adjustLevel?(selectedLevel, lossStreak)` est optionnel ;
    le shell l'appelle toujours s'il existe (`GameScreen.tsx`, juste avant
    `chooseMove`) mais ignore son absence pour tout autre jeu. La *règle*
    (3 → Moyen, 5 → Facile) reste propre au morpion, qui seul sait que son
    niveau 3 est un minimax exhaustif — chess-race n'implémente pas cette
    fonction, son niveau 3 (« La poule ») n'a pas la même signification.
  - **Le streak vit dans `App.tsx`, pas dans `GameScreen`** : `GameScreen`
    est démonté/remonté à chaque partie (`key={screen.seed}`), donc un état
    local n'y survivrait pas à un « Rejouer ». Porté par les variants `game`/
    `result` de `Screen`, initialisé à 0 au moment du choix des joueurs,
    recalculé à la fin de chaque partie (`onGameEnd` : incrémente si le bot a
    gagné, remet à 0 sinon) et transmis tel quel au rejeu.
  - **Vérifié en conditions réelles** (navigateur, 3 défaites provoquées à la
    main contre l'Imbattable) : dès la 4ᵉ partie, le bot répond à une
    ouverture en coin par un autre coin plutôt que le centre — signature du
    niveau Moyen, jamais vue sur les 3 parties précédentes — ce qui a permis
    de le battre par une fourchette classique (double menace qu'un niveau
    sans recherche en profondeur ne peut bloquer que d'un côté).

## « Qui commence ? » ajouté au morpion

- Demandé explicitement « de la même manière qu'à la course des poussins » :
  réutilise tel quel `game.meta.colorLabels` (`tictactoe/index.ts`,
  `colorLabels: ['Commence', 'Commence']`) — zéro changement dans
  `PlayerPickScreen`/`GameScreen`, la mécanique existait déjà pour n'importe
  quel jeu à deux joueurs où l'ordre compte, morpion compris. Deuxième
  confirmation (après le bot) que le contrat générique de spec 04 tient au-
  delà d'un seul jeu.
- Le morpion n'a pas de camps (juste un ordre de passage, pas de « couleur »
  comme Blancs/Noirs), donc les deux libellés du tuple sont identiques —
  `PlayerPickScreen` n'affiche de toute façon que le premier (`colorLabels[0]`)
  sous chaque photo candidate. Documenté dans un commentaire à l'endroit de
  la déclaration pour que ça ne passe pas pour un oubli.
- **Effet de bord assumé, pas corrigé** : `colorLabels` déclenche aussi
  `dualSided` dans `GameScreen` (badges dupliqués haut/bas en famille) —
  conçu à l'origine pour les pièces d'échecs qui ont besoin d'être retournées
  pour le joueur d'en face. Le plateau du morpion (cercles simples, pas de
  notion de sens) n'a rien à retourner ; `Board.tsx` ignore déjà
  `sharedDevice`. Résultat : chaque joueur reçoit son repère de tour dupliqué,
  sans aucune pièce à corriger — un bénéfice gratuit plutôt qu'un problème,
  vérifié en jouant une partie en famille.

## Icônes pour les boutons de mode (En famille / Contre l'ordinateur)

- Boutons texte (`PlayerPickScreen.tsx`) remplacés par des icônes (silhouette
  famille, robot — fournies par l'utilisateur), même style de tuile que le
  sélecteur de niveau juste en dessous sur le même écran (fond `bg-piece`,
  anneau orange si sélectionné) — cohérence visuelle entre les deux
  sélecteurs de la même page, et encore un pas vers « navigable sans savoir
  lire ». Le libellé texte reste sous chaque icône, comme pour les niveaux :
  l'icône porte le sens principal, le texte reste un appoint.
- **Différence avec les icônes de niveau déjà en place** : celles-ci n'ont
  pas de fond propre (PNG trait noir sur transparent, contrairement aux GIF
  poussin/poule/coq qui embarquent déjà leur propre disque blanc) — d'où le
  `bg-piece` explicite ajouté sur la tuile, sinon le trait noir se serait
  fondu dans le fond vert foncé du plateau.
- Vendorisées dans `src/vendor/mode-icons/` (redimensionnées 512×512 → 128×128,
  `sharp-cli` via `npx`), même licence Flaticon (ou similaire) que les autres
  icônes du projet, déclarée par l'utilisateur avant intégration — voir
  `mode-icons/LICENSE.md` (attribution exacte encore à compléter, comme les
  autres fichiers de licence de ce dossier).
- Pas de contrainte de data URI ici (contrairement à `player.photo`) : ces
  icônes ne sont jamais stockées, juste affichées dans l'écran de choix — un
  import Vite classique suffit, `png` était déjà dans `globPatterns` du
  workbox (ajouté pour l'avatar par défaut).

## Écran « Qui joue ? » : icônes seules, sans libellé texte

- Retiré les libellés texte sous les icônes de mode (En famille/Contre
  l'ordinateur) et de niveau (Facile/Moyen/Imbattable, et pareil pour les
  niveaux de la course des poussins puisque c'est le même composant
  générique `PlayerPickScreen`) — demandé explicitement par l'utilisateur.
  L'icône porte maintenant seule le sens ; un `aria-label` reste posé sur
  chaque bouton (accessibilité), juste plus affiché à l'écran.
- **`level.label` n'est pas supprimé du modèle de données** (`BotLevel`,
  `chess-race/index.ts`, `tictactoe/index.ts`) — seulement plus rendu dans
  le sélecteur. Toujours utilisé ailleurs : `createBotPlayer()` s'en sert
  comme nom affiché du bot (barre de tour, écran de résultat), et
  `aria-label` en dépend aussi désormais.
- **« NIVEAU » ajouté en en-tête** au-dessus de la rangée d'icônes de niveau,
  demandé tel quel par l'utilisateur (majuscules). Note pour plus tard :
  `CLAUDE.md` déconseille en général « les libellés en majuscules
  espacées au-dessus des titres » comme réflexe visuel par défaut — ici,
  c'est une demande explicite, pas un réflexe, donc appliqué sans y déroger,
  mais sans ajouter d'espacement de lettres non plus (pas la peine d'aller
  plus loin que ce qui a été demandé).

## Choix de couleur du profil : grille figée à 2×4

- `PlayerEditor.tsx` : `flex flex-wrap` remplacé par `grid grid-cols-4` pour
  les 8 couleurs de `PLAYER_COLORS` — un flex-wrap aurait pu montrer 3, 4 ou
  5 par ligne selon la largeur d'écran (iPhone vs iPad, post-chantier
  responsive) ; la grille fige le nombre par ligne indépendamment de la
  largeur disponible, exactement la garantie demandée (« 2 lignes de 4 »).

## Process établi avec l'utilisateur

- Avant d'écrire du CSS ou une nouvelle direction visuelle : proposer sa
  lecture en quelques lignes et attendre validation. Pour des choix plus
  mineurs déjà cadrés par la spec, trancher et le dire dans le rapport de fin
  de spec plutôt que de bloquer sur une question.
- Ne pas committer avant que l'utilisateur ait vu tourner l'app sur l'iPad
  réel — sauf pour un correctif d'infrastructure/déploiement qui ne peut être
  vérifié qu'en le déployant réellement.
- À la fin de chaque spec : dire explicitement ce qui a été tranché seul, et
  si le contrat de jeu (`GameModule`) a gêné ou non.
