import type { GameModule } from '../types';
import { chooseMove } from './bot';
import chickIcon from './levels/chick.svg';
import eggIcon from './levels/egg.svg';
import henIcon from './levels/hen.svg';
import roosterIcon from './levels/rooster.svg';
import { Board } from './Board';
import icon from './icon.svg';
import { applyMove, createState, currentPlayer, getResult, isValidMove } from './logic';
import type { ChessRaceMove, ChessRaceState } from './logic';

export const chessRace: GameModule<ChessRaceState, ChessRaceMove> = {
  meta: {
    id: 'chess-race',
    title: 'La course des poussins',
    icon,
    minPlayers: 2,
    maxPlayers: 2,
    supportsRemote: false,
    colorLabels: ['Blancs', 'Noirs'],
  },
  createState,
  isValidMove,
  applyMove,
  currentPlayer,
  getResult,
  Board,
  bot: {
    levels: [
      { id: 1, label: "L'œuf", icon: eggIcon },
      { id: 2, label: 'Le poussin', icon: chickIcon },
      { id: 3, label: 'La poule', icon: henIcon },
      { id: 4, label: 'Le coq', icon: roosterIcon },
    ],
    chooseMove,
  },
};
