import type { GameModule } from '../types';
import { Board } from './Board';
import icon from './icon.svg';
import { applyMove, createState, currentPlayer, getResult, isValidMove } from './logic';
import type { PieceQuizMove, PieceQuizState } from './logic';

export const pieceQuiz: GameModule<PieceQuizState, PieceQuizMove> = {
  meta: {
    id: 'piece-quiz',
    title: 'Où va-t-elle ?',
    icon,
    minPlayers: 1,
    maxPlayers: 1,
    supportsRemote: false,
  },
  createState,
  isValidMove,
  applyMove,
  currentPlayer,
  getResult,
  Board,
};
