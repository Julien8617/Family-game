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
