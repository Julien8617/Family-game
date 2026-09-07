import type { ComponentType } from 'react';
import type { Player } from '../players/types';

export type PlayerId = string;

export type Result = { kind: 'win'; winner: PlayerId } | { kind: 'draw' };

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
}

export interface GameModule<S, M> {
  meta: GameMeta;

  createState(players: PlayerId[], seed: number): S;
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
  };
}
