import type { GameModule } from './types';
import { ticTacToe } from './tictactoe';

export const GAMES: GameModule<any, any>[] = [ticTacToe];
