import type { ComponentType } from 'react';
import type { Player } from '../players/types';

export type PlayerId = string;

export type Result =
  | {
      kind: 'win';
      winner: PlayerId;
      // Optionnel : un jeu solo à score (pas de vraie « victoire » contre un
      // autre joueur, juste une manche terminée) rapporte sa valeur ici,
      // `winner` désignant alors simplement le joueur dont c'est le score.
      // `variant` distingue des scores qui n'ont pas le même sens (ex.
      // difficulté différente) — clé opaque pour le shell, seul le jeu sait
      // ce qu'elle représente ; le shell s'en sert uniquement pour ranger le
      // meilleur score par (jeu, joueur, variant), voir storage/index.ts.
      // `maxValue` optionnel : quand le score a un maximum atteignable connu
      // (ex. le nombre de temps d'une mélodie), le shell affiche un
      // pourcentage (`value`/`maxValue`) plutôt que le nombre brut — sans
      // savoir ce que `value` représente. Absent (ex. mémoire sonore, une
      // séquence qui grandit sans plafond) : affichage du nombre brut,
      // comportement inchangé.
      score?: { value: number; variant?: string; maxValue?: number };
    }
  | { kind: 'draw' };

export interface GameMeta {
  id: string;
  title: string;
  icon: string;
  minPlayers: number;
  maxPlayers: number;
  supportsRemote: boolean;
  // Optionnel : un jeu à deux joueurs où l'ordre compte (qui commence, quelle
  // « couleur ») propose un libellé par place — ex. ['Blancs', 'Noirs'].
  // Le shell affiche alors une étape « qui commence » (dont un tirage au
  // sort) et réordonne les joueurs en conséquence ; il ne sait toujours rien
  // de la raison pour laquelle l'ordre compte.
  colorLabels?: [string, string];
  // Optionnel : un jeu solo (pas d'adversaire artificiel) qui propose un
  // réglage à choisir avant la partie (ex. une vitesse) réutilise le même
  // sélecteur visuel « NIVEAU » que game.bot.levels, sans mode « contre
  // l'ordinateur » ni chooseMove. Le niveau choisi est transmis tel quel à
  // createState (3ᵉ paramètre) ; le shell ne sait pas ce qu'il signifie.
  soloLevels?: BotLevel[];
  // Optionnel : identifiant d'un groupe déclaré dans games/registry.ts
  // (GAME_GROUPS). Le shell regroupe les jeux qui le partagent sous une
  // tuile de sous-menu dans MenuScreen, mais ne sait rien de ce que le
  // groupe représente — un jeu sans groupId s'affiche exactement comme
  // avant, à plat dans le menu principal.
  groupId?: string;
}

export interface BoardProps<S, M> {
  state: S;
  localPlayer: PlayerId;
  players: Player[];
  // true quand plusieurs humains se partagent physiquement cet appareil pour
  // cette partie (deux joueurs, iPad qu'on se passe) — false s'il n'y a
  // qu'un seul spectateur fixe (contre l'ordinateur ; plus tard, chaque
  // appareil d'une partie en réseau). Un jeu à deux camps orientés peut s'en
  // servir pour présenter chaque camp face à son propre joueur (pièces
  // tournées, repères dupliqués) sans jamais faire pivoter le plateau
  // lui-même.
  sharedDevice: boolean;
  onMove(move: M): void;
}

export interface BotLevel {
  id: number;
  label: string;
  icon: string;
  // Variante animée facultative, affichée à la place de `icon` pendant que ce
  // niveau est sélectionné dans l'écran de choix — jamais toute seule (règle
  // « rien ne bouge tout seul » de CLAUDE.md : ici, le mouvement répond bien
  // à l'action de sélection).
  animatedIcon?: string;
}

export interface GameModule<S, M> {
  meta: GameMeta;

  // `options` porte le niveau choisi via GameMeta.soloLevels (facultatif) —
  // un jeu sans soloLevels ignore ce 3ᵉ paramètre sans rien changer à sa
  // signature (players, seed).
  createState(players: PlayerId[], seed: number, options?: { level?: number }): S;
  isValidMove(state: S, move: M): boolean;
  applyMove(state: S, move: M): S;
  currentPlayer(state: S): PlayerId | null;
  getResult(state: S): Result | null;

  Board: ComponentType<BoardProps<S, M>>;

  // Optionnel : un jeu qui propose un adversaire artificiel connaît ses
  // propres règles, donc chooseMove vit ici, jamais dans le shell.
  bot?: {
    levels: BotLevel[];
    chooseMove(state: S, level: number): M;
    // Optionnel : adoucit discrètement le niveau réellement joué en fonction
    // de la série de défaites d'affilée du joueur humain face au niveau
    // choisi (`selectedLevel`) — sans jamais changer ce qui est affiché dans
    // le sélecteur. Le shell appelle toujours cette fonction si elle existe
    // (générique), mais la logique d'ajustement reste propre au jeu, qui
    // seul sait ce que chacun de ses niveaux représente (voir
    // tictactoe/bot.ts). Par défaut (absente) : aucun ajustement.
    adjustLevel?(selectedLevel: number, lossStreak: number): number;
  };
}
