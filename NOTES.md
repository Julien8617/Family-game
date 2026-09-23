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

## Surbrillance du dernier coup (course des poussins)

- **`lastMove` ajouté à `ChessRaceState`** (`{ from, to } | null`), posé par
  `applyMove`, lu par `Board.tsx` pour teinter les deux cases (départ et
  arrivée) du dernier coup joué — humain ou bot, aucune distinction, c'est
  la même case `state.lastMove` dans les deux cas. Reste un champ JSON
  ordinaire : ne casse aucun invariant (état intégralement sérialisable).
- **Couleur revue après retour utilisateur** : première version en
  `bg-piece/30` (crème), jugée trop discrète — quasi invisible sur case
  claire, `piece` (#F2E4C9) et `squareLight` (#EDE0C0) étant deux tons de
  crème presque identiques. Passé à `bg-victory/35` (orange), qui tranche
  nettement sur les deux couleurs de case. Réutiliser `victory` — déjà pris
  par la sélection en cours et les cases jouables — n'a pas posé de
  problème de confusion en pratique : ce sont des anneaux/points, jamais un
  aplat plein bord à bord comme celui-ci, la forme suffit à distinguer les
  deux usages. Le lavis passe sous la pièce et les repères de sélection
  (premier enfant du bouton), jamais par-dessus.
- **Test à jour** : `stateWithBoard` (`logic.test.ts`) et toute construction
  manuelle de `ChessRaceState` doivent maintenant fournir `lastMove` — TS
  strict le signale immédiatement si oublié. Deux tests ajoutés (`null` à la
  création, coup enregistré après `applyMove`).
- Vérifié en navigateur, niveau Facile, bot commençant : la case de départ
  du bot (assombrie) et d'arrivée (pièce dessus) ressortent nettement l'une
  de l'autre, sur case claire comme foncée ; après le coup humain suivant,
  seul le nouveau coup reste surligné.

## Écran « Qui commence ? » : retouches

- **Pastille « Blancs »/« Noirs » retirée** sous chaque photo candidate —
  suite logique du passage « icônes seules » du reste de l'écran de choix
  (mode, niveau) : le texte n'ajoutait rien que la question « Qui commence ?
  » et le clic lui-même ne disaient déjà. `firstLabel` (destructuré de
  `game.meta.colorLabels`) est retiré avec, devenu inutile — le champ
  `colorLabels` continue d'exister et de piloter l'affichage de cet écran,
  seul son contenu textuel n'est plus montré.
- **« Retour » déplacé en bas de l'écran, séparé d'« Au hasard »** : les deux
  n'ont pas le même poids (l'un permet de changer d'avis sur les joueurs,
  l'autre tranche la partie) et les avoir côte à côte suggérait à tort une
  paire d'actions équivalentes. Restructuré en colonne flex : titre en haut,
  bloc central (photos + Au hasard) qui se centre dans l'espace restant via
  `flex-1`, Retour tout en bas comme dernier enfant — pas de `position:
  absolute`, le flux naturel suffit une fois le bloc central mis en `flex-1`.

## Validation de fin de session (2026-09-09)

Toutes les specs décrites ci-dessus depuis « Support iPhone à égalité avec
l'iPad » jusqu'à « Choix de couleur du profil : grille figée à 2×4 » ont été
testées par l'utilisateur (« test ok ») et sont committées (jusqu'à
`33ac1ee update graphique`) — commits faits par l'utilisateur lui-même en
dehors de cette session (jamais via `git commit` dans cette conversation :
la règle « pas de commit avant validation iPad » a été respectée en laissant
l'utilisateur committer). Seule cette mise à jour de documentation
(`ARCHITECTURE.md`, `CLAUDE.md`, `NOTES.md`) restait à committer à la fin de
la session. Voir le message de reprise donné à l'utilisateur pour l'état
exact au moment du `/clear`.

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

## Puissance 4 ajouté (2026-09-09)

Troisième jeu, envisagé dès la phase 2 (ARCHITECTURE.md) mais reporté à
l'époque au profit de la course des poussins. Ajouté exactement comme prévu
par le contrat : un dossier `src/games/connect4/` (`logic.ts`, `bot.ts`,
`Board.tsx`, `index.ts`, `icon.svg`), une ligne dans `registry.ts` — encore
une fois aucune autre modification du shell. `colorLabels` réutilisé comme
pour le morpion (simple ordre de passage, pas deux camps). Icônes de niveau
du bot réutilisées telles quelles depuis `chess-race-levels/` (œuf → poussin
→ poule → coq), comme le morpion l'avait déjà fait pour 3 des 4.

**Piège moteur du bot — pathologie de minimax, pas un bug d'élagage.** En
construisant les niveaux 3/4 (négamax alpha-bêta, même schéma que
chess-race/bot.ts), une recherche à profondeur fixe plus profonde jouait
*moins* bien qu'une recherche moins profonde, de façon reproductible et
parfois franchement lopsided (ex. profondeur 6 n'a gagné que 2 parties sur 20
face à profondeur 4). Piste vérifiée et écartée : un bug d'élagage alpha-bêta —
comparé directement contre un minimax exhaustif sans élagage sur 240
positions (15 seeds × 4 profondeurs de partie × 4 profondeurs de recherche),
score identique à chaque fois. La cause réelle : une heuristique statique
trop simple (comptage de fenêtres de 4 cases + bonus colonne centrale)
combinée à une recherche profonde peut authentiquement produire un jeu plus
faible — une pathologie de recherche connue (Nau, *Pathology in Game Trees*,
1980), pas spécifique à cette implémentation. Ajouter un terme « menaces
prêtes à être jouées » (`immediateThreats`, bot.ts) a atténué l'effet sans
l'éliminer. Essayé et abandonné : choisir une profondeur « sûre » par
tâtonnement (profondeurs impaires seulement, avancer par pas de deux) — ne
généralise pas, la profondeur 7 s'est aussi révélée perdante face à la
profondeur 5 dans un sweep séparé.

**Solution retenue, correcte par construction plutôt que par réglage** :
niveau 4 (« le coq ») joue exactement la même profondeur fixe que le niveau
3 (5) partout, SAUF tout en fin de partie (`EXACT_SOLVE_EMPTY_CELLS = 8`
cases vides ou moins), où il résout la position à fond — profondeur de
recherche = nombre de cases vides restantes, donc `evaluate()` n'est plus
jamais appelée, plus aucune heuristique donc plus aucun risque de
pathologie : le coup choisi est prouvé optimal. Résultat empirique final
(30 parties, niveau 4 vs niveau 3) : 13-15-2, un match nul statistique —
plus jamais le score franchement négatif observé avant ce redesign, mais pas
non plus une victoire nette : les deux niveaux jouent souvent la partie
*identique* (même seed, même recherche) jusqu'à ce que la fin de partie
diverge, ce qui n'arrive pas à chaque fois. Accepté tel quel : le contrat
réel n'est pas « niveau 4 bat toujours niveau 3 » (chess-race/bot.test.ts ne
le garantit pas non plus entre ses propres niveaux 3 et 4), c'est « jamais
nettement pire », qui lui est garanti par construction.

**Pour une session future qui rouvrirait `connect4/bot.ts`** : ne pas
réintroduire un `TIME_BUDGET_MS`/approfondissement itératif classique sans
revalider par un sweep empirique (voir la structure de test jetable utilisée
cette session — un fichier `_debug.test.ts` local, jamais committé, avec des
matchups `searchBestMove(depthA)` vs `searchBestMove(depthB)` sur 20-30
parties) : la pathologie est réelle et reproductible avec cette heuristique,
elle n'était pas due à un facteur de croissance mal calibré.

**Contraste plateau — spécifique à ce jeu.** `PLAYER_COLORS` (palette.ts)
inclut des teintes sombres/vertes (vert émeraude `#4F8F6B`, ardoise
`#52707A`) choisies pour contraster sur fond clair (cases crème du morpion,
pion à trait sombre des échecs). Le plateau puissance 4 est un panneau
*sombre* à trous — un jeton de ces couleurs-là s'y fondait presque
entièrement sans un correctif. Fix dans `Board.tsx` : anneau clair
systématique (`ring-piece/60`) autour de chaque jeton, indépendant de sa
couleur de remplissage — pas un contour sombre comme `pawnSkin.ts`
(chess-race), qui suppose l'inverse (fond clair, pièce qui a besoin d'un
trait *sombre*). Un futur jeu à plateau sombre devrait vérifier ses pièces
contre les 8 couleurs de `PLAYER_COLORS`, pas seulement contre la couleur
de test du moment.

## Confort de sélection des joueurs + rejet de la paume (2026-09-10)

Trois demandes issues d'un usage réel avec un jeune enfant.

- **Présélection à un seul profil, généralisée** : `singlePlayerVsBot`
  (`players.length === 1 && game.bot`) ne couvrait que le cas bot. Un jeu
  solo (mémoire sonore) avec un seul profil enregistré obligeait quand même à
  taper sa photo. Généralisé (`PlayerPickScreen.computeDefaultSelection`) :
  un seul profil → toujours présélectionné, mode « ordinateur » seulement si
  `game.bot` existe (un jeu solo n'a pas de mode ordinateur à proposer).
- **Mémoriser la dernière équipe par jeu** (`storage.ts`, `settings.lastPlayers`,
  `Record<gameId, { mode; playerIds }>`) — décidé par jeu, pas un champ plat
  partagé comme `lastBotLevel` : Alice+Bob au morpion n'a aucune raison de
  présélectionner la même paire à la course des poussins. Lu à l'ouverture de
  `PlayerPickScreen` (filtré contre `listPlayers()` actuel — un profil
  supprimé depuis n'est jamais ressuscité ; clampé à `maxPlayers`), écrit dans
  `finalize()` à partir de `selected` (état du composant), jamais de
  `orderedPlayers` (qui contient le faux joueur bot en mode ordinateur — un id
  qui n'existe dans aucun profil réel n'a rien à faire en stockage).
  Vérifié en navigateur : Alice+Bob sélectionnés au morpion, partie lancée,
  retour au menu, réouverture du morpion → Alice+Bob déjà cochés (rangs 1/2).
- **Rejet de la paume — mesuré sur l'iPad réel, puis corrigé.** Diagnostic
  temporaire (`TouchDiagnostics`, voir plus bas) testé par l'utilisateur sur
  l'iPad Air 2 réel (iPadOS 15.8) : `Touch.radiusX`/`radiusY` (extension
  WebKit du `Touch` standard) sont bien de la vraie géométrie de contact, pas
  une constante — doigt ≈ 20 px de rayon, paume ≈ 73 px. Un écart net (>3×),
  largement suffisant pour distinguer les deux de façon fiable.
  - **`src/shell/palmRejection.ts`, `installPalmRejection()`** — un seul
    écouteur `touchstart` posé sur `document` en phase de capture
    (`{capture: true, passive: false}`, nécessaire pour `preventDefault()`),
    appelé une fois au démarrage (`main.tsx`, à côté de
    `registerServiceWorker()`). `PALM_RADIUS_PX = 50` : à mi-chemin entre les
    deux mesures, penché côté paume plutôt que côté doigt — mieux vaut
    laisser passer une paume occasionnelle que bloquer un vrai tap d'enfant.
    Un seul nombre à retoucher si l'usage réel montre l'inverse.
  - **Pourquoi `changedTouches`, pas `touches`, résout le cas réel sans
    complexité multi-touch** : le scénario rapporté est une paume *déjà
    posée* pendant que l'enfant vise ensuite du doigt — au moment du
    `touchstart` du doigt, la paume est un toucher *en cours*, absente de
    `event.changedTouches` (qui ne contient que les touchers qui démarrent
    dans cet événement précis). Le doigt est donc évalué seul, jamais
    contaminé par la paume à côté de lui ; c'est la paume elle-même, au
    moment où *elle* se pose, qui déclenche son propre `touchstart` et se
    fait bloquer alors. Pas besoin de « choisir le toucher au plus petit
    rayon parmi plusieurs » — l'idée initialement envisagée avant la
    mesure — puisque `TouchEvent.preventDefault()` s'applique à tout
    l'événement et ne peut de toute façon pas cibler un seul point parmi
    plusieurs touchers simultanés.
  - **`<input>`/`<textarea>` explicitement exemptés** (`isTextInput`,
    `target.closest('input, textarea')`) — un `preventDefault()` sur un champ
    de saisie bloquerait le clavier iPadOS, le même piège que
    `user-select: none` déjà documenté (spec 02, plus haut). Dégrade en
    silence si `radiusX`/`radiusY` sont absents (navigateur sans cette
    extension) : jamais de rejet plutôt qu'un rejet mal informé.
  - **Panneau de diagnostic gardé pour l'instant** (`players/PlayerListScreen.tsx`,
    `TouchDiagnostics`, écran Joueurs) plutôt que retiré tout de suite : comme
    il écoute en phase bulle sur `document`, un toucher que
    `installPalmRejection` bloque (capture + `stopPropagation`) n'atteint
    plus jamais son écouteur — le panneau sert donc aussi de vérification
    après coup (une paume qui n'apparaît plus dans le diagnostic = bien
    rejetée). À retirer une fois confirmé sur l'appareil réel.
  - **Premier essai sur l'iPad réel : régression, pas une amélioration** — le
    seuil de 50 px a bloqué de vrais taps du doigt (« un vrai tap du doigt
    est bloqué à tort », retour direct de l'utilisateur), pas seulement des
    paumes. Le seul échantillon de doigt mesuré (20 px, un tap posé
    volontairement pour le diagnostic) ne représente visiblement pas toute la
    variance réelle d'un tap d'enfant en train de jouer — vitesse, angle,
    pression tout autres. Piste explorée puis abandonnée : ajouter
    `touchmove`/`touchend` en plus de `touchstart` pour rattraper une
    géométrie de contact pas encore stabilisée — revert immédiat sans même
    être testée sur l'appareil, parce qu'elle ne fait qu'ajouter des
    occasions supplémentaires de faux positif sans donnée pour la justifier,
    dans un sens qu'on sait déjà être le mauvais (trop de rejet, pas trop
    peu). Piste explorée puis écartée par le raisonnement seul (donc jamais
    codée) : n'évaluer le rayon que quand `event.touches.length > 1` (au
    moins un autre toucher déjà actif) pour ne jamais rejeter un tap seul —
    séduisant, mais la paume qui se pose *en premier* est elle-même seule à
    l'instant où elle touche l'écran, donc ce garde-fou l'aurait laissée
    passer systématiquement : il aurait supprimé la régression en
    supprimant la fonctionnalité.
  - **Hypothèse non vérifiée, plus probable que « seuil mal calé »** : la
    plainte initiale (« la paume touche l'écran, donc il ne peut plus appuyer
    sur les jeux ») décrit peut-être une *suppression* du tap par WebKit
    lui-même en présence de multi-touch (la synthèse de `click` à partir de
    `touchend` peut ne pas se déclencher du tout quand plusieurs touchers
    sont actifs simultanément, sur certaines versions), pas des clics
    accidentels de la paume. Si c'est le cas, `installPalmRejection` — qui ne
    fait qu'empêcher la paume de déclencher *son propre* clic — ne
    s'attaquait pas au bon problème depuis le début, et le vrai correctif
    demanderait de contourner la synthèse de clic native (gérer `touchend`
    directement sur les éléments interactifs plutôt que compter sur
    `onClick`) — un chantier bien plus large, pas entrepris tant que
    l'hypothèse n'est pas confirmée.
  - **Décision : interrupteur de secours plutôt qu'un nouveau réglage de
    seuil deviné.** `settings.palmRejectionEnabled` (`storage.ts`), lu/écrit
    comme `soundEnabled` (`fx/sound.ts`) — variable de module mise à jour par
    le setter, pas reparsée à chaque toucher. **Désactivé par défaut**
    (absent ⇒ `false`) : tant que le diagnostic n'est pas terminé, un enfant
    qui ne peut plus jouer du tout est pire que l'absence de rejet de la
    paume. Bouton texte dédié sur l'écran Joueurs
    (`PlayerListScreen.tsx`, `PalmRejectionToggle`, à côté de
    `TouchDiagnostics`) pour l'activer/tester sans avoir à redéployer.
    `installPalmRejection()` pose l'écouteur inconditionnellement au
    démarrage ; c'est `handleTouchStart` qui vérifie le drapeau à chaque
    appel, pour que le bouton prenne effet immédiatement, sans recharger la
    page.
  - **Test des dix taps, fait, résultat rassurant** : bouton activé, les
    dix taps sont tous apparus dans le panneau de diagnostic (aucun manquant),
    rayon mesuré entre 20 et 42 px selon les taps — confirme que le seuil de
    50 px ne bloque pas un tap seul, même avec une marge de variation
    naturelle correcte (42 reste net en dessous de 50). Le tout premier
    retour (« un vrai tap est bloqué à tort ») date très probablement d'avant
    l'ajout de l'interrupteur — à ce moment-là le rejet tournait
    inconditionnellement, sans moyen de le couper pour comparer proprement.
  - **Confirmé en vraie partie, avec la paume posée à côté** — l'utilisateur
    a rejoué avec l'interrupteur activé, paume posée pour reproduire le
    problème d'origine : ça fonctionne. `PALM_RADIUS_PX = 50` reste tel quel.
    `palmRejectionEnabled` passé à **activé par défaut** (`?? true`,
    `palmRejection.ts` et `storage.ts`) — plus la peine que chaque famille le
    découvre et l'active à la main. L'interrupteur reste sur l'écran Joueurs
    comme filet de sécurité (un autre appareil pourrait mesurer la géométrie
    de contact différemment), mais `TouchDiagnostics` (le panneau de mesure)
    est retiré — son rôle s'arrêtait au diagnostic, maintenant terminé.

## Clavier décalé en paysage (2026-09-10, observation non vérifiée)

Rapporté par l'utilisateur en testant l'**app installée sur l'écran d'accueil**
(pas un onglet Safari — écarte l'explication la plus simple, le verrouillage
portrait du manifest ne s'applique de toute façon qu'à l'app installée).
Le clavier iPadOS « n'est pas à la bonne place » quand l'app se retrouve en
paysage. Hypothèse la plus probable, pas encore confirmée : le *contenu* de
la page reste verrouillé en portrait (le manifest fait son travail pour la
mise en page), mais le *clavier logiciel* — un élément d'interface système,
pas du DOM — se positionne d'après l'orientation physique réelle de
l'appareil plutôt que d'après l'orientation verrouillée de la page,
produisant un décalage. Pas creusé davantage dans cette session : interaction
rare et ponctuelle (un adulte qui tape un prénom à la création d'un profil),
sans commune mesure avec l'urgence du rejet de la paume (qui touche chaque
tap de chaque partie). Question restée sans réponse, à poser en priorité à la
prochaine session si ça revient : la mise en page elle-même tourne-t-elle en
paysage (photos/boutons de travers), ou seulement le clavier semble décalé
pendant que le reste de l'écran reste en portrait ?

## Mémoire sonore ajoutée (2026-09-10)

Quatrième jeu, premier solo (Simon/mémoire de séquence) : un pad lumineux et
sonore par couleur, une séquence à répéter, difficulté = nombre de pads
(2/4/6/8). Contrairement aux trois précédents, aucun adversaire (réel ou
artificiel) — le contrat `GameModule` n'avait encore jamais été poussé dans
cette direction.

- **Où choisir le nombre de pads vs. le rythme — deux mécanismes différents,
  décidé explicitement avec l'utilisateur** (voir « Process établi »
  ci-dessous) : le nombre de pads (2/4/6/8) est une phase interne au jeu
  (`SoundMemoryState.phase === 'setup'`, premier écran du `Board`), zéro
  changement du shell. Le rythme (lent/normal/rapide/très rapide), en
  revanche, réutilise explicitement le sélecteur « NIVEAU » existant
  (`PlayerPickScreen`, la même rangée d'icônes œuf/poussin/poule/coq que les
  jeux à bot) — demandé tel quel par l'utilisateur plutôt que construit en
  interne au jeu comme le nombre de pads.
- **`GameMeta.soloLevels?: BotLevel[]` — nouvelle extension additive du
  contrat**, parallèle à `bot.levels` mais sans adversaire : `PlayerPickScreen`
  affiche le même sélecteur « NIVEAU » dès que ce champ existe, indépendamment
  de `game.bot` (qui reste réservé aux vrais adversaires — mode « contre
  l'ordinateur », `chooseMove`). Le niveau choisi est transmis à
  `createState(players, seed, options?: { level? })` — 3ᵉ paramètre optionnel
  ajouté au contrat, invisible pour les trois jeux existants (une fonction à
  2 paramètres reste assignable à un type qui en accepte 3, TypeScript
  n'exige pas que l'implémentation déclare le paramètre facultatif qu'elle
  ignore).
- **`Result.score` sur `kind: 'win'`, pas un troisième `kind: 'score'`** :
  premier essai (un vrai troisième membre d'union) cassait la compilation de
  `tictactoe/bot.ts`, `chess-race/bot.ts` et les trois fichiers `bot.test.ts`
  existants — tous accèdent à `result.winner` après avoir seulement exclu
  `kind === 'draw'`, ce qui suffisait tant que `win`/`draw` étaient les deux
  seuls membres. Élargir l'union cassait ce raisonnement partout où il
  apparaissait. Fix : garder exactement les deux `kind` d'origine, et ajouter
  un champ `score?: { value; variant? }` facultatif sur `win` — `winner`
  désigne alors simplement le joueur dont c'est le score, pas un gagnant au
  sens propre. Zéro fichier des trois autres jeux à toucher. Passer par un
  vrai build (`tsc -b`, pas seulement `tsc --noEmit` qui n'a pas les mêmes
  réglages de projet) a été nécessaire pour voir l'erreur — leçon pour une
  future extension du contrat : vérifier avec la même commande que
  `npm run build`.
- **Palmarès (`storage.ts`, clé `scores`)** : un entier par
  `${gameId}:${playerId}:${variant}`, jamais un historique de parties —
  tranche le point resté ouvert depuis la phase 1 (ARCHITECTURE.md §10).
  `variant` (ex. `pads-4`) garde un record séparé par nombre de pads, décidé
  explicitement par l'utilisateur (« un max par difficulté ») : un score à
  8 pads n'a pas le même sens qu'à 2 pads. Calculé et écrit par `App.tsx`
  (générique, `computeScoreInfo`), jamais par `sound-memory/logic.ts` — la
  règle « un seul module accède à localStorage » et la pureté de `logic.ts`
  interdisaient toutes les deux d'y lire/écrire le record directement.
- **Séquence : un `useEffect` gardé par référence, pas par un flag manuel** —
  `Board.tsx` relance son détail de timers (lecture de la séquence) sur
  `[state.sequence, state.rhythmMs]`. `state.sequence` ne change de référence
  exactement que lorsqu'une nouvelle manche démarre (`setPadCount` ou manche
  réussie dans `logic.ts`) ; un tap correct qui ne termine pas la manche, ou
  `sequenceShown`, renvoient le même tableau. Pas besoin d'un ref
  `shownForRound` pour éviter un rejeu : la dépendance elle-même ne change
  que quand on veut vraiment rejouer. `onMove` volontairement absent des
  dépendances (recréé à chaque rendu du shell, `GameScreen.tsx`) — l'inclure
  aurait fait repartir l'animation en plein milieu de la lecture à chaque
  rendu parent, malgré la garde de `state.phase`.
- **`lastTap` sur `SoundMemoryState`** : même patron que `Connect4State.lastMove`
  — surligne le pad fautif en phase `gameover` (anneau orange), posé sur
  *chaque* tap (correct ou non), lu par `Board.tsx` seulement quand
  `phase === 'gameover'`.
- **Le son du pad est joué deux fois côté humain (tap + écho générique
  `move` du shell), accepté tel quel** — même compromis déjà documenté pour
  morpion/tour (« move et turn sonnent toujours ensemble »). Le son
  spécifique au pad (`fx/sound.ts`, `playPadTone`, une note fixe par pad,
  gamme do→do) est joué directement par `Board.tsx` au tap et à la lecture ;
  le clic générique du shell (`GameScreen`, sur tout coup non terminal) joue
  par-dessus. Pas de son de « faute » séparé ajouté : le son `draw` déjà
  joué par le shell sur tout résultat non-`win` sonne comme un buzz
  descendant, suffisant comme signal de fin de manche.
- **Testé en navigateur** (Chrome, viewport redimensionné, pas encore sur
  iPad/iPhone réels) : cycle complet setup → lecture → manche réussie
  (score 1, préfixe de séquence conservé) → mauvais tap → écran de résultat
  avec « Nouveau record ! » et confettis (couleur du joueur) ; rejoué ensuite
  avec un nombre de pads différent (2 au lieu de 4) pour confirmer que le
  record est bien séparé par `variant` (« Meilleur score : 0 », pas 1, sur
  la nouvelle difficulté). `npm test`, `npm run lint` et `npm run build`
  passent tous les trois.

**Cases tactiles sur grille dense — motif réutilisable.** Premier jet :
un bouton par trou, 7×6 = 42 boutons. Sur iPhone (plateau contraint à
~352 px de large par le carré que `GameScreen` réserve, voir §4
`ARCHITECTURE.md`), ça descendait à ~42 px de côté — sous le minimum de
44 px documenté dans `CLAUDE.md`, et une case *carrée* de cette taille est
un mauvais objectif pour un enfant qui vise mal (peu de tolérance dans les
deux axes à la fois). Fix : séparer le rendu (grille décorative, `aria-hidden`,
inchangée) de l'interaction (une seule grille de boutons superposée, un par
*colonne*, `gridRow: '1 / -1'` — pleine hauteur du plateau). Largeur de case
inchangée (~42-45 px, toujours sous 80 px mais au-dessus du plancher Apple),
hauteur ~540 px — un enfant qui vise à peu près la bonne colonne, n'importe
où verticalement, touche. Un futur jeu à grille dense où le regroupement
naturel du coup est par ligne ou colonne (pas case par case) devrait
envisager le même découplage rendu/interaction dès le départ plutôt que d'en
faire un correctif après coup.

## Spec 05 — Socle musical, calibration, premier jeu de rythme (2026-09-10)

Ouverture de la partie « musique » : socle audio (`src/solfege/`), calibration
du décalage tactile, premier jeu de rythme (« Tape avec moi »). Code livré,
tests/build/lint verts, **pas encore testé sur iPad réel** — voir « Ce qui
reste à vérifier sur l'appareil » plus bas.

- **Propriété unique de l'`AudioContext` extraite** (`src/fx/audio-context.ts`) :
  ZzFX (`vendor/zzfx.js`, déjà modifié en spec 03 pour la création paresseuse)
  perd sa propre logique de contexte et importe `getAudioContext()` — une
  vendorisation modifiée un peu plus, documentée dans `vendor/LICENSES.md`
  comme les fois précédentes. `fx/sound.ts` appelle directement
  `unlockAudioContext()` au lieu de `zzfxUnlock()` (retiré du fichier
  vendorisé). Nécessaire pour que le moteur musical partage la même horloge
  que les effets sonores, sans quoi une seconde horloge dériverait de la
  première sur une session longue.
- **Lire l'horloge du tap de façon synchrone dans le gestionnaire tactile,
  jamais `performance.now()`** — décision structurante de toute la
  calibration et du jeu de rythme. Corréler `performance.now()` (horodatage
  du `TouchEvent`) avec `AudioContext.currentTime` (horloge de lecture)
  aurait demandé un ancrage entre deux horloges différentes, source d'erreur
  supplémentaire. En lisant `getAudioContext().currentTime` directement dans
  le handler (`solfege/audio.ts`, `audioNow()`), le seul biais qui reste est
  la latence constante du geste tactile lui-même — exactement ce que la
  calibration mesure et soustrait. Les deux (calibration et jeu) utilisent
  la même technique, donc le même biais s'annule des deux côtés.
- **`onTouchStart`, pas `onClick`/`onPointerDown`, pour le tap réel** — deux
  raisons : `click` est synthétisé après `touchend` (jitter de plusieurs
  dizaines de ms, inacceptable pour classer un tap avance/à l'heure/retard),
  et `palmRejection.ts` (spec 04) bloque une paume en phase *capture* sur
  `touchstart` avec `stopPropagation()` — seul un écouteur `touchstart` en
  phase bulle (React `onTouchStart`) en bénéficie. `onPointerDown` reste
  branché en secours, filtré sur `pointerType === 'mouse'`, pour pouvoir
  tester au clavier/souris en navigateur sans compter double sur iOS.
- **Ordonnanceur à lookahead scindé en deux couches, pour rester testable
  sans navigateur** (critère de la spec) : `solfege/schedule.ts` porte le
  calcul pur des instants (`scheduleMelody`, `scheduleBeats`) et un
  `LookaheadScheduler` générique dont l'horloge (`clock.now()`) et
  l'émission (`onEvent`) sont injectables — les tests lui donnent un
  compteur simulé, jamais un vrai `AudioContext`. `solfege/audio.ts` (non
  testé, volontairement mince) ne fait que brancher ces deux fonctions sur
  `getAudioContext().currentTime` et de vrais oscillateurs.
- **Fuite corrigée avant même le premier test navigateur** : le timer de
  l'ordonnanceur (`setInterval`) et l'écouteur `visibilitychange` ne
  s'arrêtaient que si l'appelant pensait à appeler `stop()` — une fin
  naturelle de lecture (`onDone`) ne le faisait pas d'elle-même. Fix :
  `playMelody`/`playClickTrack` s'auto-arrêtent dans leur propre callback
  `onDone`, en plus du nettoyage fait par l'appelant (Board, CalibrationScreen)
  à son démontage — le module reste correct par lui-même, sans dépendre de
  la discipline de l'appelant.
- **Calibration : médiane des écarts sur 8 taps, 2 premiers ignorés,
  dispersion (MAD) rejetée sans jamais dire « échec »** — `computeCalibration`
  (pur, testé) reçoit des paires `{expectedTime, actualTime}` dans la même
  base de temps (secondes audio) et renvoie soit `{ok:true, offsetMs}` soit
  `{ok:false}` ; rien n'est stocké dans ce second cas, l'écran repropose un
  tour (« On refait un tour »), jamais un message d'erreur. Persisté via
  `storage/index.ts` (`Settings.calibrationOffsetMs`), propriété de
  l'appareil — deux points d'entrée (`solfege/CalibrationScreen.tsx`) :
  bouton dans `PlayerListScreen` (nouvel écran `App.tsx`, `{kind:
  'calibration'}`) et phase interne à `rhythm-tap/Board.tsx` (gate local,
  pas dans `RhythmTapState` — la calibration n'est pas une notion de partie,
  `logic.ts` n'en sait rien).
- **`RhythmTapState.phase`, `'ready' | 'playing' | 'done'`, le
  redémarrage après arrière-plan est une transition d'état pure, pas un
  correctif d'affichage** — sur `visibilitychange` → `hidden`, le moteur
  arrête proprement la lecture (`onInterrupted`) et `Board.tsx` envoie
  `{type:'restart'}`, qui ramène `logic.ts` en phase `'ready'` (claimedBeats
  remis à zéro). Recommandé explicitement par la relecture avant
  implémentation : garder ce redémarrage dans le contrat pur (`applyMove`)
  plutôt qu'un état local de `Board` évite toute divergence entre ce que
  l'écran montre et ce que la manche a réellement enregistré.
- **Tolérance fixe en fraction de temps, pas un paramètre par niveau** —
  `GOOD_TOLERANCE_BEATS = 0.22` (temps, pas ms) devient mécaniquement plus
  stricte en millisecondes à mesure que le tempo augmente, ce qui réalise
  « généreuse, et resserrée avec le niveau » sans code supplémentaire.
- **`Result.score.variant` inclut la mélodie, pas seulement le tempo**
  (`` `tempo${tempoLevel}-${melodyId}` ``) : la mélodie est tirée du seed à
  chaque partie (4 airs, longueurs différentes — 26 à 32 temps), donc deux
  scores au même tempo mais sur des mélodies différentes n'ont pas le même
  score maximal possible. Même philosophie que `pads-N` pour la mémoire
  sonore, juste une clé composée cette fois.
- **Mélodies re-voicées pour tenir dans une seule octave** (do→si, sans note
  sous le do ni au-dessus du si) : le motif « Ding, ding, dong » de « Frère
  Jacques » descend d'ordinaire vers un sol *sous* le do tonique — remonté
  d'une quinte plutôt qu'abaissé d'une quarte pour rester dans l'octave
  disponible. Acceptable : le jeu de rythme ne se sert que du nombre et de
  la durée des temps, pas de la justesse note à note (hors périmètre de
  cette spec — oreille, hauteur nommée).
- **Regroupement du menu, entièrement local à `MenuScreen`** :
  `GameMeta.groupId` + `GAME_GROUPS` (`registry.ts`) ; `MenuScreen` garde un
  `useState<string | null>` pour le sous-menu ouvert, aucun ajout à `Screen`
  dans `App.tsx`. Un `GameTile` extrait est réutilisé à l'identique pour les
  jeux à plat et les jeux d'un sous-menu — vérifié que les 4 jeux existants
  (sans `groupId`) s'affichent pixel pour pixel comme avant.
- **Icônes maison, pas vendorisées** (`shell/music-group-icon.svg`,
  `rhythm-tap/icon.svg`) — même geste que les premières icônes de niveau de
  la course des poussins avant leur remplacement par les GIF Flaticon : deux
  formes simples (double croche liée, pulsation concentrique), aucune
  licence à documenter puisque rien n'est emprunté.

**Piège de session — le temps réel qui passe entre deux appels d'outil fausse
un diagnostic de timing audio.** En testant « Tape avec moi » par automatisation
du navigateur, une manche semblait se terminer en moins d'une seconde avec un
score de 0 — panique légitime (30 s de mélodie ne peuvent pas finir en moins
d'une seconde). Deux heures de fausses pistes (horloge gelée, double montage
React, service worker d'un tout autre projet servi par erreur sur le port de
preview réutilisé) avant la vraie explication : le temps réel écoulé entre
deux appels d'outil (lecture des logs, rédaction du prochain appel) n'a aucun
rapport avec les délais `wait` explicitement demandés — la mélodie, elle,
continue de jouer pour de vrai dans l'onglet pendant tout ce temps « invisible ».
Confirmé en ajoutant un log dans `applyMove` : un seul `{type:'start'}` suivi,
bien plus tard que prévu, d'un `{type:'melodyDone'}` légitime. Leçon pour une
future session qui testerait un minutage audio par automatisation : soit
enchaîner les taps dans un seul `browser_batch` sans pause de réflexion entre
eux, soit accepter que seul un humain sur l'appareil réel peut juger un
minutage à l'oreille — l'automatisation prouve la structure (états, rendu),
pas la précision temporelle.

**Ce qui reste à vérifier sur l'appareil réel avant de committer** (voir
critères d'acceptation 7 à 9 de la spec) : absence de dérive audible sur une
mélodie de 30 s, premier son non avalé, comportement après un vrai passage en
arrière-plan iOS (pas seulement l'événement `visibilitychange` simulé), et
persistance de la calibration après un redémarrage complet de l'app. Rien de
tout ça n'est vérifiable en navigateur de bureau ; c'est le sens même de ces
critères.

## Spec 05, retour de test iPad réel (2026-09-11) : compte à rebours, métronome

Premier vrai test avec l'enfant : ça fonctionne, trois améliorations
demandées — un compte à rebours avant la calibration, un compte à rebours au
même tempo avant chaque chanson, et un meilleur repère visuel du temps
pendant qu'on tape (deux pistes proposées : défilement horizontal façon jeu
de rythme, ou métronome ; **métronome retenu**, plus léger sur l'iPad Air 2
(2 Go de RAM, A8X) qu'une animation continue de plusieurs repères).

- **Le compte à rebours réutilise `playClickTrack` telle quelle** — c'est
  déjà exactement « N temps, un bip, onBeat, onDone » ; pas de nouvelle
  fonction moteur. Calibration : `start()` enchaîne un `playClickTrack` de 4
  temps (`COUNT_IN_BEATS`) dont le `onDone` déclenche le `playClickTrack` de
  8 temps déjà existant (mesure réelle). `rhythm-tap/Board.tsx` : même
  patron, le `onDone` du compte à rebours déclenche `playMelody`. Aucun
  changement à `RhythmTapState`/`logic.ts` — le compte à rebours est un
  aller simple purement côté Board (`countingIn`, état local), les taps
  reçus pendant restent simplement ignorés (`handleTap` retourne tôt), sans
  qu'`isValidMove`/`applyMove` aient besoin de le savoir.
- **`playClickTrack` gagne un `onInterrupted` optionnel**, par symétrie avec
  `playMelody` — jusqu'ici un passage en arrière-plan pendant la calibration
  se contentait d'arrêter le clic sans le dire à l'écran, qui restait bloqué
  sur « Suis le rythme… ». Corrigé au passage : `CalibrationScreen` revient
  à `'intro'` (pas `'retry'` — ce n'est pas une mesure ratée, juste
  interrompue) ; `rhythm-tap/Board.tsx` envoie `{type:'restart'}` comme pour
  une interruption pendant la vraie mélodie, même chemin de code que ce soit
  le compte à rebours ou la chanson qui est coupée.
- **`solfege/Metronome.tsx` + `solfege/pendulum.ts`** (calcul de l'angle,
  pur, testé) : un pendule qui atteint une extrémité *exactement* à chaque
  temps (`cos` de la phase, jamais une approximation), piloté par
  `requestAnimationFrame` + mutation DOM directe (pas de `setState` par
  frame) — même patron que `shell/GameScreen.tsx` (`ExitButton`). Son
  `referenceTime` est toujours `PlaybackHandle.startTime` de la lecture en
  cours (compte à rebours ou mélodie), jamais un instant approximatif pris
  au montage — le pendule reste en phase avec le son réel même si le
  composant se remonte.
- **Piège de nommage Windows** : `Metronome.tsx` (composant) et
  `metronome.ts` (calcul pur) ne différaient que par la casse — invisible en
  `ls` sur ce système de fichiers, mais TypeScript refuse de compiler
  (`TS1261`/`TS1149`, portabilité vers un système de fichiers insensible à
  la casse). Renommé le fichier pur en `pendulum.ts` (nom de sa fonction,
  `pendulumAngle`) plutôt que de contourner l'avertissement.
- **Le métronome tourne aussi pendant la vraie mélodie**, pas seulement le
  compte à rebours — superposé au tapis de jeu (`pointer-events-none`, les
  taps traversent jusqu'au bouton), qui garde son flash de couleur bien/à
  côté par-dessous. `referenceTime` bascule de l'instant de départ du compte
  à rebours à celui de la mélodie une fois celle-ci lancée (`startMelody`,
  dans le `onDone` du compte à rebours) — le pendule ne saute jamais
  visuellement puisque les deux tournent au même tempo, seule la référence
  de phase change en interne.
- **Calibration : le métronome remplace le disque uniquement pendant le
  compte à rebours**, pas pendant la mesure des 8 temps — le disque reste le
  seul point de tap (mesure réelle), déjà validé sur l'iPad ; pas de raison
  de retoucher ce qui marche pour une demande qui portait sur « Tape avec
  moi ».
- **Testé au navigateur (build de production, pas le serveur de dev)** :
  compte à rebours visible et animé dans les deux écrans, transition propre
  vers la mesure/la mélodie, aucune erreur console, `npm run
  build`/`test`/`lint` verts (122 tests, +5 pour `pendulum.ts`). Précision
  du minutage réel non re-testable par automatisation, pour la raison déjà
  documentée plus haut (le temps qui passe entre deux appels d'outil).

**Correctif immédiat : le pendule seul ne suffisait pas, retour utilisateur
après ce premier essai** — « je n'ai pas le compte à rebours 3-2-1 au rythme
de tape avant le début de l'exercice ». Le pendule cadençait bien le compte à
rebours, mais sans repère chiffré un enfant ne « voit » pas le décompte.
Corrigé : `COUNT_IN_BEATS` passé de 4 à 3 (pour matcher « 3, 2, 1 » à la
lettre), le pendule ne s'affiche plus que pendant la vraie mélodie/la vraie
mesure ; le compte à rebours affiche maintenant un grand chiffre qui
apparaît en sursaut sur chaque temps (`onBeat` de `playClickTrack`, déjà
disponible, juste ignoré jusque-là), via une nouvelle animation Tailwind
(`count-in-pulse`, `key={countInNumber}` pour la rejouer à chaque chiffre —
même patron que le flash de retour de `rhythm-tap/Board.tsx`). Vérifié au
navigateur : « 3 » puis « 2 » bien capturés en écran, dans les deux points
d'entrée (calibration et « Tape avec moi »). Leçon retenue : un repère
rythmique abstrait (pendule) ne remplace pas un repère explicite (chiffres)
pour un compte à rebours — les deux ont leur rôle, mais pas pour la même
phase (chiffres pour « dans combien de temps ça commence », pendule pour
« cadence le temps pendant que ça joue »).

**Deuxième correctif immédiat : le silence entre « 1 » et le premier son
était faux** — retour utilisateur, « l'écart entre 1 et le début de la
chanson est faux, ajoute un 0 invisible qui coïncide avec la première note
du jeu ». Cause réelle : `startMelody()`/`beginMeasurement()` appelaient
`playMelody`/`playClickTrack` sans argument de départ, qui retombaient donc
sur leur propre `LEAD_IN_SEC` (0,4 s) — une **deuxième** pause, sans rapport
avec la grille du compte à rebours qui venait de jouer, juste après elle.
Le compte à rebours et la vraie mélodie/mesure jouaient chacun leur propre
rythme, avec un blanc entre les deux plutôt qu'un enchaînement.
- **Fix : `playMelody`/`playClickTrack` acceptent maintenant un `startAt`
  optionnel** (dernier paramètre) — l'appelant calcule la case suivante de
  la grille déjà en cours (`countIn.startTime + COUNT_IN_BEATS *
  countIn.secPerBeat`, exactement où un 4ᵉ temps — le « 0 » invisible que
  l'utilisateur demandait — serait tombé) au lieu de laisser le module
  reposer un nouveau `LEAD_IN_SEC`. Omis (cas normal, premier son d'un
  écran), le comportement précédent reste inchangé. Même correctif appliqué
  aux deux endroits : `rhythm-tap/Board.tsx` (compte à rebours → mélodie) et
  `CalibrationScreen.tsx` (compte à rebours → mesure des 8 temps) — la même
  cause existait aux deux endroits, seul le premier avait été signalé.
- **Pas de « 0 » réellement affiché/joué** : l'utilisateur demandait un 0
  « invisible » qui coïncide avec la première note — interprété littéralement
  comme une continuité de grille plutôt qu'un vrai 4ᵉ clic silencieux. La
  première note de la chanson (ou le premier temps mesuré) occupe elle-même
  cet emplacement ; rien à jouer ni afficher en plus.
- Vérifié : `npm run build`/`test`/`lint` verts (122 tests, inchangé — pas de
  nouvelle branche pure à tester, l'arithmétique de continuité est un
  one-liner dupliqué deux fois plutôt qu'une abstraction, cohérent avec
  CLAUDE.md sur ce genre de duplication minime). Écart audible non
  re-testable par automatisation (même limite déjà documentée) — à confirmer
  à l'oreille sur l'appareil réel.

## Spec 05, retour de test iPad réel (2026-09-11, suite) : défilement, score en %

« Beaucoup mieux » sur le compte à rebours et la continuité, mais deux
demandes de plus : le pendule est difficile à suivre pour certains — donner
le choix entre pendule et défilement horizontal (jusque-là seulement proposé
comme option, jamais construit — spec 05 avait tranché pour le pendule seul
au premier tour) ; le score en pourcentage plutôt qu'en nombre brut.

- **`solfege/ScrollingBeats.tsx` + `solfege/scrollPosition.ts`** (calcul de
  position, pur, testé) : un couloir horizontal, une ligne de frappe fixe
  près du bord gauche (14 %), chaque temps de la mélodie apparaît à droite
  `LOOKAHEAD_BEATS` (4) temps à l'avance et glisse linéairement jusqu'à
  tomber pile sur la ligne à son instant prévu — puis continue au-delà,
  jamais figé. Piloté par `requestAnimationFrame` + mutation directe de
  `style.left` sur chaque repère (jusqu'à 32, un par temps de la mélodie),
  pas de `setState` par frame — même patron que `Metronome.tsx`. Le repère
  se colore (orange) une fois son temps réclamé (`claimedBeats[i]`), sinon
  reste crème discret — jamais de croix, cohérent avec le reste du jeu.
- **Le couloir remplace la rangée de points de progression, ne s'ajoute pas
  à elle** — les deux racontent la même chose (quels temps sont réclamés),
  superposer aurait été redondant. Le pendule, lui, reste dans le tapis de
  jeu (zone de tap) : en mode défilement, le tapis n'affiche plus que le
  flash de couleur au tap, le couloir au-dessus suffit comme repère
  d'anticipation.
- **`solfege/visualization.ts`** : choix persisté comme la calibration
  (`storage/index.ts`, `Settings.rhythmVisualization`, absent ⇒ `'metronome'`
  — comportement d'origine inchangé pour qui ne touche jamais ce réglage).
  Sélecteur à deux boutons, initialement posé dans `PlayerListScreen.tsx`
  à côté du bouton de calibration — **déplacé depuis vers l'écran « Qui
  joue ? », voir plus bas**. `rhythm-tap/Board.tsx` le lit une fois à
  l'ouverture du jeu (`useState(() => getRhythmVisualization())`), comme
  `calibrated` — une propriété d'appareil, pas quelque chose qui doit
  changer en cours de partie.
- **Score en pourcentage : extension additive de `Result.score`**
  (`maxValue?: number`), pas un changement de `ScoreInfo`/`ResultScreen`
  local à rhythm-tap. `rhythm-tap/logic.ts` renseigne
  `maxValue: state.totalBeats` ; `App.tsx` (`computeScoreInfo`) le
  transmet tel quel sans savoir ce qu'il représente ; `ResultScreen.tsx`
  affiche `value/maxValue` arrondi et suivi de « % » **seulement** si
  `maxValue` est présent, sinon le nombre brut comme avant — la mémoire
  sonore (pas de plafond naturel à sa séquence qui grandit) n'est pas
  concernée et continue d'afficher un nombre. Même patron que `variant`
  (`games/types.ts`) : le shell reste générique, chaque jeu choisit s'il a
  un maximum qui a du sens.
- **Testé au navigateur (build de production)** : bascule pendule ↔
  défilement visible et persistée, couloir animé (repère observé en
  mouvement entre deux captures, franchissant la ligne de frappe), manche
  complète jusqu'au résultat avec « Score : 6 % » / « Meilleur score : 6 % »
  affichés correctement, aucune erreur console. `npm run build`/`test`/`lint`
  verts (126 tests, +4 pour `scrollPosition.ts`).

## Spec 05, retour de test iPad réel (2026-09-11, suite 2) : le choix pendule/défilement quitte l'écran Joueurs

Retour : enterrer le choix pendule/défilement dans l'écran Joueurs (réglages)
« va nuire à l'apprentissage » — il doit vivre au moment de jouer, pas dans
un menu séparé qu'un enfant ne pense pas à ouvrir.

- **Pas touché à l'état du jeu.** `solfege/visualization.ts` (get/set,
  stockage `Settings.rhythmVisualization`) reste identique ; `Board.tsx` le
  lit toujours une fois à l'ouverture (`useState(() => getRhythmVisualization())`).
  Seul l'endroit qui *appelle* le setter change — un problème de placement
  d'écran, pas de modélisation. Éviter la tentation de faire remonter ce
  choix par `createState`/`RhythmTapState` (comme `tempoBpm`) : `tempoBpm`
  doit être figé pour planifier l'audio, le repère visuel n'a besoin d'être
  su qu'au moment où `Board` monte.
- **Nouveau champ additif générique : `GameMeta.visualPreference`**
  (`games/types.ts`) — `{ options: {id, label, icon}[], get(), set(id) }`.
  Même famille que `soloLevels`/`colorLabels`/`groupId` : le shell
  (`shell/PlayerPickScreen.tsx`) affiche les icônes et appelle `set` au tap,
  sans savoir ce que chaque `id` signifie ni où `get`/`set` rangent la
  valeur — c'est le jeu qui fournit sa propre persistance
  (`rhythm-tap/index.ts` branche ça sur `getRhythmVisualization`/
  `setRhythmVisualization`). Rendu comme la rangée NIVEAU juste en dessous,
  avec un état local (`visualChoice`) pour que l'anneau de sélection change
  au tap sans attendre un nouveau rendu ailleurs.
- **`PlayerListScreen.tsx`** : `VisualizationChoice` retiré entièrement
  (plus aucun jeu ne pose de réglage à cet endroit) ; le bouton de
  calibration et le rejet de la paume restent — ce sont de vrais réglages
  d'appareil qu'on ne règle pas à chaque partie, contrairement au repère
  visuel.
- **Tient sur iPhone (375×812, vérifié)** : avec deux profils et la rangée
  NIVEAU (rhythm-tap n'a pas de mode « contre l'ordinateur », donc pas de
  sélecteur famille/ordinateur en plus), le nouvel écran « Qui joue ? »
  tient sans coupure ni scroll — testé via un iframe 375×812 injecté dans
  la page (le `resize_window` de l'outil de navigation ne redimensionnait
  pas réellement la fenêtre dans cet environnement).
- **Testé au navigateur (build de production)** : tap sur une icône change
  l'anneau immédiatement, `localStorage.settings.rhythmVisualization`
  confirmé à `"scroll"` après le tap, persiste après retour au menu.
  `npx tsc -b`, `npm test` (126 tests), `npm run build`, `npm run lint`
  tous verts ; dossiers des quatre jeux existants inchangés
  (`git status --porcelain`) ; toujours une seule instance d'`AudioContext`
  (`fx/audio-context.ts`).

## Nouveau jeu en cours : Mémoire musicale (note-memory) — logique posée, en attente des sons réels (2026-09-11)

Cinquième jeu du groupe « Musique » : retrouver les paires de cartes dont le
son est identique (vrais échantillons d'instrument, pas du ZzFX synthétisé).
Trois niveaux d'aide (facile = couleur, normal = nom de la note en majuscule,
difficile = aucune) et le choix de l'instrument (piano, xylophone, guitare,
trompette, flûte pour commencer) à l'écran « Qui joue ? ». De 1 à 4 joueurs :
solo à score, ou en famille à tour de rôle (qui trouve une paire rejoue,
comme le vrai jeu de mémoire).

- **Décisions clarifiées avec l'utilisateur avant d'écrire du code** : 3
  niveaux (pas 2, malgré la formulation initiale) ; les fichiers audio sont
  fournis par l'utilisateur via le dossier `idée/` (même pipeline que les
  icônes), pas cherchés par Claude ; 1 à 4 joueurs, à tour de rôle au-delà
  d'un seul.
- **`solfege/music.ts`** : `PITCH_ORDER` et `pitchLabel()` exportés (avant,
  `PITCH_ORDER` était un détail interne du module) — note-memory réutilise
  directement les 7 hauteurs et leurs noms français affichables (« RÉ »,
  accent compris ; les identifiants de code restent ASCII, `re`) plutôt que
  de dupliquer une liste de notes.
- **6 paires (12 cartes), pas 7 (14)** : `shell/GameScreen.tsx` contraint le
  plateau de jeu dans un **carré** (`width: min(94vw, 100vh - 132px - safe
  areas)`, `aspectRatio: 1/1`), pas la largeur d'écran complète comme les
  écrans de sélection testés au tour précédent. Sur iPhone (375×812), ce
  carré fait environ 350×350 px — 12 cartes tiennent en 4×3 à ~80 px de
  cible (la règle CLAUDE.md, pas l'exception grille dense), 14 tomberait à
  ~43 px en 7×2. Les 6 hauteurs jouées sont tirées parmi les 7 disponibles
  (mulberry32, seed de la partie) : pas toujours les mêmes d'une partie à
  l'autre, mais un enfant croise quand même les sept noms sur plusieurs
  parties.
- **Score solo en efficacité, pas en tentatives brutes** : `storage/index.ts`
  (`recordScore`) ne retient un nouveau record que si `value` augmente — un
  compteur de tentatives où *moins* est *mieux* aurait cassé ce mécanisme
  (piégé en y réfléchissant avant d'écrire le code, voir l'appel à l'outil
  conseiller de cette session). `value = round(100 × paires / tentatives)`,
  `maxValue = 100` fixe : le pourcentage est déjà calculé dans `getResult`,
  comme rhythm-tap. `variant: level-${niveau}` pour un record séparé par
  difficulté.
- **Retrouver une paire fait rejouer le même joueur** (règle classique du
  memory) : `turnIndex` ne change qu'à `resolveMismatch`, jamais au 2ᵉ flip
  d'une paire trouvée. En famille à 3-4 joueurs, une égalité du nombre de
  paires trouvées donne `{ kind: 'draw' }` — testé explicitement (pas
  seulement le cas à 2 joueurs, qui ne peut pas être à égalité selon les
  règles de retour de tour... en fait si, mais moins probable à tester par
  hasard).
- **Le dépareillage n'est jamais résolu dans `logic.ts`** (CLAUDE.md règle
  2 : pas d'horloge dans la logique pure) : après un 2ᵉ flip qui ne
  correspond pas, les deux cartes restent dans `revealed` jusqu'à ce que
  `Board.tsx` envoie `resolveMismatch` après un délai de présentation (pas
  encore écrit, voir plus bas) — même patron que `rhythm-tap/Board.tsx` pour
  son compte à rebours.
- **`Board.tsx` volontairement pas encore écrit.** Conseil du conseiller
  suivi : le mécanisme central du jeu (taper une carte, entendre un son,
  décider si ça correspond) ne peut pas être vérifié sans les vrais sons —
  construire l'écran autour d'un `playNote()` factice aurait figé des choix
  (format de fichier, minutage du décodage, poids sur un iPad 2 Go de RAM)
  avant d'avoir vu un seul fichier. `logic.ts` + `logic.test.ts` sont
  entièrement indépendants du son (18 tests, tous verts) ; le reste attend
  les fichiers audio dans `idée/`.
- **Icônes du sélecteur d'instrument** : pas d'emoji (pas de xylophone dans
  Unicode) ni de réutilisation du champ `visualPreference` de rhythm-tap
  (déjà livré, approuvé par l'utilisateur — le renommer ou changer son rendu
  aurait touché un écran qui marche déjà pour un bénéfice de cohérence que
  personne n'a demandé). Un second champ `GameMeta` séparé, dédié aux icônes
  d'instrument (options avec vraie image, comme `BotLevel`), à poser une
  fois les assets audio arrivés et les icônes dessinées.
- **Reste à faire une fois les fichiers audio reçus (`idée/`)** : vérifier
  licence/origine, vendoriser dans `src/vendor/instrument-samples/` avec un
  `LICENSE.md`, écrire le module de lecture (Web Audio, `AudioContext`
  partagé de `fx/audio-context.ts`, pas le moteur de lookahead de
  `solfege/audio.ts` qui sert à la lecture musicale programmée — ici il
  suffit de déclencher un échantillon au tap), dessiner les icônes
  (5 instruments + 3 niveaux d'aide + la tuile du jeu), écrire `Board.tsx`,
  ajouter `note-memory` à `registry.ts`.
- Fichiers demandés à l'utilisateur : un son par hauteur (do, ré, mi, fa,
  sol, la, si — une octave, cohérent avec `solfege/music.ts`) pour chacun
  des 5 instruments, soit 35 fichiers courts (une seule note, pas d'accord).

## Spec 06 — « Où va-t-elle ? », quiz de déplacement des pièces (2026-09-19)

Deuxième palier vers les échecs (après la course des poussins), premier jeu
de cent niveaux, premier socle échecs générique (`src/chess/`). Code livré,
tests/build/lint verts, testé en navigateur (marquage/validation/révélation,
5×5 et 8×8, palier verrouillé/débloqué, reprise, écran de résultat) — **pas
encore testé sur iPad/iPhone réels**, voir plus bas ce qui en dépend.

- **`src/chess/` volontairement générique, pas taillé pour piece-quiz** :
  `pieces.ts` (cases accessibles), `attacks.ts` (cases attaquées, pour la
  sécurité du roi), `geometry.ts` (coordonnées paramétrées par taille) et
  `shapes.ts` (silhouettes, données pures) ne savent rien d'un « niveau » ou
  d'un « quiz » — `side: 'own' | 'enemy'` plutôt que blanc/noir, parce que ce
  socle sert un jeu à un seul camp qui bouge, pas une partie à deux joueurs.
  Offsets de déplacement (cavalier, roi, tours/fous/dames) factorisés dans
  `chess/offsets.ts`, partagés entre `pieces.ts` et `attacks.ts` — même
  géométrie, deux usages, une seule table pour ne pas la faire diverger.
- **`chess-race/` n'est pas migré sur ce socle, dette assumée** (explicitement
  hors périmètre de la spec) : `chess-race/logic.ts` continue de recalculer
  ses propres cases de pion à la main. Un futur jeu d'échecs (ou une session
  de refactor dédiée) pourra rebrancher chess-race sur `chess/pieces.ts`.
- **`chess/shapes.ts` exporte des données pures (viewBox + éléments SVG
  typés), pas des composants React** — nécessaire pour respecter à la fois
  « le socle n'importe pas React » (CLAUDE.md règle 5, critère d'acceptation
  4) et « silhouettes dans l'esprit de `chess-race/Pawn.tsx` » (deliverable
  1, un composant React). Résolu en séparant les deux : `ChessPiece.tsx`
  (`piece-quiz/`) est le seul fichier qui transforme ces données en JSX.
  Silhouette de pion dupliquée depuis `Pawn.tsx` (même corps : tête ronde,
  col en gélule, jupe évasée) plutôt que réutilisée — même raisonnement que
  la non-migration de chess-race, la duplication est le compromis assumé.
- **Générateur par rejet (rejection sampling) sur un prédicat unique
  (`isValidQuestion`), pas des placements calculés à la main par bloc de
  niveaux** : chaque candidat (`buildCandidate`) place des pièces selon des
  règles simples et volontairement approximatives par bloc (ex. « bloque
  l'avance, garantit les deux diagonales adverses » pour 21-30), puis
  `reachableSquares()` — le même code que `chess/pieces.ts`, testé
  séparément — en dérive les cases attendues. Aucune case attendue n'est
  jamais recalculée à la main dans `generate.ts` : risque d'un bug de
  synchronisation entre générateur et moteur, éliminé par construction. Le
  prédicat (`isValidQuestion`) est exporté et réutilisé tel quel par
  `generate.test.ts` — même définition de « position valide » des deux
  côtés, pas deux versions qui pourraient diverger (conseil du conseiller,
  suivi).
- **Filet de secours (`fallbackQuestion`), jamais atteint en pratique sur les
  100 niveaux × 5 seeds testés** (`generate.test.ts`, 559 ms) : si 150
  tentatives aléatoires échouent pour une question, une position minimale
  garantie valide (pion seul, ou avec une seule prise diagonale si le niveau
  exige ≥ 2 cases) prend le relais. Relâche uniquement la difficulté (moins
  de pièces), jamais les garanties — reste soumis au même `isValidQuestion`.
- **Sécurité du roi : case du roi retirée du plateau avant de calculer les
  attaques adverses** (`attackedSquares(board, size, 'enemy',
  ignoreSquare: kingSquare)`) — sans ça, une pièce adverse qui attaque *au
  travers* de la case du roi (une tour sur la même ligne, par exemple)
  semblerait s'arrêter net sur lui et ne jamais menacer la case juste
  derrière, ce qui est faux dès que le roi s'en va. Le générateur exige que
  la case du roi *et* toutes ses destinations calculées soient non-attaquées
  dans ce plateau « roi absent » — rejet et nouveau tirage sinon, jamais un
  filtrage a posteriori des destinations (qui aurait rendu la réponse du
  quiz incohérente avec celle des autres pièces, toujours « l'ensemble
  simplifié complet »).
- **Aucune position ne peut contenir de clouage, par construction, pas par
  détection** : le bassin de pièces secondaires (`OBSTACLE_TYPES`) exclut
  toujours `'king'` — un roi n'apparaît que comme pièce interrogée. Un
  clouage suppose un roi ami *derrière* la pièce clouée ; sans second roi
  jamais posé sur le plateau, aucun clouage n'est géométriquement possible.
  Documenté comme raisonnement plutôt que codé (conseil du conseiller,
  suivi) — pas de fonction `isPinned` qui n'aurait jamais rien à détecter.
- **« Majorité des questions exerce la règle », pas 5/5 systématique** :
  pour les blocs qui introduisent une règle (11-20 prise, 21-30 blocage,
  81-90 double pas/prise en passant), un seul indice de question (tiré au
  sort par niveau) est la question « hors règle » ; les 4 autres l'exercent
  toujours. Interprétation choisie plutôt que probabiliste (qui aurait pu,
  par malchance, produire 5/5 ou 2/5) : garantit la majorité par
  construction, vérifié dans `generate.test.ts`.
- **`GameMeta.createState` gagne `options.bestScores`, extension additive**
  (voir ARCHITECTURE.md §4) : le shell (`GameScreen.tsx`) lit désormais
  `localPlayer` *avant* d'appeler `createState` (jusqu'ici calculé plus bas,
  seulement pour l'affichage) et lui transmet
  `getAllHighScores(game.meta.id, localPlayer)` — nouvelle fonction de
  `storage/index.ts`. Les cinq jeux existants ignorent ce champ sans rien
  changer à leur signature, comme `options.level` en spec 05.
- **Progression = un compteur par palier (`scores`, variant `easy`/`medium`/
  `hard`), pas une liste de niveaux réussis** : `resumeLevelForTier(tier,
  progress)` dérive le niveau de reprise directement du compteur
  (`start + progress[tier]`, ou le dernier niveau du palier s'il est déjà
  terminé — sert aussi à le rejouer). Ça marche *parce que* les niveaux d'un
  palier se débloquent strictement dans l'ordre (spec) : un compteur suffit,
  pas besoin de mémoriser lesquels précisément. `getResult` n'incrémente le
  compteur que si le niveau qui vient d'être joué est *exactement* le
  prochain à réussir (`levelWithinTier === progress[tier] + 1`) — rejouer un
  niveau déjà acquis (même à 5/5) ne fait donc jamais avancer au-delà de ce
  qui est déjà acquis, et ne peut jamais reculer.
- **Cas non couvert littéralement par la spec, tranché ici** : si tous les
  paliers débloqués sont déjà terminés (plus aucun niveau à réussir nulle
  part), la reprise atterrit sur le *dernier* niveau du palier le plus
  avancé plutôt que de bloquer sans écran — permet simplement de le rejouer.
  Testé (`logic.test.ts`).
- **Pas de 4ᵉ phase `'done'`** : le contrat de la spec énumère exactement
  trois phases (`question` / `reveal` / `tierPicker`). `getResult` renvoie
  un résultat non nul dès que la révélation de la *dernière* question de la
  manche est affichée (`phase === 'reveal' && questionIndex === lastIndex`)
  — GameScreen bascule déjà tout seul vers `ResultScreen` 900 ms après
  qu'un résultat apparaît (même mécanisme que la ligne gagnante du morpion),
  le temps que `Board.tsx` montre la révélation. `Board.tsx` n'envoie
  `{type:'next'}` qu'entre les questions 1 à 4 — jamais après la 5ᵉ, où ce
  serait de toute façon un coup invalide.
- **Pas de « fermer le sélecteur de palier » dans le vocabulaire de coups de
  la spec** (`toggle`/`validate`/`next`/`openTierPicker`/`startLevel`, sans
  `closeTierPicker`) : plutôt que d'inventer un coup non prévu, retaper le
  palier déjà en cours revient exactement au niveau de reprise de ce
  palier — un « annuler » qui n'a pas besoin d'exister comme coup séparé.
  Effet de bord accepté : ça recommence aussi la manche en cours depuis la
  question 1, cohérent avec la règle générale « quitter au milieu d'un
  niveau le fait recommencer depuis sa première question ».
- **`Result.score.maxValue` renseigné** (`TIER_LEVELS[tier]`) : le score
  s'affiche en pourcentage de complétion du palier (« Score : 12 % »)
  plutôt qu'en nombre brut de niveaux — lisible sans avoir à connaître le
  total (30 ou 40) de chaque palier, et « Nouveau record ! » s'affiche
  naturellement à chaque fois que la progression avance vraiment (value >
  previousBest), silencieux sur un niveau raté ou rejoué.
- **Bouton de validation flottant (position fixed), hors du carré du
  plateau — pas d'extension de la réservation de hauteur dans
  `GameScreen.tsx`** (question posée explicitement à l'utilisateur avant
  d'écrire le CSS, qui a choisi cette option). Nécessaire : le carré que le
  shell réserve à `Board` est déjà occupé pleine largeur par la grille 8×8
  (44 px/case tout juste, l'exception iPhone documentée dans CLAUDE.md) —
  aucune marge disponible *à l'intérieur* pour un bouton sans repasser sous
  ce plancher. `GameScreen` centre le carré verticalement
  (`items-center justify-center`) dans l'espace qui reste après le carré
  (comme il est de toute façon plus étroit que haut sur les deux appareils
  cibles) : ça laisse une marge en dessous, la moitié du surplus vertical.
  **Calcul, pas mesuré sur l'appareil réel** (aucune fenêtre portrait
  disponible dans cet environnement de développement, `resize_window` sans
  effet sur le rendu réel — confirmé par `window.innerWidth/innerHeight`
  inchangés après l'appel) : sur iPad (768×1024, sans encoche), le carré
  fait ~722 px de large, laissant ~85 px en dessous ; sur iPhone X, ~352 px
  de large, laissant ~125 px (zones de sécurité déjà comprises dans le
  budget de hauteur du carré). Bouton fixé à 60 px + 10 px de marge (70 px
  au total) pour garder une vraie marge de sécurité sur iPad (~15 px) plutôt
  que coller au plus juste — sous les 80 px habituels de CLAUDE.md, mais un
  choix géométrique mesuré, comme l'exception iPhone des grilles denses,
  pas une taille arbitraire. **À reconfirmer en priorité sur l'iPad et
  l'iPhone réels** avant de considérer cette disposition acquise : si le
  calcul est optimiste (arrondis, hauteur réelle du bandeau d'en-tête un peu
  différente de 132 px), le bouton peut encore chevaucher la dernière
  rangée du plateau. Deux corrections de repli déjà identifiées si besoin :
  réduire encore le bouton, ou (l'option non retenue cette fois) laisser
  `GameScreen` réserver explicitement une bande sous le carré.
- **Icônes des paliers réutilisent les silhouettes du socle** (pion/tour/
  dame pour facile/moyen/difficile) plutôt que d'en vendoriser ou d'en
  dessiner de nouvelles — trois formes déjà disponibles, de complexité
  croissante, cohérentes avec le thème du jeu.
- **Testé en navigateur** (Chrome, fenêtre desktop — aucune fenêtre portrait
  réelle disponible dans cet environnement, voir ci-dessus) : cycle complet
  d'une question (marquage, validation, révélation — trouvée/manquée/fausse
  toutes les trois vérifiées visuellement) sur 5×5 et 8×8, enchaînement
  automatique entre questions, écran de résultat avec score en pourcentage,
  « Rejouer » qui relance le même niveau avec un nouveau seed (comme les
  autres jeux solo), sélecteur de palier (Moyen débloqué et jouable après
  avoir forcé `progress.easy = 24` en `localStorage` pour le test, Difficile
  resté verrouillé). `npm run build`, `npm test` (203 tests) et
  `npm run lint` tous verts. `git diff` : aucun fichier existant de
  `src/games/*/` touché (`note-memory/`, en cours de construction depuis la
  session précédente, non plus).

## Spec 06, retour utilisateur : nouvelles silhouettes (2026-09-19, suite)

Les six premières silhouettes (corps commun de `Pawn.tsx` + tête qui change)
n'ont pas plu. Deux allers-retours :

- **Premier essai : redessiner en s'inspirant des références outline
  déposées dans `idée/`** (icônes au trait fin, sans remplissage — `tour.png`,
  `eveque.png`, `reine.png`, `roi.png`, `jeu-dechecs.png` pour le cavalier).
  Aperçu construit et publié en artifact pour validation avant intégration
  (process établi, voir plus haut) — jugé insuffisant (« je n'aime pas »),
  sans détail sur ce qui clochait précisément.
- **Deuxième essai, retenu : l'utilisateur a déposé un jeu de fichiers tout
  fait dans `idée/`** (`ChessPiece.tsx`, `playerPawnSkins.ts`,
  `apercu-pieces.png` — visiblement produit par une autre session, avec un
  aperçu rendu en blanc/noir/rose/bleu/jaune déjà validé par l'utilisateur).
  Contrairement aux six premières tentatives (un seul corps partagé, seule la
  tête change), chaque pièce a ici sa **silhouette complète et indépendante**
  — portées telles quelles dans `chess/shapes.ts`, aucune retouche de tracé.
  Deux adaptations pour coller aux conventions du projet, pas au dessin :
  - `PieceShapeElement` (type de données pures) gagne un `fill?: 'none'`
    optionnel — le cavalier a un élément « trait seul » (la ligne de bouche,
    qui dépasse du contour) qu'un simple remplissage plein aurait fait
    disparaître dans la couleur du corps.
  - Couleurs reprises depuis `playerPawnSkins.ts` (mêmes valeurs que
    `chess-race/pawnSkin.ts`, déjà dupliquées une fois dans
    `piece-quiz/pieceSkin.ts`) mais **déplacées dans `src/chess/skin.ts`**
    plutôt que laissées dans `piece-quiz/` — demandé explicitement par
    l'utilisateur cette fois (« si tu dois reprendre la logique de
    pawnSkin.ts dans src/chess/, la duplication est acceptée »), qui reflète
    mieux que ce principe de coloration appartient au socle, pas à un jeu en
    particulier. `piece-quiz/pieceSkin.ts` supprimé, `ChessPiece.tsx` et
    `Board.tsx` importent `chess/skin.ts`. Skin adverse (gris chaud neutre)
    inchangé — ni les références ni les fichiers déposés n'en proposaient un,
    ce jeu est le seul à en avoir besoin.
  - Palette adverse alignée sur les mêmes noms qu'`OWN_SKINS` (indexée sur le
    hex, pas sur une clé nommée comme `playerPawnSkins.ts` le faisait — pas
    de `PlayerColorKey` introduit, pour rester cohérent avec `player.color`
    qui est déjà un hex partout ailleurs dans le code).
  - **Site où la fente du fou / les « jours » du roi ne sont pas des trous
    au sens SVG** : le contour du fou trace un seul chemin dont la géométrie
    laisse un vide visuel (technique « ruban »), et les deux petites formes
    en creux de la couronne du roi sont en réalité deux formes pleines
    dessinées par-dessus (des « gemmes », pas des découpes) — aucune des deux
    pièces n'a besoin d'un `fill-rule` particulier ni d'un masque.
- **Vérifié en jeu réel** (pas seulement en aperçu isolé), les six pièces
  l'une après l'autre en forçant `progress` par `localStorage` puis en
  passant par le sélecteur de palier : pion et tour (Facile), cavalier
  (Difficile, `progress.medium = 32`), dame et fou (Moyen, `progress.medium
  = 32`, dernier niveau du bloc dame), roi (Moyen, `progress.medium = 20`
  pour retomber dans son bloc 51-60) — toutes lisibles à la taille réelle du
  plateau, couleur de profil (jaune/moutarde du seul joueur de test) bien
  appliquée. `localStorage` de test remis à zéro (`scores` supprimé) après
  coup. `npm run build` et `npm run lint` verts ; les tests ne dépendent pas
  du tracé des pièces, inchangés.
- **La proposition de contrat des points 3 à 5 (jeu continu, sauvegarde
  immédiate, fête tous les 10 niveaux, échec de niveau) reste en attente de
  validation** — ce retour ne portait que sur les pièces. Rien écrit pour
  ces trois points dans cette session.

## Spec 06, retour utilisateur : jeu continu, fête, échec (2026-09-19, suite 2)

Contrat validé tel quel (« je valide »). `GameModule.progressSignal?(prev,
next): ProgressSignal | null` — voir ARCHITECTURE.md §4 pour la forme finale
(identique à la proposition). Implémenté pour les points 3 à 5 d'un coup,
plus le point 2 (numéro de niveau affiché).

- **`getResult` ne sert plus qu'à une seule chose : le niveau 100 réussi.**
  Nouveau champ `PieceQuizState.finished` (`boolean`), mis à `true`
  uniquement par `applyMove('next')` quand `state.level === 100 && passed`.
  `getResult` devient un simple `if (!state.finished) return null`. Tous les
  99 autres niveaux (réussite ou échec) s'enchaînent entièrement en interne,
  sans jamais faire transiter l'état par un `Result` — c'est ce qui rend le
  jeu réellement continu : le shell ne voit jamais la partie « finir » avant
  le niveau 100.
- **`'next'` devient le seul coup qui décide ET transitionne.** Avant (jeu
  par niveaux séparés), `'next'` ne faisait qu'avancer `questionIndex` et
  n'était valide que pour les questions 1 à 4 ; la 5ᵉ était gérée par le
  shell via `getResult`. Maintenant `isValidMove('next')` est vrai dès que
  `phase === 'reveal' && !state.finished`, sans distinction de question — sur
  la 5ᵉ, `applyMove` évalue (`passedLevel`), met à jour `progress` si c'est
  bien le niveau qu'on attendait, puis choisit : niveau 100 réussi → 
  `finished: true` ; sinon niveau suivant (réussi) ou même niveau redémarré
  (raté), avec une nouvelle génération de questions dans les deux cas via
  `generateLevel(seed, level)`.
- **Piège trouvé en testant en navigateur, pas en revue de code : le
  minuteur de révélation de `Board.tsx` avait encore l'ancien garde-fou**
  (`isLastQuestion`, hérité du design pré-jeu-continu — « pas besoin
  d'envoyer next sur la 5ᵉ, le shell bascule tout seul »), jamais mis à jour
  en écrivant `logic.ts`. Conséquence : le jeu restait bloqué en silence sur
  la révélation de la 5ᵉ question de chaque niveau, plus aucun niveau ne
  s'enchaînait jamais. Repéré uniquement parce que la vérification en
  navigateur faisait partie du plan (pas seulement `npm test`, qui ne pouvait
  pas voir ce bug — `Board.tsx` n'est exercé par aucun test). Fix : le garde
  devient `state.finished` (le seul cas où renvoyer `'next'` serait
  effectivement invalide), plus `isLastQuestion` du tout — la 5ᵉ question suit
  exactement le même chemin que les autres.
- **`ProgressSignal` calculé par diff structurel de `(prev, next)`, jamais un
  champ dédié dans l'état** : `progressSignal` repère la transition de fin de
  niveau en regardant `prev.phase === 'reveal' && prev.questionIndex ===
  lastIndex` — exactement le même repère que celui qu'`applyMove` utilise en
  interne pour savoir qu'il doit décider. Une seule définition de « ceci est
  une fin de niveau », pas deux qui pourraient diverger. Le signal lui-même
  compare `next.progress[prev.tier]` à `prev.progress[prev.tier]` pour savoir
  s'il y a un score à écrire — jamais recalculé indépendamment.
- **Fête à chaque dizaine réussie, y compris en rejouant un niveau déjà
  acquis** (décision annoncée dans la proposition, confirmée) : la condition
  est purement `prev.level % 10 === 0 && prev.level !== 100`, indépendante de
  `advances`. Testé explicitement (`logic.test.ts`, « dizaine réussie même en
  rejouant... ») : `celebrate` présent, `scores` absent.
- **Niveau 100 : jamais de fête, toujours le chemin `Result` normal** — la
  condition de fête exclut `level !== 100` explicitement ; `scores` est quand
  même inclus dans le signal à ce moment-là (le compteur avance comme
  n'importe quel autre niveau), en plus de `Result.score` calculé séparément
  par `App.tsx` à la fin — écriture redondante mais inoffensive
  (`recordScore` ne garde que le maximum).
- **Écrans transitoires (fête, échec) possédés par `GameScreen.tsx`, pas par
  `Board.tsx`** — respecte la frontière demandée (« le jeu signale, le shell
  produit l'effet »). Deux points d'état local (`celebration`,
  `failFlash`), posés et effacés par des `setTimeout` dans le même
  gestionnaire synchrone que les sons/l'écriture des scores (règle déjà en
  place depuis la spec 03 : le déclenchement de son vit dans le handler
  synchrone du transport, jamais dans un `useEffect`). L'état du jeu a *déjà*
  avancé (niveau suivant ou redémarré) pendant que l'écran transitoire est
  affiché par-dessus — vérifié visuellement : le plateau du niveau suivant
  (nouvelle pièce, nouveau numéro dans le repère) est visible en transparence
  derrière les confettis avant que l'écran ne disparaisse. Les deux écrans
  capturent tous les taps (`fixed inset-0`, pas de `pointer-events: none`) :
  impossible de répondre à la question suivante pendant qu'ils sont affichés.
- **Tremblement via `motion-safe:animate-quiz-shake` (Tailwind), pas une
  vérification manuelle de `prefers-reduced-motion`** — le variant Tailwind
  applique déjà la media query pour nous ; le contour rouge (`ring-red-500`)
  et le son restent inconditionnels, comme demandé (« avec
  prefers-reduced-motion, pas de tremblement : le son et le contour rouge
  suffisent »).
- **Nouveau son `fail` dans `fx/sound.ts`**, plutôt que réutiliser `invalid`
  (déjà pris : « mauvais clic », pas « niveau raté ») ou `draw` (déjà pris :
  fin de manche neutre, sound-memory). Descendant, un peu plus long que les
  deux autres, mais volontairement doux — « un petit son d'erreur », pas une
  alarme. Générique (`fx/sound.ts` reste un module partagé), réutilisable par
  un futur jeu qui aurait besoin du même genre de signal.
- **`recordScore` appelé directement depuis `GameScreen.tsx`**, pas remonté
  jusqu'à `App.tsx` — annoncé dans la proposition, confirmé sans objection.
  `App.tsx` (`computeScoreInfo`) garde son rôle inchangé pour la fin de
  partie (`Result.score`, affichage dans `ResultScreen`) ; `GameScreen.tsx`
  gagne un second point d'écriture pour les sauvegardes en cours de partie,
  généré par `progressSignal`.
- **Numéro de niveau affiché (point 2), purement local à `Board.tsx`,
  aucune extension de contrat** : `LevelBadge` lit `state.level`/`state.tier`
  (déjà dans l'état) et réutilise l'icône de palier du sélecteur
  (`TIER_ICON`, pion/tour/dame) — même vocabulaire visuel, pas une nouvelle
  icône à créer. Numéro *absolu* (1-100), pas la position dans le palier :
  c'est le même nombre que celui utilisé dans les libellés de fête (« Niveau
  30 »), pas deux systèmes de numérotation différents à réconcilier
  mentalement. Posé à l'intérieur du carré du plateau (`top-2`, pas
  `position: fixed`) plutôt qu'en flottant comme les boutons : purement
  informatif, aucune zone tactile à garantir, pas de risque de chevaucher un
  bouton voisin.
- **Vérifié en jeu réel (pas seulement `npm test`)**, ce qui a permis de
  trouver le bug du minuteur ci-dessus : enchaînement niveau 9 → 10 → fête
  (« Niveau 10 », confettis, photo du joueur, plateau du niveau 11 déjà
  visible en dessous, disparition automatique après ~2,5 s) → niveau 11
  raté volontairement 4 fois sur 5 (tremblement + contour rouge visibles
  simultanément, plateau déjà revenu à la question 1 du même niveau 11 en
  dessous) → `localStorage.scores` relu directement en cours de partie
  (`easy: 10`, écrit sans jamais passer par un écran de résultat) → rechargement
  complet de la page (équivalent d'un redémarrage d'app) → le jeu rouvre
  directement au niveau 11, confirmant que la sauvegarde immédiate survit
  bien à un redémarrage (critère d'acceptation 6). Le geste « rester appuyé »
  du bouton Quitter lui-même n'a pas pu être simulé par script dans cet
  environnement (les `PointerEvent` synthétiques n'atteignent pas le
  gestionnaire React) — code inchangé cette session, déjà validé dans une
  session précédente (voir plus haut, spec 04).
- `npm run build`, `npm run lint` et `npm test` (213 tests, dont 32 pour
  `piece-quiz/logic.test.ts`, entièrement réécrits pour le jeu continu et
  `progressSignal`) tous verts. `git diff` : aucun dossier des quatre autres
  jeux touché ; `grep -rn "fx/" src/games/piece-quiz/` ne retourne rien.

## Spec 06, retour utilisateur : plateau 5×5 partout, niveaux à 3 questions (2026-09-20)

Après un essai réel dépassant le niveau 30 : « on ne croise jamais un pion
sur la route », l'échiquier 8×8 (Moyen/Difficile) était trop grand pour ce
que le jeu essaie d'enseigner — assez de cases vides pour que la pièce
interrogée n'ait presque jamais d'obstacle sur son chemin. Deuxième retour
dans le même message : les niveaux à 5 questions étaient trop longs à
rejouer après un échec.

- **`BLOCKS` (generate.ts) : tous les blocs passent à `boardSize: 5`**, y
  compris tour/fou/roi/dame/cavalier/mélange (31-100), auparavant 8×8. Le
  type `BoardSize` (`5 | 8`) est retiré, remplacé par le littéral `5` partout
  (`BlockConfig.boardSize`, `boardFromPieces`, `PieceQuizQuestion.boardSize`)
  — plus une seule ligne de code qui suppose encore un plateau 8×8 possible
  dans piece-quiz. **Aucun changement dans `src/chess/`** : la géométrie y
  reste paramétrée par la taille (elle sert aussi chess-race, en 8×8, et
  servira à de futurs jeux) — seul piece-quiz choisit désormais 5 partout.
- **Le double pas et la prise en passant (81-90) se sont révélés déjà
  génériques en taille, sans rien à corriger** : `chess/pieces.ts` calcule la
  rangée de départ adverse comme `size - 2` (jamais une constante 8), et
  `generate.ts` calcule la rangée où intercepter un double pas comme
  `size - 4` — ces deux formules avaient été écrites en fonction de `size`
  dès la spec initiale (pas de littéral `8` caché), sans anticiper qu'elles
  serviraient un jour à autre chose que 8×8. Vérifié directement par
  `generate.test.ts` (aucune modification de ces fonctions n'a été
  nécessaire, seules les tailles de plateau dans `BLOCKS` ont changé) — la
  suite complète (100 niveaux × 5 seeds) reste verte du premier coup.
- **Densité des pièces inchangée (mêmes `MAX_DECOYS`)** : sur un plateau
  deux fois plus petit (25 cases contre 64), les mêmes compteurs de pièces
  secondaires (jusqu'à 5 pour « open », 4 pour le roi) occupent une bien plus
  grande proportion du plateau — exactement l'effet recherché (plus de
  chances de croiser un obstacle), vérifié en jeu réel (niveau 36 : une tour
  interrogée, une deuxième tour amie et deux dames adverses toutes visibles
  sur le même plateau 5×5). Le générateur par rejet absorbe cette densité
  plus forte sans réglage supplémentaire — toujours moins d'une seconde pour
  générer les cent niveaux × cinq seeds du test.
- **`QUESTIONS_PER_LEVEL` : 5 → 3, et le seuil de réussite change de nature**
  — ce n'était pas seulement « moins de questions », c'était aussi le
  passage d'un seuil à 80 % (4/5, une marge d'erreur) à l'exigence des trois
  correctes (`passedLevel = answers.every(Boolean)`, `REQUIRED_CORRECT`
  supprimé). Une seule case oubliée ou en trop sur n'importe laquelle des
  trois fait recommencer le niveau. Cohérent avec la formulation de la
  demande (« 3 parties gagnantes d'affilée ») : avec seulement trois
  questions, « d'affilée » et « toutes correctes » désignent la même chose.
- **La règle de « majorité » du générateur (un seul indice hors-règle par
  niveau) tient à l'identique** : avec 3 questions, majorité = au moins 2
  (`Math.ceil(3/2)`), et `offIndex` en désigne toujours exactement une comme
  hors-règle — donne bien 2 questions sur 3 qui exercent la règle introduite
  par le bloc, sans changement de la logique elle-même (seule la constante
  `QUESTIONS_PER_LEVEL` qu'elle utilise a changé). `generate.test.ts` mis à
  jour pour vérifier `>= Math.ceil(QUESTIONS_PER_LEVEL / 2)` plutôt qu'un
  seuil codé en dur à 3 (qui aurait par coïncidence continué à passer sans
  vérifier la bonne chose).
- **Bug trouvé en revérifiant en jeu réel après le changement de plateau,
  pas en relisant le code** : le repère de niveau (`LevelBadge`, ajouté à la
  session précédente) était positionné en survol (`absolute`) par-dessus le
  damier. Sur un plateau 8×8, la rangée du haut était visuellement loin de
  la case du repère la plupart du temps ; sur un plateau 5×5, avec moins de
  rangées, la pièce interrogée tombe beaucoup plus souvent rangée du haut —
  et le repère se retrouvait à chevaucher son anneau de sélection (vu
  précisément au niveau 36, une tour interrogée juste sous le repère). Fix :
  le repère quitte la position `absolute` et devient un vrai élément de mise
  en page (`flex flex-col`, hauteur fixée `h-9`), et le damier réserve
  exactement cette hauteur plus l'espacement (`height: calc(100% - 44px)`,
  `aspect-ratio: 1/1` pour rester carré) au lieu de remplir tout le carré
  laissé par le shell. Plus aucun chevauchement possible, quelle que soit la
  case où tombe la pièce interrogée. Coût : les cases perdent quelques
  pixels sur les deux appareils (déjà largement au-dessus du plancher de
  44 px documenté dans CLAUDE.md, qui ne s'appliquait de toute façon qu'aux
  grilles 8×8 — disparues de ce jeu avec ce changement).
- **Vérifié en jeu réel** : niveau 36 (tour, Moyen, 5×5) rejoué après le
  correctif de mise en page — repère « 36 » proprement au-dessus du damier,
  aucun chevauchement, plusieurs pièces amies/adverses visibles sur le même
  petit plateau. `localStorage` de test remis à zéro après coup.
- `npm run build`, `npm run lint` et `npm test` (`piece-quiz` + `chess`,
  69 tests) verts. `git diff` : seuls des fichiers de `piece-quiz/` touchés
  cette fois (le socle `src/chess/` n'a pas bougé).

## Spec 07 — « La chasse au roi » (2026-09-23)

Nouveau jeu `king-hunt/` : deux tours traquent un roi sur 5×5, avec un budget
de coups. S'appuie sur `src/chess/` (géométrie, `reachableSquares`,
`attackedSquares`, silhouettes, skins) sans y toucher.

**Le bug le plus sérieux évité en le cherchant AVANT d'écrire l'UI.** La
spec affirme que deux tours attrapent le roi en 12 coups sur 5×5 — une
affirmation, pas une garantie : sans échec/mat, le roi peut marcher sur
n'importe quelle case, y compris « contrôlée », et rien n'empêche a priori
une position de départ où il s'échapperait indéfiniment. Plutôt que
d'implémenter le budget puis découvrir le problème en testant, j'ai construit
`logic.ts` + la table résolue de `bot.ts` en premier, puis balayé les 6900
positions de départ légales (paires de tours × case de roi, tours au trait)
avec un script jetable (`npx tsx`, supprimé après usage). Résultat : 6834
positions sont gagnantes pour les tours en jeu parfait (distance max
observée : **10** coups de tour, budget niveau 4 = 12 — marge confortable),
et 66 ne le sont pas (roi qui s'échappe indéfiniment ou force la prise d'une
tour). Vérification supplémentaire : ces 66 positions correspondent
*exactement* aux positions qu'excluent déjà les deux garanties demandées par
la spec (roi jamais adjacent à une tour, jamais attaquable au premier coup) —
`generateStartBoard` ne peut donc jamais produire une position perdante,
confirmé par balayage exhaustif, pas par échantillonnage.

**Table résolue (niveau 4, « le coq »)** : sur 5×5, deux tours + un roi
tiennent dans ~14 000 positions (300 paires de cases de tours × 23 cases de
roi × 2 camps au trait) — assez petit pour résoudre EXACTEMENT par induction
arrière (même principe qu'une table de finale d'échecs), plutôt que
d'approximer avec une recherche à profondeur limitée. Implémentation par
balayages répétés jusqu'à point fixe (`solve()` dans `bot.ts`) plutôt que par
listes de prédécesseurs : plus simple à prouver correcte (les valeurs ne
décroissent jamais d'un balayage à l'autre, donc la convergence est garantie)
et largement assez rapide sur un espace de cette taille (~212 ms mesurés sur
la machine de développement — **pas mesuré sur l'iPad Air 2 réel, à
reconfirmer** ; sur un A8X, en comptant un facteur 5-10× plus lent que ce
desktop, on resterait a priori sous la seconde, mais c'est une estimation, pas
une mesure). Le calcul est mémoïsé (calculé une fois, réutilisé ensuite) et
déclenché depuis `Board.tsx` (`warmSolvedTable`, appelée dans un effet de
montage) plutôt qu'au premier coup du niveau 4 — `bot.ts` reste pur, c'est le
composant qui décide QUAND lancer le calcul, jamais `logic.ts`/`bot.ts`
eux-mêmes.

**Niveaux 1 à 3** : plutôt que d'écrire une stratégie séparée pour les tours
et pour le roi à chaque niveau, un seul `evaluate(state)` signé (positif =
bon pour le camp au trait, même patron que `chess-race/bot.ts`) sert aux deux
camps — la mobilité du roi et sa distance au bord sont bonnes pour les tours,
mauvaises pour le roi, négation immédiate pour l'autre camp. Niveau 2 = 1
coup d'avance sur cet `evaluate` (plus une préférence explicite pour une
capture immédiate si possible, cf. plus bas) ; niveau 3 = négamax à
profondeur fixe (5, puis réduite à 3 après le test de force ci-dessous, pour
laisser un écart net avec le niveau 4). Testé avant d'écrire quoi que ce
soit d'autre : sur 200 parties simulées (tours niveau 4 « parfaites », roi
variable), la moyenne des coups de tour avant capture est strictement
croissante niveau 2 < 3 < 4, vérifiée sur trois graines de seed indépendantes
avant de figer les seeds du test définitif — voir `bot.test.ts`.

**Niveau 1 (« l'œuf ») ne cherche jamais une capture** : c'est le seul niveau
qui applique littéralement « coup légal au hasard » sans la préférence
« mange une tour s'il peut » des niveaux 2 à 4 — cette dernière est un
`winningMoveIfAny` partagé (si un coup termine la partie en faveur immédiate
du camp au trait, le jouer), appliqué aux deux camps de façon générique.
Trouvé en écrivant le premier jet du test « niveau 1 battable » : avec des
tours niveau 2 (glouton, pas parfait) en face, un roi niveau 1 gagne parfois
*par accident* (mobilité aléatoire qui atterrit sur une tour mal défendue) —
pas un bug, juste la preuve qu'un niveau 2 imparfait ne protège pas toujours
ses propres tours. Le test isole la faiblesse du roi niveau 1 en le
confrontant à des tours niveau 4 (parfaites) plutôt qu'à des tours
imparfaites, pour mesurer la bonne chose.

**Écart de câblage réel entre le contrat et le shell, pas contourné.** Le
budget (table `LEVEL_BUDGET`, un par niveau de roi) et l'affichage des cases
contrôlées dépendent du niveau choisi contre l'ordinateur — mais
`GameScreen.tsx` ne transmet JAMAIS ce niveau à `createState` (seul
`options.level` existe dans le contrat, et il ne porte que `soloLevels`,
jamais `bot.level` — voir `GameScreen.tsx:65`, `PlayerPickScreen.tsx:113` qui
appelle `onConfirm` sans 3ᵉ argument en mode ordinateur). Or la spec de ce
jeu est explicite : « si tu te retrouves à vouloir toucher au contrat ou au
shell, arrête-toi et dis-le » — donc pas de changement de `GameScreen.tsx`
pour ça. Décision : `createState` lit `options?.level` (déjà générique dans
le type), retombe sur `DEFAULT_LEVEL = 1` (budget 25, cases contrôlées
affichées) quand il est absent — ce qui, avec le câblage actuel, veut dire
**toujours**, y compris en choisissant « Le coq » dans le sélecteur de
niveau. Conséquence concrète, vérifiée en jeu réel (voir plus bas) : le
budget affiché reste 25/25 et les cases contrôlées restent visibles quel que
soit le niveau de bot sélectionné à l'écran « Qui joue ? » — seule la vraie
force du roi (`chooseMove`) varie avec le niveau, elle, puisque
`GameScreen.tsx` transmet bien le niveau à `chooseMove` à chaque coup. Choix
du budget par défaut (25, le plus généreux) volontaire : la distance de
capture forcée maximale sur tout le plateau est 10 (voir plus haut), donc
25 reste large pour n'importe quel niveau de roi et ne bloque jamais une
victoire légitime — le sens inverse (un budget par défaut trop serré) aurait
pu rendre le niveau 4 *injouable* par défaut. Score (`Result.score.variant`)
et cases contrôlées héritent du même défaut, donc de la même limitation. Le
débloquer ne prend qu'une ligne, offerte mais pas appliquée : dans
`GameScreen.tsx`, passer `{ level: soloLevel ?? bot?.level, ... }` au lieu de
`{ level: soloLevel, ... }` à `createState` — `soloLevel` et `bot?.level` ne
coexistent jamais pour un même jeu (`GameMeta.soloLevels` et `GameModule.bot`
ne coexistent jamais non plus), donc ce changement est purement additif et
sans risque pour les cinq autres jeux.

**Corollaire non demandé mais découvert par la même limitation : « pas de
score en famille ».** La spec demande explicitement de ne jamais enregistrer
de score en famille (deux humains, pas d'ordinateur) — mais `getResult(state)`
n'a accès qu'à `state`, jamais à un indicateur « je joue contre le bot » (ce
indicateur existe dans le shell, `GameScreen.bot`, jamais transmis à l'état du
jeu). Plutôt que d'ajouter un champ au contrat pour ça (encore une extension
non autorisée par cette spec), le score s'attache systématiquement quand les
tours gagnent, y compris en famille — vérifié en jeu réel : une partie à deux
joueurs humains affiche bien « Nouveau record ! » en fin de partie. Écart
assumé et documenté plutôt que masqué ; la même ligne de `GameScreen.tsx`
proposée ci-dessus (transmettre le niveau réel) ne suffirait pas à elle seule
à corriger celui-ci — il faudrait en plus que `createState` sache distinguer
famille et ordinateur, ce qui demanderait un vrai ajout au contrat.

**`piece-quiz/ChessPiece.tsx` dupliqué, pas réutilisé.** Le renderer React
qui transforme les silhouettes de `src/chess/shapes.ts` en SVG vit dans
`piece-quiz/` (pas dans `src/chess/`, une asymétrie déjà notée dans
`ARCHITECTURE.md`). Le critère d'acceptation 2 de cette spec interdit toute
modification dans les dossiers des jeux existants (donc pas d'import
`piece-quiz/ChessPiece.tsx` depuis `king-hunt/`, et pas de déplacement vers
`src/chess/` non plus, puisque ça toucherait l'import de `piece-quiz`). Copie
conforme dans `king-hunt/ChessPiece.tsx` — même précédent déjà accepté pour
`chess/skin.ts` (dupliqué depuis `chess-race/pawnSkin.ts`, spec 06).

**Cases contrôlées : premier jet invisible, trouvé en jeu réel.** Premier
essai : un lavis `bg-piece/20` (crème à 20 % d'opacité) plein la case. En
testant contre le bot (niveau « Le coq » sélectionné, donc niveau 1 réel vu
l'écart ci-dessus), un contrôle direct du DOM (`innerHTML.includes('bg-piece/
20')`) confirmait que l'overlay était bien rendu sur 12 cases — mais
invisible à l'œil sur les captures d'écran, noyé dans les tons crème/vert
déjà proches. Corrigé en un petit point plein dans la couleur des tours
(`rooksColor`, 55 % d'opacité, uniquement sur case vide) — nettement visible
sur case claire comme foncée, revérifié en jeu réel (position de départ,
douze cases pointées exactement sur les lignes/colonnes des deux tours,
aucun point sur les cases hors de portée). Ajouté à la même occasion : les
pastilles de coup légal (mêmes couleurs/tailles que `chess-race/Board.tsx` —
point plein pour une case vide, anneau pour une capture) quand une pièce est
sélectionnée, absentes du premier jet — la spec ne les demandait pas
explicitement mais `chess-race` (même famille de jeu, tour comprise) les a
déjà, et rien ne justifiait de s'en priver ici.

**Rangée de budget** : jetons plutôt qu'un nombre (lisible sans savoir lire),
même technique de bande réservée que `piece-quiz/Board.tsx` (`LevelBadge`) —
le damier réserve `calc(100% - 44px)` de hauteur plutôt que de superposer la
rangée en position absolue, pour ne jamais risquer le même chevauchement
trouvé spec 06. `budgetTotal` pouvant atteindre 25 (niveau par défaut, voir
plus haut), les jetons sont dimensionnés en `flex-1` avec une largeur
maximale plutôt qu'une largeur fixe, pour rester groupés et lisibles quel que
soit le total.

**Testé en jeu réel** (serveur `vite` local + `claude-in-chrome`, même
protocole que spec 06) : partie complète en famille (deux profils, tours
puis roi joués à la main, capture du roi, écran de résultat avec confettis et
score) ; partie contre l'ordinateur niveau « Le coq » des deux côtés (humain
tours, puis humain roi contre des tours bot colorées dans la couleur bot
fixe `#52707A` — confirmant que les deux camps sont bien jouables contre
l'ordinateur sans aucun fichier du shell à modifier, comme annoncé par la
spec). Rappel valable depuis la session précédente : `resize_window` ne
change pas la taille réelle du viewport dans cet environnement (toujours
1440×779 desktop, jamais un vrai portrait iPad/iPhone) — la mise en page
portrait reste donc à confirmer sur appareil réel, comme pour `piece-quiz`.

**Tests** : `logic.test.ts` (14, dont position de départ jamais adjacente ni
attaquable sur 200 seeds, budget qui ne décompte qu'aux coups des tours,
capture du roi qui l'emporte même si elle épuise le budget le même coup, roi
bloqué par les bords) ; `bot.test.ts` (5 — déterminisme, faisabilité niveau 4
sur 100 positions tirées au sort avec marge confortable sur le budget, force
strictement croissante 2 < 3 < 4 sur 200 parties, niveau 1 nettement battable
face à des tours parfaites). `npm run build`, `npm run lint` et `npm test`
(232 tests, tout le dépôt) verts. `git status`/`git diff` : seul
`src/games/registry.ts` touché hors du nouveau dossier `king-hunt/` (une
ligne d'import + une ligne dans `GAMES`), aucun fichier de `src/shell/` ni
d'un autre dossier de jeu, `grep -rn "fx/" src/games/king-hunt/` ne retourne
rien, aucun SVG de pièce nouveau (seule `icon.svg`, la tuile du menu).

## Spec 07, retour utilisateur : jeu solo, jamais le roi (2026-09-23)

Retour immédiat après la livraison ci-dessus : « le jeu est impossible à
gagner quand on joue le roi en mode difficile et imbattable ». C'est
mathématiquement exact, pas un déséquilibre à ajuster — la table résolue de
`bot.ts` le prouve directement : 6834 positions de départ sur 6900 sont des
victoires FORCÉES pour les tours en jeu parfait (voir l'entrée précédente).
Demander à l'enfant de jouer le camp qui perd d'avance contre un adversaire
parfait n'a pas de sens. Nouvelle demande, claire : jeu solo, on ne joue plus
que les tours, la difficulté (le niveau du roi) monte en crescendo — et
« la difficulté offre au roi la possibilité de choisir le meilleur
déplacement » confirme que l'échelle de niveaux existante (hasard → glouton →
recherche → table parfaite) était déjà la bonne mécanique, seul le choix du
camp jouable posait problème. But explicite, cité tel quel : « montrer le mat
de l'escalier ».

**Conséquence directe, positive** : puisque les tours peuvent TOUJOURS forcer
une capture (même contre le niveau 4), le problème signalé disparaît
entièrement en retirant l'option de jouer le roi — il ne s'agissait pas de
réduire la force du roi, juste de ne plus jamais demander à l'enfant de jouer
le camp perdant d'avance.

**Refonte** : `GameMeta` perd `colorLabels` et `bot` (plus de choix de camp,
plus de mode famille/ordinateur), gagne `soloLevels` (même sélecteur visuel,
mêmes icônes œuf/poussin/poule/coq, `minPlayers`/`maxPlayers` = 1) — même
famille que `sound-memory`/`rhythm-tap`. Effet de bord bienvenu : `soloLevels`
transmet réellement le niveau choisi à `createState` (`GameScreen.tsx` le
fait déjà pour tout jeu solo), ce qui **corrige de fait** l'écart de câblage
documenté ci-dessus (budget et cases contrôlées ne suivaient pas le niveau
choisi contre l'ordinateur) — sans toucher au shell, simplement parce que ce
jeu n'emprunte plus le chemin `bot.level` qui n'était pas câblé, mais le
chemin `soloLevel` qui l'est depuis toujours.

**Le roi doit continuer à jouer tout seul — comment, sans jamais transmettre
son coup au shell ?** Le contrat `GameModule` n'a qu'un seul point d'entrée
pour les coups (`applyMove`, appelé par le shell quand l'enfant tape), et un
jeu solo n'a pas de second joueur (réel ou bot) à qui le shell puisse
proposer un tour. Résolu en faisant jouer le roi *à l'intérieur* du même
`applyMove` que le coup de tour qui vient d'être soumis : une couche
« manche » (`bot.ts`, `roundApplyMove`) applique le coup de tour de l'enfant
via `logic.ts`, puis — si la partie n'est pas gagnée — fait immédiatement
jouer le roi via `chooseMove` (déjà écrit, inchangé), avant de rendre la main.
Du point de vue du contrat, un seul coup a été joué ; du point de vue de
l'écran, les deux moitiés du tour (coup de tour, réponse du roi) sont
visibles au prochain rendu, surlignées séparément (`lastRookMove`/
`lastKingMove`, deux teintes de la même couleur victoire — voir Board.tsx).
`logic.ts` (le moteur à deux camps, le solveur, les tests existants) n'a **pas
changé du tout** : `bot.ts` compose ses fonctions pures depuis l'extérieur,
sans jamais que `logic.ts` importe `bot.ts` en retour (le sens de dépendance
reste à sens unique, pas de cycle) — décision prise après avoir sérieusement
envisagé l'inverse (composite dans `logic.ts`, import de `bot.ts` en retour) ;
un cycle logic.ts↔bot.ts aurait fonctionné techniquement en ESM (les deux
fichiers ne se référencent qu'à l'intérieur de corps de fonctions, jamais à
l'évaluation du module), mais rester à sens unique est plus simple à
raisonner et n'a rien coûté ici.

**Perdre (budget épuisé, ou une tour croquée) ne termine plus la partie —
« sur le modèle piece-quiz » (spec 06)** : plutôt que de forcer `Result` à
représenter une défaite sans second joueur réel à qui l'attribuer (aucun
`winner` valable à renvoyer), un échec relance directement une position
fraîche à la même difficulté (`regenerate`, budget remis à neuf) et le signale
au shell via `GameModule.progressSignal` (`fail: true`, déjà câblé par
GameScreen.tsx depuis spec 06 — son, tremblement, contour rouge, rien à
modifier côté shell). Cohérent avec le but pédagogique : l'enfant reste dans
la boucle d'essai plutôt que de retomber sur un écran de défaite répété.
`getResult` (exposé au contrat) ne devient donc non-null QUE sur une vraie
capture du roi — vérifié explicitement par test (« jouée avec des tours
parfaites, une manche se termine toujours par une vraie victoire, jamais par
un échec », et à l'inverse un coup imprudent scripté déclenche `attempts+1` +
signal `fail` exact, jamais un `Result`).

**Score toujours attribué au joueur unique** (`Result.score.variant` = niveau
choisi, désormais le vrai niveau grâce au correctif de câblage ci-dessus) —
la limitation « pas de score en famille » documentée dans l'entrée précédente
disparaît d'elle-même : il n'y a plus de mode famille du tout pour ce jeu.

**Vérifié en jeu réel** : écran « Qui joue ? » n'affiche plus ni le choix
famille/ordinateur ni « Qui commence ? », juste le profil (présélectionné à
un seul joueur) et le sélecteur NIVEAU — exactement le patron de
`sound-memory`. Au niveau « Le coq », le budget affiché est maintenant
**12/12** dès la première position (preuve visuelle directe que le niveau
choisi atteint bien `createState`, plus jamais 25 par défaut) et aucune case
contrôlée n'est affichée (masquées à partir de la poule, comme prévu) ; au
niveau « L'œuf »/« Le poussin », les cases tenues par les tours restent
visibles. Une manche entière jouée à la main (imparfaitement — j'ai perdu
plusieurs tentatives en exposant une tour par imprudence) a bien déclenché la
relance à chaque échec (budget remis à 12, nouvelle position, aucun écran de
défaite) puis une victoire authentique dans une tentative suivante. Repère de
session à noter : `--force` a été nécessaire une fois sur le serveur `vite`
local pour purger un état de HMR resté incohérent après plusieurs
restructurations successives de `bot.ts`/`index.ts` dans la même session —
pas un bug du jeu (un redémarrage propre a suffi), mais worth remembering si
un menu affiche soudain moins de jeux que prévu en cours de développement.

**Tests** : `logic.test.ts` inchangé (14, toujours valide — le moteur à deux
camps n'a pas bougé). `bot.test.ts` passe de 5 à 9 tests : les anciens
(déterminisme du moteur bas niveau, faisabilité, force des niveaux du roi,
niveau 1 battable) restent tels quels, plus quatre nouveaux pour la couche
manche (déterminisme de la manche, victoire garantie avec des tours
parfaites — jamais de relance —, relance + signal d'échec exact sur un coup
imprudent scripté, rejet d'un coup hors plateau). `npm run build`,
`npm run lint` et `npm test` (236 tests, tout le dépôt) verts.

## Spec 08 — « Le labyrinthe », moteur et partie à deux

**Géométrie des tuiles, dérivée des SVG fournis plutôt que redevinée.** Les
trois fichiers (`idée/tuile/`) encodent chacun un tracé de couloir en plus du
décor de pierre — `tile-straight.svg` : `M50 0 L50 100` (nord/sud à rotation
0) ; `tile-corner.svg` : `M50 0 L50 50 L100 50` (nord puis est) ;
`tile-tee.svg` : ligne horizontale pleine + tronçon vers le bas (est/sud/
ouest, mur au nord). Rotation d'un masque d'ouvertures de 90° = N→E→S→W→N,
vérifié directement contre ces tracés dans `logic.test.ts` plutôt que supposé.
Rendues en `<img>` avec `transform: rotate()`, jamais inlinées (les trois SVG
partagent des `id` de `clipPath` — 49 copies inlinées sur un même plateau se
marcheraient dessus).

**Orientation des 12 T fixes non-coin : un choix de modélisation, pas une
règle du jeu réel.** Les 8 en bord de plateau ont un mur tourné vers le bord
le plus proche (sans ambiguïté). Les 4 tuiles fixes intérieures (au centre de
chaque quadrant) n'ont pas de bord unique à qui faire face ; départagé par la
ligne (haut/bas) plutôt que la colonne, arbitrairement mais
déterministe et symétrique. Purement cosmétique — aucun critère
d'acceptation n'en dépend, et le jeu ne cherche pas à reproduire position par
position un plateau Ravensburger existant.

**Trois modes, une seule génération de plateau.** Le plateau (16 fixes, 33
mobiles + 1 en main, 24 trésors) est généré une fois à `createState`, avant
même que le mode soit choisi — c'est `chooseMode` qui décide ensuite quels
trésors (parmi les 24 déjà posés) deviennent des cibles actives, et dans quel
ordre, via un second flux de hasard salé différemment (`seed ^ 0x2545f491`)
pour ne dépendre d'aucun détail d'ordre de tirage du plateau. Course : 3
trésors tirés, partagés, un par un. Partage : 3×N trésors, une file par
joueur. Solo : 6 trésors, une seule file.

**Règle de victoire du mode course : revue après retour utilisateur, plus de
retour à la maison.** Interprétation initiale (tranchée seule, faute de
précision dans l'énoncé) : une fois les 3 trésors trouvés (par n'importe
quelle combinaison de joueurs), une « course au retour » s'ouvrait à tout le
monde, premier arrivé chez soi gagnant — plus fidèle à l'esprit compétitif
qu'un gagnant figé dès le 3ᵉ trésor, pensait-on. Retour utilisateur : ce
n'est pas ce qui compte, gagner devait dépendre du score (trésors
personnellement ramassés), pas d'une course d'appoint après coup. Revu : la
partie s'arrête l'instant même où le 3ᵉ trésor est distribué (`applyMove`,
branche `state.mode === 'course'`), sans retour à la maison ; le gagnant est
celui qui en a ramassé le plus (`sharedTreasuresWon`, un compteur par siège,
nouveau champ de `MazeState`) — pas forcément celui qui vient de prendre le
dernier. Égalité exacte (possible dès 3 joueurs ou plus, jamais à 2 puisque
3 trésors ne se partagent jamais en deux parts égales) → `kind: 'draw'`,
générique dès maintenant en pensant à quatre. Effet de bord attendu côté
Board.tsx : l'indicatif « il faut rentrer » (icône maison dans l'en-tête,
pulsation de la case de départ) ne doit plus jamais s'afficher en course —
`needsHomeReturn` court-circuite `targetIdForSeat` pour ce mode, gardé tel
quel pour solo/partage où le retour compte toujours. `bot.ts` n'a pas eu
besoin de changer : sa cible de repli « maison une fois la file vide »
devient simplement un chemin mort en course (la partie est déjà terminée à
cet instant), le mode solo/partage qui l'utilise réellement est inchangé —
et les méthodes de test de force existantes (solo apparié, duel réel en
partage) ne dépendaient pas de la règle du mode course, donc rien à
retoucher là non plus.

**Simplification assumée : le ramassage par décalage ne profite qu'au joueur
qui décale.** La règle « un trésor est ramassé en arrivant sur sa tuile, y
compris par un décalage » pourrait en toute rigueur s'appliquer à un pion
adverse entraîné malgré lui sur sa propre cible par le décalage de quelqu'un
d'autre — cas réel en mode partage (chaque joueur a sa propre cible). Vérifié
comme ramassable seulement pour le joueur au trait, jamais pour un adversaire
« porté » involontairement ce tour-ci. Documenté ici plutôt que testé comme
règle du jeu, au cas où un retour utilisateur demande l'inverse.

**L'échelle de niveaux proposée dans la spec ne tient pas — mesuré, pas
supposé, après une session de tuning conséquente.** L'hypothèse de départ
(« à N coups de son but ») suppose qu'on peut compter combien de tours il
faudrait pour atteindre une cible. Deux problèmes, découverts dans cet ordre :

1. *Combinatoire.* Un seul coup ouvre déjà ~44-48 plateaux (fentes légales ×
   rotations). Une vraie recherche à 2 coups doit chiffrer chacun d'eux —
   ~2000 évaluations, encore raisonnable — mais 3 coups explose à ~90 000,
   hors budget, et la spec l'anticipait déjà (« aucune recherche profonde
   n'est nécessaire »).
2. *La distance de couloir choisie comme proxy ne discrimine presque rien.*
   Mesuré directement (script de diagnostic, pas une intuition) : sur un tour
   donné, la distance BFS entre la cible et la meilleure case atteignable
   après UN décalage vaut 0 (cible atteinte) ou l'infini (cible hors de
   portée ce tour-ci) dans l'immense majorité des cas — un seul décalage ne
   restructure jamais assez la connectivité globale pour relier deux zones
   distantes. Utilisée seule, cette distance ne classe donc quasiment aucun
   coup mieux qu'un autre.

**Deux corrections qui n'ont PAS marché, mesurées puis abandonnées :**
- Retomber sur la distance à vol d'oiseau (Manhattan) quand la case n'est pas
  connectée : toujours fini, mais un glouton qui la minimise se dirige vers
  des impasses — ~30 % des parties solo ne se terminaient pas en 300 tours.
- Une vraie recherche à 2 coups (« la case where je pourrai atteindre ma
  cible au tour suivant ») comme FILTRE excluant les autres coups : mesurée
  **moins bonne** qu'un simple glouton en test de force (une case prometteuse
  dans 2 coups n'est presque jamais la même une fois le nouveau décalage et
  la réponse de l'adversaire passés — le filtre écarte souvent le meilleur
  coup immédiat au profit d'une promesse qui ne tient pas).

**Ce qui a marché : retomber sur la taille de la zone atteignable, pas sur
une case précise.** Quand la cible n'est pas connectée, préférer le décalage
qui laisse le plus de cases accessibles (plutôt que viser une case précise
par avance) : mesuré à 100 % de parties solo terminées, largement sous le
PAR — la mobilité est un bien meilleur indicateur que la proximité
géométrique dans un jeu où un seul décalage ne peut pas garantir un chemin.
Un bonus additif (jamais un filtre exclusif) qui regarde le meilleur score
atteignable au tour suivant affine encore ce choix pour les niveaux 3-4, sans
jamais pouvoir écarter le meilleur coup immédiat.

**Découverte la plus contre-intuitive : un bassin de choix plus étroit joue
PLUS MAL, y compris pour les niveaux forts.** Attendu : plus un niveau est
« fort », plus il devrait resserrer son choix vers le strict meilleur coup.
Mesuré, à plusieurs reprises, avec plusieurs métriques différentes : un
niveau qui choisit toujours le meilleur coup unique (aucun hasard au-delà du
départage des égalités) joue *moins bien*, en solo comme en duel, qu'un
niveau qui pioche au hasard parmi une large sélection de bons coups. Cause la
plus probable (observée directement une fois en solo, avant correctif) : sur
ce plateau, plusieurs tuiles sont souvent indiscernables (même forme, même
rotation, pas de trésor), au point qu'un choix toujours déterministe peut
rejouer la même fente indéfiniment sans jamais progresser — un vrai blocage
observé, pas une hypothèse. Retenu : tous les niveaux piochent, y compris le
coq, dans un bassin large (24 des ~44-48 candidats) des meilleurs coups selon
leur métrique — la différence entre niveaux vient de la métrique et du bonus
d'anticipation, jamais de la largeur du bassin.

**Test de force (critère d'acceptation) : méthode revue après mesure, pas
seulement les seuils.** Un vrai duel (les deux niveaux jouent la même partie,
à tour de rôle) a été le premier essai, en mode course. Mesuré : dans ce mode,
gagner tient bien plus au tirage du plateau qu'à la qualité du coup — élargir
ou resserrer la façon dont un niveau vise n'a presque aucun effet sur qui
gagne la course (deux joueurs qui visent la même case partagée finissent par
se neutraliser statistiquement), alors que la même différence de qualité se
voit très nettement en solo (chaque bot joue sa propre partie, sans
interférence d'un adversaire qui vise pareil). D'où, dans `bot.test.ts` :
- Niveaux 1→2 et 2→3 : comparaison **appariée** — sur 200 plateaux de départ
  identiques, quel niveau termine sa quête solo en moins de décalages.
  Jamais un vrai duel entre ces niveaux, jamais fiable pour ce qu'on cherche
  à montrer.
- Niveau 3→4 : vrai duel, mais en mode **partage** (chaque joueur a sa propre
  quête) plutôt qu'en course. C'est le seul endroit où une différence de
  niveau s'est révélée franchement décisive (le coq y bat la poule dans
  l'ordre de 85 % des parties non nulles) : bloquer un adversaire qui allait
  gagner ne coûte rien à sa propre quête indépendante, contrairement au mode
  course où gêner l'adversaire gêne souvent tout autant sa propre route vers
  la même case.

**Chronométrage du tour du coq**, mesuré sur la machine de développement (pas
l'iPad — à revérifier sur l'appareil réel) : ~16,6 ms en moyenne, ~49 ms au
pire sur 200 coups simulés. Un A8X (iPad Air 2, 2015) est très
approximativement 10-20× plus lent en simple thread qu'un PC de développement
récent — extrapolation grossière autour de 150-500 ms, potentiellement à la
limite du budget de 500 ms annoncé dans la spec. À revérifier en conditions
réelles avant de considérer le budget tenu.

**PAR solo laissé à 40 (valeur de départ suggérée par la spec), jamais
resserré.** Test de faisabilité (100 seeds, niveau le plus fort) : 100/100
parties terminées, score positif (donc sous le PAR) dans au moins 90/100 —
largement dans la marge, la moyenne mesurée tourne autour de 25-30 décalages
selon la métrique retenue. Desserrer n'a jamais été nécessaire ; resserrer
n'a pas été tenté (le solo n'était pas la partie fragile de cette spec).

**Mise en page de l'en-tête (tuile en main, bouton Chemin) : compromis
largeur/hauteur pas encore validé sur l'appareil réel.** Le patron existant
(king-hunt, piece-quiz) réserve une bande de hauteur fixe au-dessus d'une
grille qui se recadre en carré — very bien pour une grille 5×5, qui a de la
marge. Sur l'écran étroit de l'iPhone, chaque pixel de hauteur réservée est un
pixel de LARGEUR perdu pour la grille 7×7 une fois recadrée en carré : une
bande de 64 px ramène des cases d'environ 49 px (calcul de la spec, grille
pleine largeur) à environ 40-42 px. Choisi : bande compacte (64 px) plutôt
que la ~90 px qu'un vrai gros pavé « tuile + bouton » aurait demandé, et zones
tactiles du bouton/tuile élargies par le remplissage du bouton plutôt que par
l'image — reste un compromis à confirmer les doigts sur l'écran, pas une
certitude de conception.

**Vérifié en navigateur (pas encore sur iPad/iPhone réels) :** partie solo
jouée à la main jusqu'à plusieurs tours (rotation, choix de fente avec
aperçu, fente interdite visiblement grisée, tuile expulsée devenant la
nouvelle tuile en main, ramassage de trésor) ; écran de sélection de mode
filtré par nombre de sièges (1 → solo seul, 2 → course/partage seuls) ;
écran de répartition (mode partage) qui révèle les trésors un par un avant de
rendre la main ; une manche contre l'ordinateur (niveau le plus fort) où le
coup du bot s'enchaîne automatiquement sans erreur console. Aucune des trois
animations décrites dans la spec (décalage visible, pion qui parcourt son
chemin case par case) n'est implémentée pour l'instant — le plateau se
redessine directement dans son état final, sans transition. Traité comme un
raffinement pour après le premier essai réel, pas un blocage : rien dans le
contrat ni les critères d'acceptation n'exige l'animation elle-même, seulement
que le décalage « se voie ».

**Icônes de trésors non attribuées**, comme les trois autres lots Flaticon
déjà vendorisés (voir ARCHITECTURE.md §10) — `src/vendor/maze-treasures/
LICENSE.md` porte la même mention « à compléter » que les autres.

**Tests** : `logic.ts` (18 tests — géométrie des tuiles contre les tracés SVG,
décalage dans les quatre sens avec réapparition en bordure, tuile expulsée
devenant la tuile en main, fente de retour immédiat interdite, connectivité
BFS sur un plateau connu, ramassage par déplacement et par décalage, victoire
refusée avant le retour à la maison, cohérence du plateau sur 500 seeds,
pureté d'`applyMove` sur un state gelé) et `bot.ts` (6 tests — déterminisme,
force des niveaux selon la méthode ci-dessus, faisabilité solo sur 100
seeds). `npm run build`, `npm run lint` et `npm test` (260 tests, tout le
dépôt) verts. `git diff` hors `src/games/maze/`, `src/vendor/maze-*/` et la
ligne de `registry.ts` : vide.
