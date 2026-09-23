import type { GameModule } from '../types';
import { chooseMove } from './bot';
import eggIcon from '../../vendor/chess-race-levels/egg-static.gif';
import eggIconAnimated from '../../vendor/chess-race-levels/egg-animated.gif';
import chickIcon from '../../vendor/chess-race-levels/chick-static.gif';
import chickIconAnimated from '../../vendor/chess-race-levels/chick-animated.gif';
import henIcon from '../../vendor/chess-race-levels/hen-static.gif';
import henIconAnimated from '../../vendor/chess-race-levels/hen-animated.gif';
import roosterIcon from '../../vendor/chess-race-levels/rooster-static.gif';
import roosterIconAnimated from '../../vendor/chess-race-levels/rooster-animated.gif';
import { Board } from './Board';
import icon from './icon.svg';
import { applyMove, createState, currentPlayer, getResult, isValidMove } from './logic';
import type { MazeMove, MazeState } from './logic';

export const maze: GameModule<MazeState, MazeMove> = {
  meta: {
    id: 'maze',
    title: 'Le labyrinthe',
    icon,
    minPlayers: 1,
    maxPlayers: 2,
    supportsRemote: false,
  },
  createState: (players, seed) => createState(players, seed),
  isValidMove,
  applyMove,
  currentPlayer,
  getResult,
  Board,
  bot: {
    levels: [
      { id: 1, label: "L'œuf", icon: eggIcon, animatedIcon: eggIconAnimated },
      { id: 2, label: 'Le poussin', icon: chickIcon, animatedIcon: chickIconAnimated },
      { id: 3, label: 'La poule', icon: henIcon, animatedIcon: henIconAnimated },
      { id: 4, label: 'Le coq', icon: roosterIcon, animatedIcon: roosterIconAnimated },
    ],
    chooseMove,
  },
};
