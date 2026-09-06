import type { GameModule } from '../types';
import { Board } from './Board';
import icon from './icon.svg';
import { applyMove, createState, currentPlayer, getResult, isValidMove } from './logic';
import type { TicTacToeMove, TicTacToeState } from './logic';

export const ticTacToe: GameModule<TicTacToeState, TicTacToeMove> = {
  meta: {
    id: 'tictactoe',
    title: 'Morpion',
    icon,
    minPlayers: 2,
    maxPlayers: 2,
    supportsRemote: false,
  },
  createState,
  isValidMove,
  applyMove,
  currentPlayer,
  getResult,
  Board,
};
