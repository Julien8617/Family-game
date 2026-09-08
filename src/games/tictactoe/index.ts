import type { GameModule } from '../types';
import { adjustLevel, chooseMove } from './bot';
import { Board } from './Board';
import icon from './icon.svg';
// Réutilise les icônes animées de la course des poussins (mêmes fichiers
// vendorisés, voir src/vendor/chess-race-levels/LICENSE.md) — un même
// vocabulaire visuel de progression (poussin → poule → coq) pour les deux
// jeux, plutôt que d'en dessiner un second pour trois niveaux seulement.
import chickIcon from '../../vendor/chess-race-levels/chick-static.gif';
import chickIconAnimated from '../../vendor/chess-race-levels/chick-animated.gif';
import henIcon from '../../vendor/chess-race-levels/hen-static.gif';
import henIconAnimated from '../../vendor/chess-race-levels/hen-animated.gif';
import roosterIcon from '../../vendor/chess-race-levels/rooster-static.gif';
import roosterIconAnimated from '../../vendor/chess-race-levels/rooster-animated.gif';
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
  bot: {
    levels: [
      { id: 1, label: 'Facile', icon: chickIcon, animatedIcon: chickIconAnimated },
      { id: 2, label: 'Moyen', icon: henIcon, animatedIcon: henIconAnimated },
      { id: 3, label: 'Imbattable', icon: roosterIcon, animatedIcon: roosterIconAnimated },
    ],
    chooseMove,
    adjustLevel,
  },
};
