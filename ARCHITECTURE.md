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
    ResultScreen.tsx     fin de partie, confettis, rejouer ; affiche aussi un
                          score générique (valeur + meilleur) si
                          result.score est défini, voir §4
    bot.ts               createBotPlayer() — adversaire artificiel comme un
                          Player normal (photo = icône du niveau), jamais
                          persisté dans le stockage des joueurs
    palmRejection.ts     installPalmRejection() — écouteur touchstart global
                          (capture) qui bloque un toucher de la taille d'une
                          paume (Touch.radiusX/radiusY, extension WebKit) ;
                          activé par défaut, interrupteur de secours sur
                          l'écran Joueurs — voir NOTES.md pour la calibration
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
    PlayerListScreen.tsx liste des profils + interrupteur son + interrupteur
                          rejet de la paume + repère de version

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
    connect4/              « puissance 4 » — plateau à trous sur panneau
                           sombre, jeton qui tombe avec un petit rebond
      logic.ts           pur, testé, sans React
      Board.tsx          grille décorative (trous + jetons, aria-hidden) +
                          grille de cases tactiles séparée, une pleine
                          hauteur par colonne (voir NOTES.md — un enfant qui
                          vise mal a besoin de plus qu'une case de ~42 px)
      bot.ts              4 niveaux, negamax alpha-bêta ; le niveau 4 ne
                          cherche jamais moins bien que le niveau 3 *par
                          construction* (même profondeur fixe partout, sauf
                          en toute fin de partie où il résout à fond — pas
                          d'approfondissement itératif classique ici, voir
                          NOTES.md pour la pathologie de recherche rencontrée)
      index.ts, icon.svg
      logic.test.ts, bot.test.ts
    sound-memory/          « mémoire sonore » — premier jeu solo (pas
                           d'adversaire), un pad lumineux/sonore par couleur,
                           séquence à répéter, difficulté = nombre de pads
      logic.ts           pur, testé, sans React ; le nombre de pads (2/4/6/8)
                          se choisit dans une phase 'setup' interne à l'état
                          du jeu, pas dans le shell
      Board.tsx           lecture de la séquence par timers locaux (aucun
                          appel à applyMove pendant l'animation), une seule
                          intention émise en fin de lecture (`sequenceShown`)
      padColors.ts        8 teintes propres au jeu, distinctes de
                          PLAYER_COLORS (players/palette.ts)
      index.ts, icon.svg
      logic.test.ts
    piece-quiz/            « Où va-t-elle ? » — cent niveaux pour apprendre
                            le déplacement des pièces d'échecs, seul jeu qui
                            s'appuie sur src/chess/ (voir plus bas)
      generate.ts          pur, testé, sans React : génère les questions d'un
                            niveau (QUESTIONS_PER_LEVEL, 3), déterministe à
                            partir du seed et du numéro de niveau — rejection
                            sampling sur un prédicat unique (isValidQuestion),
                            jamais de cases attendues recalculées à la main ;
                            plateau 5×5 pour les cent niveaux (retour
                            utilisateur : 8×8 sur Moyen/Difficile était trop
                            grand, la pièce n'y croisait presque jamais
                            d'obstacle, voir NOTES.md)
      logic.ts             pur, testé ; jeu continu — un niveau réussi ou
                            raté s'enchaîne directement sur le suivant en
                            interne (applyMove), jamais via Result (qui ne
                            sert plus qu'au niveau 100 réussi, state.finished)
                            ; progression par palier (facile/moyen/
                            difficile), reprise automatique au prochain
                            niveau à réussir (voir §5) ; expose
                            progressSignal (voir §4)
      Board.tsx             rendu, plateau 5×5 ; numéro de niveau + icône de
                            palier dans une bande réservée au-dessus du
                            damier (pas en survol : chevauchait la pièce
                            interrogée quand elle tombait rangée du haut,
                            voir NOTES.md) ; validation et choix du palier en
                            boutons flottants (position fixed) par-dessus
                            l'écran, pas dans le carré du plateau — voir
                            NOTES.md
      ChessPiece.tsx        rendu React des silhouettes de chess/shapes.ts,
                            couleur via chess/skin.ts
      index.ts, icon.svg
      logic.test.ts, generate.test.ts
    king-hunt/              « la chasse au roi » — deux tours traquent un roi
                            sur 5×5 avec un budget de coups, la finale
                            « deux tours contre roi seul » réduite à
                            l'essentiel (spec 07)
      logic.ts             pur, testé ; déplacements délégués à
                            src/chess/ (reachableSquares) ; budget décompté
                            uniquement aux coups des tours ; position de
                            départ tirée par rejet (roi jamais adjacent ni
                            attaquable au premier coup, garantie vérifiée par
                            balayage exhaustif, voir NOTES.md)
      bot.ts                pur, quatre niveaux ; le niveau 4 résout la
                            finale EXACTEMENT par induction arrière (table
                            mémoïsée, ~14 000 positions sur 5×5) plutôt qu'une
                            recherche approchée — voir NOTES.md pour la
                            preuve que toute position de départ générée est
                            gagnante pour les tours ; chooseMove générique sur
                            le camp au trait, joue aussi bien les tours que
                            le roi (colorLabels rend les deux camps
                            jouables contre l'ordinateur)
      ChessPiece.tsx        copie volontaire de piece-quiz/ChessPiece.tsx
                            (dossiers de jeux distincts, voir NOTES.md) —
                            mêmes silhouettes/skins de src/chess/, inchangées
      Board.tsx             rendu 5×5, rangée de budget (bande réservée,
                            même technique que le repère de niveau de
                            piece-quiz), cases contrôlées par les tours
                            (niveaux 1-2 seulement) en petit point dans la
                            couleur des tours
      index.ts, icon.svg
      logic.test.ts, bot.test.ts
    rhythm-tap/             « Tape avec moi » — premier jeu du groupe
                            « musique » (GameMeta.groupId), premier jeu de
                            rythme, solo comme sound-memory
      logic.ts            pur, testé, sans React ; reçoit { atBeat } déjà
                           corrigé de l'offset de calibration, classe le tap
                           (avance/à l'heure/retard) contre la grille des
                           temps de la mélodie choisie au seed
      Board.tsx            tient l'ordonnanceur (solfege/audio.ts), lit
                            l'horloge, convertit chaque tap en position
                            musicale ; calibration obligatoire affichée en
                            phase interne si aucun offset n'est enregistré
      index.ts, icon.svg
      logic.test.ts

  chess/                  socle échecs — pas un jeu, le shell ne le connaît
                           pas ; sert à piece-quiz, et servira aux futurs
                           jeux d'échecs (chess-race n'est pas migré dessus,
                           dette assumée, voir NOTES.md)
    geometry.ts             pur, testé : coordonnées paramétrées par la
                            taille du plateau (5×5 ou 8×8)
    pieces.ts               pur, testé : les six pièces, cases accessibles
                            (reachableSquares), double pas et prise en
                            passant derrière des options explicites,
                            désactivées par défaut
    attacks.ts              pur, testé : cases attaquées par un camp
                            (attackedSquares) — sert uniquement à garantir
                            qu'un roi interrogé n'est jamais en échec
    shapes.ts                données pures (pas de JSX) : silhouettes des
                            six pièces, un composant de rendu séparé les
                            transforme en SVG (piece-quiz/ChessPiece.tsx)
    skin.ts                  pur : couleur d'une pièce par camp — profil du
                            joueur pour 'own' (table dupliquée depuis
                            chess-race/pawnSkin.ts, voir NOTES.md), gris
                            neutre fixe pour 'enemy'

  solfege/                socle musical — pas un jeu, le shell ne le connaît
                           pas ; les jeux de musique s'en servent
    music.ts               pur, testé : noms latins (do ré mi fa sol la si,
                            sans accent en code), conversion nom ↔ fréquence
                            sur une octave, bibliothèque de 4 comptines du
                            domaine public encodées en notes (hauteur + durée
                            en temps, pas en ms)
    schedule.ts             pur, testé : instants absolus d'une mélodie à
                            partir d'un tempo et d'un instant de départ, et
                            l'ordonnanceur générique à lookahead (horloge et
                            émission injectables — testable sans navigateur)
    audio.ts                moteur réel : branche schedule.ts sur
                            l'AudioContext partagé (fx/audio-context.ts),
                            synthèse par oscillateur (aucun échantillon),
                            arrêt propre sur passage en arrière-plan
    calibration.ts           mesure du décalage tactile : médiane robuste des
                            écarts sur 8 taps (2 premiers ignorés), persistée
                            via storage/index.ts (propriété d'appareil, pas de
                            joueur)
    CalibrationScreen.tsx    écran partagé, utilisé à la fois comme route
                            depuis l'écran Joueurs et embarqué dans
                            rhythm-tap/Board.tsx

  net/
    transport.ts         interface Transport
    localTransport.ts    boucle immédiate, un seul appareil
    webrtcTransport.ts   phase 3, RTCDataChannel — pas encore construit

  fx/
    audio-context.ts     seul propriétaire de l'AudioContext pour toute
                          l'app (création paresseuse, déblocage unique) —
                          ZzFX et le moteur musical (solfege/audio.ts) s'y
                          branchent tous les deux, jamais un second contexte
    sound.ts             ZzFX, table des sons
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
  | {
      kind: 'win';
      winner: PlayerId;
      // Facultatif : un jeu solo à score (pas de vraie « victoire » contre un
      // autre joueur) rapporte sa manche ainsi, `winner` désignant alors
      // simplement le joueur dont c'est le score. `variant` distingue des
      // scores qui n'ont pas le même sens (ex. difficulté différente) — clé
      // opaque pour le shell, qui s'en sert uniquement pour ranger le
      // meilleur score par (jeu, joueur, variant), voir §5 et
      // storage/index.ts.
      score?: { value: number; variant?: string };
    }
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
  // Facultatif : un jeu solo (sans adversaire artificiel) qui propose un
  // réglage à choisir avant la partie (ex. une vitesse) réutilise le même
  // sélecteur visuel « NIVEAU » que game.bot.levels, sans mode « contre
  // l'ordinateur » ni chooseMove. Le niveau choisi est transmis tel quel à
  // createState (3ᵉ paramètre) ; le shell ne sait pas ce qu'il signifie.
  soloLevels?: BotLevel[];
  // Facultatif : identifiant d'un groupe déclaré dans games/registry.ts
  // (GAME_GROUPS). Le shell regroupe les jeux qui le partagent sous une
  // tuile de sous-menu dans MenuScreen, sans savoir ce que le groupe
  // représente — un jeu sans groupId s'affiche exactement comme avant.
  groupId?: string;
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

  // `options` porte le niveau choisi via GameMeta.soloLevels (facultatif) —
  // un jeu sans soloLevels ignore ce 3ᵉ paramètre sans rien changer à sa
  // signature (players, seed). `bestScores` (spec 06, piece-quiz) : les
  // records déjà enregistrés pour (ce jeu, ce joueur), un par variant — clé
  // opaque pour le shell (storage/index.ts, getAllHighScores), qui la lit et
  // la transmet sans savoir ce qu'un variant signifie. Sert à un jeu qui a
  // besoin de reprendre sa progression dès createState (piece-quiz : quel
  // niveau rejouer) plutôt que de la recalculer ailleurs.
  createState(
    players: PlayerId[],
    seed: number,
    options?: { level?: number; bestScores?: Record<string, number> },
  ): S;
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

  // Facultatif (spec 06) : un jeu qui doit persister sa progression plus
  // souvent qu'à la fin de partie (Result ne suffit plus pour un jeu continu
  // qui ne s'arrête presque jamais, voir piece-quiz), et/ou déclencher un
  // effet transitoire (fête, échec) à certaines transitions, le renvoie ici.
  // Le shell l'appelle une fois après chaque applyMove accepté (prev = état
  // avant, next = état après) — pure, comme applyMove — et agit sur ce qui
  // revient (écrit les scores comme Result.score, joue l'effet nommé) sans
  // savoir ce que le jeu appelle un « niveau » ou une « réussite ».
  progressSignal?(prev: S, next: S): ProgressSignal | null;
}

export interface ProgressSignal {
  player: PlayerId;
  // Meilleurs scores à écrire tout de suite, un par variant — même règle que
  // Result.score : le shell ne garde que le maximum, jamais une régression.
  scores?: Record<string, number>;
  // Effet transitoire positif (confettis + son de victoire + petit écran de
  // fête avec ce texte, affiché tel quel par le shell).
  celebrate?: { label: string };
  // Effet transitoire négatif (son d'échec, tremblement, contour rouge).
  fail?: boolean;
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
import { connect4 } from './connect4';
import { kingHunt } from './king-hunt';
import { rhythmTap } from './rhythm-tap';
import { soundMemory } from './sound-memory';

export const GAMES: GameModule<any, any>[] = [
  ticTacToe,
  chessRace,
  connect4,
  soundMemory,
  rhythmTap,
  pieceQuiz,
  kingHunt,
];

export const GAME_GROUPS: Record<string, { title: string; icon: string }> = {
  music: { title: 'Musique', icon: musicGroupIcon },
};
```

Ajouter un jeu : un dossier, un import, une ligne. Le menu se construit à partir de
`GAMES`, et la sélection de joueurs lit `minPlayers` / `maxPlayers`. Aucun autre
fichier du shell ne bouge — confirmé sept fois maintenant : l'ajout de
`chess-race` (spec 04), puis celui d'un bot sur `tictactoe` derrière le même
contrat `GameModule.bot`, puis l'ajout de `connect4`, puis celui de
`sound-memory` (premier jeu sans `bot` du tout), puis celui de `rhythm-tap`
(spec 05, premier jeu regroupé), puis celui de `piece-quiz` (spec 06), puis
celui de `king-hunt` (spec 07, premier jeu à réutiliser `colorLabels` +
`bot` ensemble pour rendre DEUX camps jouables contre l'ordinateur sans
aucune extension du contrat) n'ont touché aucun fichier de `shell/` en dehors
de ce registre, de `MenuScreen.tsx` (extension additive et générique, voir
plus bas) et de `GameScreen.tsx` (hissage de `localPlayer` avant
`createState`, pour `bestScores`, voir §4).
`sound-memory` avait demandé deux extensions additives du contrat lui-même
(`soloLevels`, `Result.score`) ; `rhythm-tap` n'en a demandé qu'une
(`GameMeta.groupId`) ; `piece-quiz` en a demandé deux (`createState
options.bestScores`, puis `GameModule.progressSignal` pour le jeu continu et
ses effets transitoires — spec 06, retour utilisateur) — pas une exception à
la règle, juste le contrat qui grandit, voir §4. `king-hunt` n'en a demandé
aucune, mais a buté sur une limite réelle du câblage existant plutôt que du
contrat lui-même : `GameScreen.tsx` ne transmet jamais le niveau de bot
choisi à `createState` (seul `options.level` de `soloLevels` y arrive
aujourd'hui) — `king-hunt` s'en accommode avec un niveau par défaut sûr
plutôt que de toucher `GameScreen.tsx`, voir NOTES.md pour le détail et la
ligne de correctif proposée mais pas appliquée.

`GAME_GROUPS` est une table à côté de `GAMES`, pas dans le contrat : un jeu
avec `groupId: 'music'` est regroupé sous la tuile « Musique » dans
`MenuScreen`, qui affiche alors un sous-menu (mêmes tuiles, un bouton
« Retour » comme partout ailleurs) plutôt que la grille plate habituelle. État
(quel sous-menu est ouvert) tenu localement dans `MenuScreen`, aucun ajout à
`Screen` dans `App.tsx` — c'est une fonctionnalité de menu, pas une règle de
jeu qui remonte dans le shell.

### Présélection des joueurs, mémorisée par jeu

`PlayerPickScreen` présélectionne les joueurs à l'ouverture plutôt que de
partir d'un écran vide, sans jamais verrouiller le choix (les boutons restent
utilisables normalement ensuite) :

- **Un seul profil enregistré** : toujours présélectionné (mode « ordinateur »
  en plus si `game.bot` existe) — généralisation de ce qui n'existait
  jusqu'ici que pour les jeux à bot.
- **Plusieurs profils** : reprend l'équipe (et le mode) de la dernière partie
  de *ce* jeu — `settings.lastPlayers`, une entrée par `game.meta.id`, jamais
  un champ plat partagé entre tous les jeux (Alice+Bob au morpion n'a aucune
  raison de présélectionner la même paire à la course des poussins). Écrit
  dans `finalize()` à partir de `selected` (l'état du composant), jamais de
  la liste de joueurs déjà réordonnée envoyée à `onConfirm` — en mode
  ordinateur, cette dernière contient le faux joueur bot, qui n'a rien à
  faire en stockage. Lu au montage, filtré contre `listPlayers()` actuel (un
  profil supprimé depuis n'est jamais ressuscité) et plafonné à
  `game.meta.maxPlayers`.

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
- `settings` — réglages (son activé, rejet de la paume activé, dernier
  niveau de bot/solo choisi, derniers joueurs par jeu...), fusionné avec les
  valeurs par défaut à la lecture pour qu'un champ ajouté après coup
  n'invalide pas un réglage déjà stocké

`scores` — meilleur score par (jeu, joueur, variant), pour un jeu solo à
score (`Result.score`, voir §4). Un seul entier par clé (le record), pas un
historique de parties. `variant` (ex. `pads-4`) permet à un jeu comme la
mémoire sonore de garder un record séparé par niveau de difficulté plutôt
qu'un seul chiffre qui mélangerait des parties incomparables — décision
utilisateur, tranchant le point resté ouvert en §10 jusqu'ici. Calculé et
écrit par le shell (`App.tsx`, générique), jamais par `logic.ts` d'un jeu
(qui reste pur, sans accès à `localStorage`). `getAllHighScores(gameId,
playerId)` (spec 06) lit tous les variants d'un coup — piece-quiz en a besoin
dès `createState` pour ses trois records (`easy`/`medium`/`hard`, un par
palier), transmis via `options.bestScores` (§4) ; les autres jeux n'ont
jamais eu besoin que d'un seul variant à la fois (`getHighScore`).

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
est débloqué au premier tap sur le menu, pas au chargement. Depuis la spec 05,
`fx/audio-context.ts` en est le seul propriétaire pour toute l'app — ZzFX et le
moteur musical du socle solfège (`src/solfege/audio.ts`, §3 de l'arborescence)
partagent le même contexte, jamais deux instances (iOS le tolère mal, et deux
horloges divergeraient).

**canvas-confetti** pour la victoire. Sur un A8X, baisser `particleCount` autour de
80 et activer `disableForReducedMotion`.

**Le socle solfège** (`src/solfege/`) synthétise ses sons par oscillateur (aucun
échantillon), ordonnancés en lookahead sur l'horloge de l'`AudioContext`
partagé — jamais par `setTimeout` direct, qui dériverait sur un A8X. Détail dans
`src/solfege/audio.ts` et `NOTES.md` (spec 05).

## 8. Feuille de route

**Phase 1 — le squelette qui tient** ✅ livré, validé sur iPad réel (2026-09-06)
Shell, profils avec photos, registre, morpion complet, transport local, son, confettis.

**Phase 2 — la preuve de la frontière** ✅ livré
Deuxième jeu ajouté : « la course des poussins » (dames-échecs simplifié), pas
puissance 4 comme envisagé initialement (puissance 4 est arrivé plus tard,
voir Phase 2.6) — décision prise en cours de route, sans conséquence sur le
critère de sortie. Aucune modification du shell en
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

**Phase 2.6 — troisième jeu** ✅ livré
Puissance 4 ajouté, troisième preuve du contrat `GameModule` (voir §4 « Le
registre »). Bot niveau 4 conçu pour ne jamais jouer moins bien que le
niveau 3 par construction plutôt que par réglage empirique — une recherche à
profondeur fixe plus profonde s'est révélée jouer *moins* bien avec
l'heuristique simple de ce jeu, une pathologie de minimax connue (voir
NOTES.md). Palette de couleurs de profil revérifiée contre un plateau à fond
sombre (les 8 couleurs avaient été choisies pour contraster sur fond clair).

**Phase 2.7 — premier jeu solo, premier jeu à score** ✅ livré
Mémoire sonore ajoutée : quatrième jeu, mais surtout premier qui n'oppose pas
des joueurs entre eux (`minPlayers = maxPlayers = 1`, pas de `bot`) et
premier dont la fin de partie est un score plutôt qu'une victoire/défaite.
Deux extensions additives du contrat pour l'accueillir, sans toucher aucun
jeu existant : `GameMeta.soloLevels` (réglage pré-partie réutilisant le
sélecteur « NIVEAU », sans adversaire) et `Result.score` facultatif sur la
variante `win` (plutôt qu'un troisième `kind`, qui aurait forcé une
narrowing supplémentaire dans le code déjà écrit des trois autres jeux —
voir NOTES.md). Palmarès (`storage.ts`, clé `scores`) construit à cette
occasion, un seul entier par (jeu, joueur, variant) — le point resté ouvert
en §10 depuis la phase 1.

**Phase 2.8 — confort de sélection des joueurs, rejet de la paume** ✅ livré
Trois demandes d'usage réel avec un jeune enfant. Présélection des joueurs
généralisée et mémorisée par jeu (voir §4 « Présélection des joueurs »).
Rejet de la paume (`shell/palmRejection.ts`) : un toucher dont le rayon de
contact (`Touch.radiusX`/`radiusY`) dépasse celui d'un doigt est neutralisé
avant qu'il puisse déclencher quoi que ce soit — calibré sur mesures réelles
prises sur l'iPad Air 2 (doigt 20–42 px, paume ~73 px, voir NOTES.md), activé
par défaut avec un interrupteur de secours sur l'écran Joueurs. Un premier
essai plus agressif (`touchmove`/`touchend` en plus de `touchstart`) a
bloqué de vrais taps sur l'appareil réel et a été retiré sans être publié —
rappel que ce genre de réglage ne se devine pas, il se mesure (NOTES.md, le
détail du diagnostic).

**Phase 2.9 — socle musical, calibration, premier jeu de rythme** livré, pas encore
testé sur iPad réel (spec 05)
Ouverture de la partie « musique » : `src/solfege/` (modèle musical pur, moteur
audio à lookahead, calibration du décalage tactile) et un premier jeu,
« Tape avec moi » (`games/rhythm-tap/`). Deux extensions additives du contrat :
`GameMeta.groupId` (regroupement de jeux dans le menu, `GAME_GROUPS` dans
`registry.ts`) et la propriété unique de l'`AudioContext` extraite dans
`fx/audio-context.ts` (ZzFX et le moteur musical le partagent). Détail des
décisions dans `NOTES.md`.

**Phase 2.10 — deuxième palier vers les échecs, premier jeu de cent niveaux**
livré, pas encore testé sur iPad/iPhone réels (spec 06)
« Où va-t-elle ? » : un quiz de déplacement des pièces, cent niveaux en trois
paliers (Facile/Moyen/Difficile), premier jeu à s'appuyer sur un socle échecs
générique (`src/chess/`) plutôt que sur les règles d'un seul jeu — chess-race
n'est pas migré dessus (dette assumée, voir NOTES.md). Deux extensions
additives du contrat : `createState` reçoit `options.bestScores` (les
records déjà enregistrés pour (ce jeu, ce joueur), pour qu'un jeu qui doit
reprendre sa propre progression le calcule dès sa création — `storage/
index.ts` gagne `getAllHighScores` pour ça) ; puis, sur retour utilisateur
après un premier essai, `GameModule.progressSignal` pour un jeu continu qui
ne s'arrête (presque) jamais niveau par niveau — persiste la progression en
cours de partie et signale des effets transitoires (fête tous les dix
niveaux, échec d'un niveau) sans que le shell sache ce qu'est un « niveau ».
Silhouettes des pièces redessinées une seconde fois (retour utilisateur, les
premières ne plaisaient pas) à partir d'un jeu de fichiers fourni par
l'utilisateur. Retour supplémentaire après un essai réel sur les niveaux
Moyen/Difficile : plateau ramené à 5×5 partout (était 8×8 à partir du niveau
31, trop grand pour rester ludique) et niveaux réduits à 3 questions,
toutes les trois correctes pour réussir (au lieu de 5 questions à 80 %).
Détail des choix (génération des positions par rejet, sécurité du roi,
disposition des boutons flottants, jeu continu) dans `NOTES.md`.

**Phase 2.11 — troisième palier vers les échecs, une vraie finale**
livré, pas encore testé sur iPad/iPhone réels (spec 07)
« La chasse au roi » : deux tours traquent un roi sur 5×5 avec un budget de
coups — la finale « deux tours contre roi seul » (technique de l'escalier)
réduite à l'essentiel, suite directe du quiz (même socle `src/chess/`, mêmes
silhouettes et couleurs, aucune modification de `piece-quiz/`). Premier jeu
à combiner `colorLabels` et `bot` pour rendre DEUX camps jouables contre
l'ordinateur (les tours ou le roi), sans aucune extension du contrat
`GameModule` — la spec l'interdisait explicitement. Niveau 4 (« le coq »)
résout la finale exactement par induction arrière plutôt que par recherche
approchée (~14 000 positions sur 5×5, table mémoïsée, calcul différé au
montage de `Board.tsx`) ; vérifié par balayage exhaustif des 6900 positions
de départ légales que les deux garanties de génération (roi jamais adjacent
ni attaquable au premier coup) suffisent à exclure toute position perdante
pour les tours. A buté sur une limite réelle du câblage shell → jeu (niveau
de bot jamais transmis à `createState`, voir §4 « Le registre ») plutôt que
sur le contrat lui-même — contournée par un niveau par défaut toujours sûr,
documentée plutôt que masquée (NOTES.md).

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
- Voie A ou voie B pour le multi-appareils.
- Attribution exacte (auteur/pack, lien) à compléter dans les 3 `LICENSE.md`
  Flaticon (`chess-race-levels/`, `default-avatar/`, `mode-icons/`) avant
  toute publication qui l'exigerait formellement.
- Clavier iPadOS mal positionné quand l'app installée se retrouve en
  paysage (observation utilisateur, pas encore reproduite/diagnostiquée) —
  voir NOTES.md, section « Clavier décalé en paysage ».
