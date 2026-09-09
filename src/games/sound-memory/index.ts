import type { GameModule } from '../types';
import { Board } from './Board';
import icon from './icon.svg';
// Réutilise les icônes de niveau de la course des poussins (mêmes fichiers
// vendorisés, voir src/vendor/chess-race-levels/LICENSE.md), comme les deux
// autres jeux à niveaux — ici pour le rythme (GameMeta.soloLevels) plutôt
// que la force d'un adversaire, il n'y en a pas.
import eggIcon from '../../vendor/chess-race-levels/egg-static.gif';
import eggIconAnimated from '../../vendor/chess-race-levels/egg-animated.gif';
import chickIcon from '../../vendor/chess-race-levels/chick-static.gif';
import chickIconAnimated from '../../vendor/chess-race-levels/chick-animated.gif';
import henIcon from '../../vendor/chess-race-levels/hen-static.gif';
import henIconAnimated from '../../vendor/chess-race-levels/hen-animated.gif';
import roosterIcon from '../../vendor/chess-race-levels/rooster-static.gif';
import roosterIconAnimated from '../../vendor/chess-race-levels/rooster-animated.gif';
import { applyMove, createState, currentPlayer, getResult, isValidMove } from './logic';
import type { SoundMemoryMove, SoundMemoryState } from './logic';

export const soundMemory: GameModule<SoundMemoryState, SoundMemoryMove> = {
  meta: {
    id: 'sound-memory',
    title: 'Mémoire sonore',
    icon,
    minPlayers: 1,
    maxPlayers: 1,
    supportsRemote: false,
    soloLevels: [
      { id: 1, label: 'Lent', icon: eggIcon, animatedIcon: eggIconAnimated },
      { id: 2, label: 'Normal', icon: chickIcon, animatedIcon: chickIconAnimated },
      { id: 3, label: 'Rapide', icon: henIcon, animatedIcon: henIconAnimated },
      { id: 4, label: 'Très rapide', icon: roosterIcon, animatedIcon: roosterIconAnimated },
    ],
  },
  createState,
  isValidMove,
  applyMove,
  currentPlayer,
  getResult,
  Board,
};
