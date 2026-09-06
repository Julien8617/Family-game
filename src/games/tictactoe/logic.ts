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

const LINES = [
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

export function getResult(state: TicTacToeState): Result | null {
  for (const [a, b, c] of LINES) {
    const mark = state.board[a];
    if (mark !== null && mark === state.board[b] && mark === state.board[c]) {
      return { kind: 'win', winner: mark };
    }
  }
  if (state.board.every((cell) => cell !== null)) {
    return { kind: 'draw' };
  }
  return null;
}
