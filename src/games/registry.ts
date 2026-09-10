import type { GameModule } from './types';
import { chessRace } from './chess-race';
import { connect4 } from './connect4';
import { rhythmTap } from './rhythm-tap';
import { soundMemory } from './sound-memory';
import { ticTacToe } from './tictactoe';
import musicGroupIcon from '../shell/music-group-icon.svg';

export const GAMES: GameModule<any, any>[] = [ticTacToe, chessRace, connect4, soundMemory, rhythmTap];

// Table de groupes (spec 05) : un jeu déclare GameMeta.groupId, MenuScreen
// regroupe sous une tuile de sous-menu dont ce fichier donne le titre et
// l'icône affichés — le shell ne sait toujours rien de ce que « music »
// représente.
export const GAME_GROUPS: Record<string, { title: string; icon: string }> = {
  music: { title: 'Musique', icon: musicGroupIcon },
};
