import type { GameModule } from './types';
import { chessRace } from './chess-race';
import { ticTacToe } from './tictactoe';

export const GAMES: GameModule<any, any>[] = [ticTacToe, chessRace];
