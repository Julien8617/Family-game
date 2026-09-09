# Architecture

## 1. Objectif

Une PWA de jeux familiale, installée sur l'écran d'accueil — iPad familial et
iPhone personnel à égalité — qui fonctionne indéfiniment sans réseau. Elle
accueille des jeux ajoutés un par un, garde les profils des joueurs avec leur
photo, et pourra plus tard faire jouer deux appareils ensemble.

La contrainte structurante n'est pas la difficulté d'un jeu en particulier : c'est que
le dixième jeu doit coûter aussi peu que le deuxième. Toute l'architecture découle de
là.

## 2. Format de livraison

PWA installée depuis l'écran d'accueil, servie une fois en HTTPS (GitHub Pages),
puis mise en cache intégralement par le service worker.

Deux raisons de passer par l'installation plutôt qu'un onglet Safari :

- Mode plein écran, sans barre d'URL — indispensable avec des enfants.
- Safari purge le stockage local des sites simplement visités après sept jours
  d'inactivité. Une PWA installée y échappe. Sans ça, les photos et les scores
  disparaissent pendant les vacances.

Le manifest verrouille `display: fullscreen` et `orientation: portrait` — sur
les deux appareils. L'iPad tournait en paysage jusqu'à la spec 04 ; le passage
en portrait (pour être jouable à égalité sur iPhone) l'annule volontairement,
décision confirmée explicitement par l'utilisateur malgré tout le travail déjà
validé en paysage — voir `CLAUDE.md`, table « Cible matérielle ».

## 3. Arborescence

```
src/
  shell/
    App.tsx              routeur d'écrans (menu → joueurs → sélection → partie → résultat)
                          porte aussi lossStreak (défaites d'affilée face au
                          bot), transmis à travers les rejouées pour adoucir
                          discrètement un niveau — voir §4, GameModule.bot
    MenuScreen.tsx       grille des jeux disponibles
    PlayerPickScreen.tsx sélection des joueurs, mode famille/ordinateur,
                          niveau de bot, écran « qui commence » — générique,
                          ne connaît aucune règle de jeu
    GameScreen.tsx       hôte de partie : détient l'état, valide, applique,
                          orchestre le bot (délai minimum, budget d'affichage)
    ResultScreen.tsx     fin de partie, confettis, rejouer
    bot.ts               createBotPlayer() — adversaire artificiel comme un
                          Player normal (photo = icône du niveau), jamais
                          persisté dans le stockage des joueurs
    settings-icon.svg    icône du bouton discret vers l'écran Joueurs

  players/
    types.ts             Player
    palette.ts           8 couleurs de profil (exclut la couleur victory)
    photo.ts             chargement + recadrage (carré, repositionnable, zoomable) en 200 px
    avatars.ts           20 avatars au choix, en data URI (voir src/vendor/avatars/)
    defaultAvatar.ts     avatar par défaut (data URI pré-encodée) quand le
                          joueur ne choisit ni photo ni avatar — le choix est
                          facultatif, pas un champ vide à gérer en aval
    PhotoCropper.tsx      glisser pour recentrer, curseur de zoom ×1–×3
    PlayerEditor.tsx     création et modification d'un profil (photo ou avatar)
    PlayerListScreen.tsx liste des profils + interrupteur son + repère de version

  storage/
    index.ts              SEUL point d'accès à localStorage (joueurs + réglages, versionnés séparément)

  games/
    types.ts             GameModule, contrats partagés (voir §4)
    registry.ts          liste des jeux — la seule ligne à toucher pour en ajouter un
    tictactoe/
      logic.ts           pur, testé, sans React
      Board.tsx          rendu, émission d'intentions, ligne gagnante
      bot.ts             3 niveaux (facile/moyen/imbattable — minimax
                          exhaustif) + adjustLevel (adoucissement discret)
      index.ts           assemble le GameModule
      logic.test.ts, bot.test.ts
    chess-race/           « la course des poussins » — pions, avance +
                           prise en diagonale, arrivée sur la rangée adverse
      logic.ts           pur, testé, sans React
      Board.tsx          plateau 8×8, orientation fixe pour toute la partie,
                          pièces du camp éloigné tournées à 180° en famille
      Pawn.tsx            silhouette de pion, skin calculé (voir pawnSkin.ts)
      pawnSkin.ts         couleur du pion = couleur de profil du joueur, pas
                          un blanc/noir fixe (revirement documenté, NOTES.md)
      bot.ts              4 niveaux, negamax alpha-bêta ; le niveau 4 est la
                          seule fonction qui lit l'horloge (budget 500 ms)
      index.ts, icon.svg
      logic.test.ts, bot.test.ts

  net/
    transport.ts         interface Transport
    localTransport.ts    boucle immédiate, un seul appareil
    webrtcTransport.ts   phase 3, RTCDataChannel — pas encore construit

  fx/
    sound.ts             ZzFX, déblocage AudioContext, table des sons
    confetti.ts          canvas-confetti, réglages économes

  vendor/                dépendances et assets copiés localement, jamais de CDN
    zzfx.js, zzfx.d.ts, confetti.js, confetti.d.ts, LICENSES.md
    avatars/               20 SVG OpenMoji + LICENSE.md
    chess-race-levels/     GIF animés (icônes de niveau, réutilisées par les
                            deux jeux à bot) + LICENSE.md
    default-avatar/        PNG de l'avatar par défaut + LICENSE.md
    mode-icons/             PNG famille/ordinateur (écran « qui joue ? ») + LICENSE.md
                            (les 3 LICENSE.md Flaticon ci-dessus ont encore
                            une attribution exacte à compléter)

  pwa.ts                 enregistrement manuel du service worker (revérifie
                          une mise à jour au retour au premier plan — voir NOTES.md)
```

## 4. Le contrat de jeu

C'est la frontière centrale. Le shell ne sait rien des règles ; un jeu ne sait rien
du shell, des joueurs réels, ni du transport.

```ts
// games/types.ts

export type PlayerId = string;

export type Result =
  | { kind: 'win'; winner: PlayerId }
  | { kind: 'draw' };

export interface GameMeta {
  id: string;              // stable, sert de clé de stockage
  title: string;           // affiché en français
  icon: string;            // chemin vers un SVG local
  minPlayers: number;
  maxPlayers: number;
  supportsRemote: boolean; // le shell masque le mode deux iPads si false
  // Facultatif : un jeu à deux joueurs où l'ordre compte (qui commence,
  // quel « camp ») propose un libellé par place. Déclenche l'écran « qui
  // commence » dans PlayerPickScreen et le mode dualSided de GameScreen
  // (repères de tour dupliqués haut/bas, pour deux joueurs assis de part et
  // d'autre d'un même appareil). Le shell ne sait toujours pas pourquoi
  // l'ordre compte pour ce jeu en particulier.
  colorLabels?: [string, string];
}

export interface BoardProps<S, M> {
  state: S;
  localPlayer: PlayerId;   // qui tient cet appareil (stable pour la partie,
                            // pas le joueur au trait — voir GameScreen)
  players: Player[];       // pour afficher photos et prénoms
  sharedDevice: boolean;   // plusieurs humains partagent cet appareil pour
                            // cette partie — un jeu à camps orientés peut
                            // s'en servir pour présenter chaque camp face à
                            // son joueur sans jamais faire pivoter le plateau
  onMove(move: M): void;   // émettre une intention, rien d'autre
}

export interface BotLevel {
  id: number;
  label: string;           // pas affiché dans le sélecteur (icône seule),
                            // mais utilisé comme nom du bot ailleurs (barre
                            // de tour, écran de résultat) et en aria-label
  icon: string;
  animatedIcon?: string;    // affichée à la place de `icon` seulement
                            // pendant que ce niveau est sélectionné — jamais
                            // toute seule (« rien ne bouge tout seul »)
}

export interface GameModule<S, M> {
  meta: GameMeta;

  createState(players: PlayerId[], seed: number): S;
  isValidMove(state: S, move: M): boolean;
  applyMove(state: S, move: M): S;
  currentPlayer(state: S): PlayerId | null;
  getResult(state: S): Result | null;   // null tant que la partie continue

  Board: React.ComponentType<BoardProps<S, M>>;

  // Facultatif : un jeu qui propose un adversaire artificiel connaît ses
  // propres règles, donc tout ce qui suit vit ici, jamais dans le shell.
  bot?: {
    levels: BotLevel[];
    chooseMove(state: S, level: number): M;
    // Facultatif : adoucit discrètement le niveau réellement joué en
    // fonction de la série de défaites d'affilée du joueur humain face au
    // niveau choisi (`selectedLevel`) — sans jamais changer ce qui est
    // affiché dans le sélecteur. Le shell appelle toujours cette fonction
    // si elle existe ; la règle d'ajustement reste propre au jeu.
    adjustLevel?(selectedLevel: number, lossStreak: number): number;
  };
}
```

### Les invariants

1. `applyMove` est pure. Même entrée, même sortie, toujours. Pas de mutation de
   `state`, pas de DOM, pas d'horloge, pas de `Math.random()`.
2. `S` est intégralement sérialisable en JSON. C'est ce qui permettra de l'envoyer sur
   le réseau, de sauvegarder une partie en cours, et de rejouer un historique.
3. Le `seed` est rangé dans `S` dès la création, même pour un jeu sans hasard. Le jour
   où tu ajoutes un jeu de dés, le générateur seedé est déjà en place et les deux
   appareils restent synchronisés.
4. `Board` n'appelle jamais `applyMove`. Il rend `state` et appelle `onMove`.
5. `logic.ts` n'importe rien de React. Vérifiable mécaniquement, et c'est la garantie
   que la logique tourne aussi bien dans un test que derrière un `RTCDataChannel`.
6. `bot.chooseMove` est pure et déterministe, comme `applyMove` — même `state`
   et même `level`, même coup. Si le niveau le plus fort a besoin d'un vrai
   budget de temps réel (recherche à profondeur croissante), c'est une
   fonction séparée, seule autorisée à lire l'horloge, qui appelle
   `chooseMove`/une fonction de recherche pure plusieurs fois plutôt que d'en
   interrompre une en cours (voir `chess-race/bot.ts`, `iterativeDeepen` vs
   `searchBestMove`). Sans ça, les tests de force et de non-régression ne
   peuvent pas rejouer une partie à l'identique.

### Le registre

```ts
// games/registry.ts
import { ticTacToe } from './tictactoe';
import { chessRace } from './chess-race';

export const GAMES: GameModule<any, any>[] = [
  ticTacToe,
  chessRace,
];
```

Ajouter un jeu : un dossier, un import, une ligne. Le menu se construit à partir de
`GAMES`, et la sélection de joueurs lit `minPlayers` / `maxPlayers`. Aucun autre
fichier du shell ne bouge — confirmé deux fois maintenant : l'ajout de
`chess-race` (spec 04) puis celui d'un bot sur `tictactoe` derrière le même
contrat `GameModule.bot` n'ont touché aucun fichier de `shell/` en dehors de
ce registre.

### La boucle de partie

`GameScreen` détient l'état et fait tourner la boucle :

```
Board émet une intention
  → transport.send(move)
  → à la réception : isValidMove ? applyMove : ignorer
  → nouvel état → getResult
      null   → on continue, currentPlayer suivant
      Result → écran de résultat, confettis
```

En solo, le transport renvoie le coup immédiatement. En réseau, il passe par le
canal de données. `GameScreen` ne fait pas la différence.

## 5. Joueurs et stockage

```ts
export interface Player {
  id: PlayerId;            // crypto.randomUUID()
  name: string;            // « Papa », « Maman », prénom
  photo: string;           // data URL, 200×200 — vraie photo, avatar
                            // choisi, ou avatar par défaut (jamais vide :
                            // choisir une photo/un avatar est facultatif à
                            // la création, pas ce champ)
  color: string;           // couleur assignée, utilisée par les jeux
}
```

Stockage dans `localStorage`, sous deux clés (`src/storage/index.ts`) :

- `players` — le tableau des profils
- `settings` — réglages (son activé, dernier niveau de bot choisi...),
  fusionné avec les valeurs par défaut à la lecture pour qu'un champ ajouté
  après coup n'invalide pas un réglage déjà stocké

Pas de clé `scores` : le palmarès n'a jamais été construit (toujours en
§10, points à trancher plus tard).

Le quota est de 5 Mo environ, et il est partagé. Une photo iPad brute pèse plusieurs
mégaoctets : le redimensionnement en canvas avant sérialisation n'est pas une
optimisation, c'est une condition de fonctionnement. Quatre profils à 200 px tiennent
dans quelques dizaines de kilo-octets.

`storage.ts` est le seul module qui touche `localStorage`. Le jour où le volume impose
un passage à IndexedDB, un seul fichier change.

## 6. Deux appareils — préparé maintenant, branché plus tard

La couche transport existe dès la phase 1, avec une seule implémentation.

```ts
// net/transport.ts
export interface Transport {
  send(move: unknown): void;
  onMove(handler: (move: unknown) => void): () => void;
  close(): void;
}
```

`localTransport` renvoie simplement le coup à l'appelant. Tant que cette interface est
respectée, l'ajout du réseau ne touche ni les jeux ni le shell.

### Quand ça vaudra le coup

Le morpion ne gagne rien à deux écrans — on se passe l'iPad. Le réseau apporte quelque
chose d'irremplaçable pour une seule classe de jeux : **ceux où chaque joueur détient
une information privée**. Bataille navale, jeux de cartes avec une main cachée, jeux de
dessin où l'un devine. C'est le critère qui déclenche la phase 3, pas l'envie technique.

### Deux voies possibles

**Serveur local sur le Raspberry Pi.** Le Pi sert la PWA et arbitre les parties par
WebSocket. Simple à écrire, facile à déboguer. Deux réserves : ça ne marche plus hors
de la maison, et il faut un certificat valide, sinon une PWA installée depuis GitHub
Pages ne pourra pas ouvrir de WebSocket vers le Pi (contenu mixte bloqué). Soit tout
est servi depuis le Pi, soit certificat auto-signé installé en profil de confiance sur
les iPads.

**WebRTC en pair-à-pair, sans serveur.** Sur un réseau local, les candidats ICE locaux
suffisent : ni STUN, ni TURN, ni internet. Reste la poignée de main initiale, qui se
règle en affichant l'offre SDP compressée sous forme de QR code que l'autre appareil
scanne. Le bug caméra des PWA installées sous iOS 12 est corrigé depuis longtemps en
15.8, donc c'est jouable. Précédents à étudier : `yougikou/offline-cards`,
`dcerisano/serverless-webrtc-qrcode`.

L'astuce mDNS sans signaling du tout est morte, les navigateurs ayant bloqué la
modification des identifiants ICE.

Décision : la voie B préserve seule la promesse « fonctionne partout, en mode avion ».
À trancher au moment de la phase 3, pas avant.

## 7. Son et effets

**ZzFX** pour les effets. Moins d'un kilo-octet, MIT, sons décrits en une ligne de
paramètres, aucun fichier audio à mettre en cache. Table centralisée dans
`fx/sound.ts` : pion posé, coup invalide, tour qui passe, victoire, égalité.

L'`AudioContext` reste muet tant qu'il n'y a pas eu de vraie interaction tactile. Il
est débloqué au premier tap sur le menu, pas au chargement.

**canvas-confetti** pour la victoire. Sur un A8X, baisser `particleCount` autour de
80 et activer `disableForReducedMotion`.

## 8. Feuille de route

**Phase 1 — le squelette qui tient** ✅ livré, validé sur iPad réel (2026-09-06)
Shell, profils avec photos, registre, morpion complet, transport local, son, confettis.

**Phase 2 — la preuve de la frontière** ✅ livré
Deuxième jeu ajouté : « la course des poussins » (dames-échecs simplifié), pas
puissance 4 comme envisagé initialement — décision prise en cours de route,
sans conséquence sur le critère de sortie. Aucune modification du shell en
dehors d'une ligne dans `registry.ts`. Confirmé une seconde fois par
l'ajout d'un adversaire artificiel (`GameModule.bot`, facultatif) sur les
deux jeux, et par la réutilisation telle quelle de `colorLabels` (écran
« qui commence ») sur le morpion — le contrat tient au-delà d'un seul jeu.

**Phase 2.5 — adversaire artificiel et confort d'usage** ✅ livré
Contrat `GameModule.bot` (niveaux, `chooseMove`, `adjustLevel` facultatif),
adversaire artificiel sur les deux jeux, adoucissement discret de la
difficulté du morpion après une série de défaites, avatar par défaut
(photo/avatar facultatifs à la création d'un profil), passage à égalité
iPad/iPhone en portrait. Non prévu à l'origine, construit spec par spec au
fil des demandes plutôt qu'annoncé à l'avance.

**Phase 3 — deux appareils**
Seulement si un jeu à information cachée le justifie. Implémenter `webrtcTransport`
derrière l'interface existante. Pas commencé.

## 9. Décisions verrouillées

- Tailwind v3, jamais v4, tant que l'iPad Air 2 est une cible.
- `build.target: 'safari15'`.
- Aucun backend, aucun appel réseau à l'exécution.
- Toutes les dépendances vendorisées dans `src/vendor/`.
- La logique de jeu (`applyMove`) et le choix du bot (`chooseMove`) sont
  purs et testés sans navigateur.
- Un seul module accède à `localStorage`.
- Portrait verrouillé sur les deux appareils cibles (iPad Air 2 **et**
  iPhone X, à égalité) — revirement conscient sur l'iPad, voir §1/§2 et
  `CLAUDE.md`.

## 10. Points à trancher plus tard

- Sauvegarde d'une partie en cours (l'état est déjà sérialisable, c'est du travail
  d'interface, pas d'architecture).
- Palmarès : compteur simple ou historique complet des parties.
- Voie A ou voie B pour le multi-appareils.
- Attribution exacte (auteur/pack, lien) à compléter dans les 3 `LICENSE.md`
  Flaticon (`chess-race-levels/`, `default-avatar/`, `mode-icons/`) avant
  toute publication qui l'exigerait formellement.
