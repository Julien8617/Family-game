import type { GameModule } from '../types';
import { Board } from './Board';
import icon from './icon.svg';
// Réutilise les icônes de niveau de la course des poussins, comme
// sound-memory/index.ts pour son rythme — ici pour le tempo (GameMeta.soloLevels).
import eggIcon from '../../vendor/chess-race-levels/egg-static.gif';
import eggIconAnimated from '../../vendor/chess-race-levels/egg-animated.gif';
import chickIcon from '../../vendor/chess-race-levels/chick-static.gif';
import chickIconAnimated from '../../vendor/chess-race-levels/chick-animated.gif';
import henIcon from '../../vendor/chess-race-levels/hen-static.gif';
import henIconAnimated from '../../vendor/chess-race-levels/hen-animated.gif';
import roosterIcon from '../../vendor/chess-race-levels/rooster-static.gif';
import roosterIconAnimated from '../../vendor/chess-race-levels/rooster-animated.gif';
import { applyMove, createState, currentPlayer, getResult, isValidMove } from './logic';
import type { RhythmTapMove, RhythmTapState } from './logic';
import { getRhythmVisualization, setRhythmVisualization } from '../../solfege/visualization';
import type { RhythmVisualization } from '../../solfege/visualization';

export const rhythmTap: GameModule<RhythmTapState, RhythmTapMove> = {
  meta: {
    id: 'rhythm-tap',
    title: 'Tape avec moi',
    icon,
    minPlayers: 1,
    maxPlayers: 1,
    supportsRemote: false,
    groupId: 'music',
    soloLevels: [
      { id: 1, label: 'Lent', icon: eggIcon, animatedIcon: eggIconAnimated },
      { id: 2, label: 'Normal', icon: chickIcon, animatedIcon: chickIconAnimated },
      { id: 3, label: 'Rapide', icon: henIcon, animatedIcon: henIconAnimated },
      { id: 4, label: 'Très rapide', icon: roosterIcon, animatedIcon: roosterIconAnimated },
    ],
    // Choix du repère de rythme au moment de jouer plutôt que dans l'écran
    // Joueurs (retour utilisateur après test réel : enterré dans les
    // paramètres, ça nuit à l'apprentissage). get/set restent ceux de
    // solfege/visualization.ts — seul le stockage change de sens, pas
    // l'endroit où il vit.
    visualPreference: {
      options: [
        { id: 'metronome', label: 'Pendule', icon: '🕰️' },
        { id: 'scroll', label: 'Défilement', icon: '🎯' },
      ],
      get: getRhythmVisualization,
      set: (id) => setRhythmVisualization(id as RhythmVisualization),
    },
  },
  createState,
  isValidMove,
  applyMove,
  currentPlayer,
  getResult,
  Board,
};
