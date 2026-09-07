import { describe, expect, it } from 'vitest';
import {
  allLegalMoves,
  applyMove,
  cellOf,
  createState,
  getResult,
  isValidMove,
} from './logic';
import type { ChessRaceState } from './logic';

const YELLOW = 'yellow-player';
const RED = 'red-player';

function emptyBoard(): ChessRaceState['board'] {
  return Array(64).fill(null);
}

function stateWithBoard(
  board: ChessRaceState['board'],
  turn: string = YELLOW,
  moveCount = 0,
): ChessRaceState {
  return { board, turn, players: [YELLOW, RED], seed: 0, moveCount };
}

describe('chess-race logic', () => {
  it('sets up 8 yellow chicks on row 2 and 8 red chicks on row 7, yellow to move', () => {
    const state = createState([YELLOW, RED], 0);
    for (let col = 0; col < 8; col++) {
      expect(state.board[cellOf(1, col)]).toBe(YELLOW);
      expect(state.board[cellOf(6, col)]).toBe(RED);
    }
    expect(state.turn).toBe(YELLOW);
  });

  it('allows a yellow chick to advance one empty square ahead', () => {
    const state = createState([YELLOW, RED], 0);
    expect(isValidMove(state, { from: cellOf(1, 0), to: cellOf(2, 0) })).toBe(true);
  });

  it('rejects advancing onto an occupied square', () => {
    const board = emptyBoard();
    board[cellOf(2, 0)] = YELLOW;
    board[cellOf(3, 0)] = YELLOW;
    const state = stateWithBoard(board);
    expect(isValidMove(state, { from: cellOf(2, 0), to: cellOf(3, 0) })).toBe(false);
  });

  it('rejects advancing two squares at once', () => {
    const state = createState([YELLOW, RED], 0);
    expect(isValidMove(state, { from: cellOf(1, 0), to: cellOf(3, 0) })).toBe(false);
  });

  it('allows a diagonal capture of an opposing chick', () => {
    const board = emptyBoard();
    board[cellOf(2, 3)] = YELLOW;
    board[cellOf(3, 4)] = RED;
    const state = stateWithBoard(board);
    expect(isValidMove(state, { from: cellOf(2, 3), to: cellOf(3, 4) })).toBe(true);
  });

  it('rejects a diagonal move onto an empty square (no capture without a target)', () => {
    const board = emptyBoard();
    board[cellOf(2, 3)] = YELLOW;
    const state = stateWithBoard(board);
    expect(isValidMove(state, { from: cellOf(2, 3), to: cellOf(3, 4) })).toBe(false);
  });

  it('rejects a straight capture (forward move onto an opponent)', () => {
    const board = emptyBoard();
    board[cellOf(2, 3)] = YELLOW;
    board[cellOf(3, 3)] = RED;
    const state = stateWithBoard(board);
    expect(isValidMove(state, { from: cellOf(2, 3), to: cellOf(3, 3) })).toBe(false);
  });

  it('does not mutate the input state on applyMove', () => {
    const state = createState([YELLOW, RED], 0);
    const boardBefore = state.board.slice();
    applyMove(state, { from: cellOf(1, 0), to: cellOf(2, 0) });
    expect(state.board).toEqual(boardBefore);
    expect(state.turn).toBe(YELLOW);
  });

  it('alternates the turn after a move', () => {
    const state = createState([YELLOW, RED], 0);
    const next = applyMove(state, { from: cellOf(1, 0), to: cellOf(2, 0) });
    expect(next.turn).toBe(RED);
    expect(next.board[cellOf(2, 0)]).toBe(YELLOW);
    expect(next.board[cellOf(1, 0)]).toBeNull();
  });

  it('detects a win when a yellow chick reaches row 8', () => {
    const board = emptyBoard();
    board[cellOf(7, 2)] = YELLOW;
    const state = stateWithBoard(board);
    expect(getResult(state)).toEqual({ kind: 'win', winner: YELLOW });
  });

  it('detects a win when a red chick reaches row 1', () => {
    const board = emptyBoard();
    board[cellOf(0, 5)] = RED;
    const state = stateWithBoard(board);
    expect(getResult(state)).toEqual({ kind: 'win', winner: RED });
  });

  it('detects a win by elimination when the opponent has no chicks left', () => {
    const board = emptyBoard();
    board[cellOf(3, 3)] = YELLOW;
    const state = stateWithBoard(board);
    expect(getResult(state)).toEqual({ kind: 'win', winner: YELLOW });
  });

  it('detects a draw when the player to move has no legal move', () => {
    // Le seul jaune restant est en a4 : la case devant (a5) est occupée, la
    // seule diagonale existante (b5) est vide donc pas de prise possible —
    // aucun coup légal pour les jaunes, au trait. Un roux ailleurs garde un
    // coup légal, pour ne pas déclencher une victoire par élimination.
    const board = emptyBoard();
    board[cellOf(3, 0)] = YELLOW; // a4
    board[cellOf(4, 0)] = RED; // a5, bloque l'avance
    board[cellOf(6, 7)] = RED; // h7, a un coup légal, non concerné par le blocage
    const state = stateWithBoard(board, YELLOW);
    expect(getResult(state)).toEqual({ kind: 'draw' });
  });

  it('lists no legal moves once the game is over', () => {
    const board = emptyBoard();
    board[cellOf(7, 2)] = YELLOW;
    const state = stateWithBoard(board);
    expect(allLegalMoves(state)).toEqual([]);
  });

  it('rejects any move once the game is over', () => {
    const board = emptyBoard();
    board[cellOf(7, 2)] = YELLOW;
    board[cellOf(6, 2)] = YELLOW;
    const state = stateWithBoard(board);
    expect(isValidMove(state, { from: cellOf(6, 2), to: cellOf(6, 3) })).toBe(false);
  });
});
