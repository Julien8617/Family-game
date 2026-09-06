# Architecture

## 1. Objectif

Une PWA de jeux familiale, installée sur l'écran d'accueil d'un iPad Air 2, qui
fonctionne indéfiniment sans réseau. Elle accueille des jeux ajoutés un par un, garde
les profils des joueurs avec leur photo, et pourra plus tard faire jouer deux
appareils ensemble.

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

Le manifest verrouille `display: fullscreen` et `orientation: landscape`.

## 3. Arborescence

```
src/
  shell/
    App.tsx              routeur d'écrans (menu → sélection joueurs → partie → résultat)
    MenuScreen.tsx       grille des jeux disponibles
    PlayerPickScreen.tsx sélection des joueurs par photo
    GameScreen.tsx       hôte de partie : détient l'état, valide, applique
    ResultScreen.tsx     fin de partie, confettis, rejouer

  players/
    types.ts             Player
    storage.ts           SEUL point d'accès à localStorage de toute l'app
    photo.ts             capture, recadrage carré, redimensionnement 200 px
    PlayerEditor.tsx     création et modification d'un profil

  games/
    types.ts             GameModule, contrats partagés
    registry.ts          liste des jeux — la seule ligne à toucher pour en ajouter un
    tictactoe/
      logic.ts           pur, testé, sans React
      Board.tsx          rendu et émission d'intentions
      index.ts           assemble le GameModule
      logic.test.ts

  net/
    transport.ts         interface Transport
    localTransport.ts    boucle immédiate, un seul appareil
    webrtcTransport.ts   phase 3, RTCDataChannel

  fx/
    sound.ts             ZzFX, déblocage AudioContext, table des sons
    confetti.ts          canvas-confetti, réglages économes

  vendor/                dépendances copiées localement, jamais de CDN
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
}

export interface BoardProps<S, M> {
  state: S;
  localPlayer: PlayerId;   // qui tient cet appareil
  players: Player[];       // pour afficher photos et prénoms
  onMove(move: M): void;   // émettre une intention, rien d'autre
}

export interface GameModule<S, M> {
  meta: GameMeta;

  createState(players: PlayerId[], seed: number): S;
  isValidMove(state: S, move: M): boolean;
  applyMove(state: S, move: M): S;
  currentPlayer(state: S): PlayerId | null;
  getResult(state: S): Result | null;   // null tant que la partie continue

  Board: React.ComponentType<BoardProps<S, M>>;
}
```

### Les cinq invariants

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

### Le registre

```ts
// games/registry.ts
import { ticTacToe } from './tictactoe';

export const GAMES: GameModule<any, any>[] = [
  ticTacToe,
];
```

Ajouter un jeu : un dossier, un import, une ligne. Le menu se construit à partir de
`GAMES`, et la sélection de joueurs lit `minPlayers` / `maxPlayers`. Aucun autre
fichier du shell ne bouge.

### La boucle de partie

`GameScreen` détient l'état et fait tourner la boucle :

```
Board émet une intention
  → transport.send(move)
  → à la réception : isValidMove ? applyMove : ignorer
  → nouvel état → getResult
      null   → on continue, currentPlayer suivant
      Result → écran de résultat, confettis, mise à jour du palmarès
```

En solo, le transport renvoie le coup immédiatement. En réseau, il passe par le
canal de données. `GameScreen` ne fait pas la différence.

## 5. Joueurs et stockage

```ts
export interface Player {
  id: PlayerId;            // crypto.randomUUID()
  name: string;            // « Papa », « Maman », prénom
  photo: string;           // data URL, 200×200, JPEG qualité 0.8
  color: string;           // couleur assignée, utilisée par les jeux
}
```

Stockage dans `localStorage`, sous deux clés :

- `players` — le tableau des profils
- `scores` — un compteur par couple (jeu, joueur)

Le quota est de 5 Mo environ, et il est partagé. Une photo iPad brute pèse plusieurs
mégaoctets : le redimensionnement en canvas avant sérialisation n'est pas une
optimisation, c'est une condition de fonctionnement. Quatre profils à 200 px tiennent
dans quelques dizaines de kilo-octets.

`storage.ts` est le seul module qui touche `localStorage`. Le jour où le volume impose
un passage à IndexedDB, un seul fichier change.

## 6. Deux iPads — préparé maintenant, branché plus tard

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

**Phase 1 — le squelette qui tient**
Shell, profils avec photos, registre, morpion complet, transport local, son, confettis.
Critère de sortie : la famille y joue vraiment, plusieurs soirs de suite.

**Phase 2 — la preuve de la frontière**
Ajouter un deuxième jeu (puissance 4). Critère de sortie : aucune modification du shell
en dehors d'une ligne dans `registry.ts`. Si ce n'est pas le cas, le contrat est mauvais
et c'est le moment de le corriger, pas au dixième jeu.

**Phase 3 — deux appareils**
Seulement si un jeu à information cachée le justifie. Implémenter `webrtcTransport`
derrière l'interface existante.

## 9. Décisions verrouillées

- Tailwind v3, jamais v4, tant que l'iPad Air 2 est la cible.
- `build.target: 'safari15'`.
- Aucun backend, aucun appel réseau à l'exécution.
- Toutes les dépendances vendorisées dans `src/vendor/`.
- La logique de jeu est pure et testée sans navigateur.
- Un seul module accède à `localStorage`.

## 10. Points à trancher plus tard

- Sauvegarde d'une partie en cours (l'état est déjà sérialisable, c'est du travail
  d'interface, pas d'architecture).
- Palmarès : compteur simple ou historique complet des parties.
- Mode « qui commence ? » — tirage au sort animé, avec les photos.
- Voie A ou voie B pour le multi-appareils.
