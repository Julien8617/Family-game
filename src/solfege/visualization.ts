// Choix du repère visuel pendant un jeu de rythme — propriété de l'appareil
// (comme la calibration), persistée via storage/index.ts uniquement
// (CLAUDE.md, conventions de code : aucun accès direct à localStorage depuis
// solfege/). Retour utilisateur après test réel : le pendule est difficile à
// suivre pour certains, le défilement horizontal marche mieux — les deux
// restent disponibles, au choix, depuis l'écran Joueurs.
import { getSettings, updateSettings } from '../storage';

export type RhythmVisualization = 'metronome' | 'scroll';

const DEFAULT_VISUALIZATION: RhythmVisualization = 'metronome';

export function getRhythmVisualization(): RhythmVisualization {
  return getSettings().rhythmVisualization ?? DEFAULT_VISUALIZATION;
}

export function setRhythmVisualization(value: RhythmVisualization): void {
  updateSettings({ rhythmVisualization: value });
}
