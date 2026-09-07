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
}

export interface BoardProps<S, M> {
  state: S;
  localPlayer: PlayerId;
  players: Player[];
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
