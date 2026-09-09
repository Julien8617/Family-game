import type { GameModule } from './types';
import { chessRace } from './chess-race';
import { connect4 } from './connect4';
import { soundMemory } from './sound-memory';
import { ticTacToe } from './tictactoe';

export const GAMES: GameModule<any, any>[] = [ticTacToe, chessRace, connect4, soundMemory];
