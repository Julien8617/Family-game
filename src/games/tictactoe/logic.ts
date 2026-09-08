import type { PlayerId, Result } from '../types';

export type Cell = PlayerId | null;

export interface TicTacToeState {
  board: Cell[];
  turn: PlayerId;
  players: [PlayerId, PlayerId];
  seed: number;
}

export interface TicTacToeMove {
  cell: number;
}

// Exporté pour bot.ts (niveau imbattable) — une seule liste des lignes
// gagnantes, pas une copie dans les deux fichiers.
export const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function createState(players: PlayerId[], seed: number): TicTacToeState {
  const [p1, p2] = players as [PlayerId, PlayerId];
  return {
    board: Array(9).fill(null),
    turn: p1,
    players: [p1, p2],
    seed,
  };
}

export function isValidMove(state: TicTacToeState, move: TicTacToeMove): boolean {
  if (move.cell < 0 || move.cell > 8) return false;
  if (state.board[move.cell] !== null) return false;
  if (getResult(state) !== null) return false;
  return true;
}

export function applyMove(state: TicTacToeState, move: TicTacToeMove): TicTacToeState {
  const board = state.board.slice();
  board[move.cell] = state.turn;
  const [p1, p2] = state.players;
  const turn = state.turn === p1 ? p2 : p1;
  return { ...state, board, turn };
}

export function currentPlayer(state: TicTacToeState): PlayerId | null {
  if (getResult(state) !== null) return null;
  return state.turn;
}

// Les trois cases alignées d'une partie gagnée, ou null. Board.tsx s'en sert
// pour tracer la ligne ; getResult() en dérive le gagnant, sans dupliquer la
// recherche.
export function getWinningLine(state: TicTacToeState): number[] | null {
  for (const line of LINES) {
    const [a, b, c] = line;
    const mark = state.board[a];
    if (mark !== null && mark === state.board[b] && mark === state.board[c]) {
      return line;
    }
  }
  return null;
}

export function getResult(state: TicTacToeState): Result | null {
  const line = getWinningLine(state);
  if (line) {
    return { kind: 'win', winner: state.board[line[0]] as PlayerId };
  }
  if (state.board.every((cell) => cell !== null)) {
    return { kind: 'draw' };
  }
  return null;
}
