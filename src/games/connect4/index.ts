import type { GameModule } from '../types';
import { chooseMove } from './bot';
import { Board } from './Board';
import icon from './icon.svg';
// Réutilise les icônes de niveau de la course des poussins (mêmes fichiers
// vendorisés, voir src/vendor/chess-race-levels/LICENSE.md) — comme le
// morpion, plutôt que d'en vendoriser un troisième jeu de niveaux pour le
// même vocabulaire de progression (œuf → poussin → poule → coq).
import eggIcon from '../../vendor/chess-race-levels/egg-static.gif';
import eggIconAnimated from '../../vendor/chess-race-levels/egg-animated.gif';
import chickIcon from '../../vendor/chess-race-levels/chick-static.gif';
import chickIconAnimated from '../../vendor/chess-race-levels/chick-animated.gif';
import henIcon from '../../vendor/chess-race-levels/hen-static.gif';
import henIconAnimated from '../../vendor/chess-race-levels/hen-animated.gif';
import roosterIcon from '../../vendor/chess-race-levels/rooster-static.gif';
import roosterIconAnimated from '../../vendor/chess-race-levels/rooster-animated.gif';
import { applyMove, createState, currentPlayer, getResult, isValidMove } from './logic';
import type { Connect4Move, Connect4State } from './logic';

export const connect4: GameModule<Connect4State, Connect4Move> = {
  meta: {
    id: 'connect4',
    title: 'Puissance 4',
    icon,
    minPlayers: 2,
    maxPlayers: 2,
    supportsRemote: false,
    // Comme le morpion : un simple ordre de passage, pas deux camps —
    // réutilise l'écran « Qui commence ? » existant (PlayerPickScreen), le
    // second libellé n'étant de toute façon jamais affiché (phase 'color').
    colorLabels: ['Commence', 'Commence'],
  },
  createState,
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
