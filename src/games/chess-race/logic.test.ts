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

const WHITE = 'white-player';
const BLACK = 'black-player';

function emptyBoard(): ChessRaceState['board'] {
  return Array(64).fill(null);
}

function stateWithBoard(
  board: ChessRaceState['board'],
  turn: string = WHITE,
  moveCount = 0,
): ChessRaceState {
  return { board, turn, players: [WHITE, BLACK], seed: 0, moveCount, lastMove: null };
}

describe('chess-race logic', () => {
  it('sets up 8 white chicks on row 2 and 8 black chicks on row 7, white to move', () => {
    const state = createState([WHITE, BLACK], 0);
    for (let col = 0; col < 8; col++) {
      expect(state.board[cellOf(1, col)]).toBe(WHITE);
      expect(state.board[cellOf(6, col)]).toBe(BLACK);
    }
    expect(state.turn).toBe(WHITE);
  });

  it('allows a white chick to advance one empty square ahead', () => {
    const state = createState([WHITE, BLACK], 0);
    expect(isValidMove(state, { from: cellOf(1, 0), to: cellOf(2, 0) })).toBe(true);
  });

  it('rejects advancing onto an occupied square', () => {
    const board = emptyBoard();
    board[cellOf(2, 0)] = WHITE;
    board[cellOf(3, 0)] = WHITE;
    const state = stateWithBoard(board);
    expect(isValidMove(state, { from: cellOf(2, 0), to: cellOf(3, 0) })).toBe(false);
  });

  it('rejects advancing two squares at once', () => {
    const state = createState([WHITE, BLACK], 0);
    expect(isValidMove(state, { from: cellOf(1, 0), to: cellOf(3, 0) })).toBe(false);
  });

  it('allows a diagonal capture of an opposing chick', () => {
    const board = emptyBoard();
    board[cellOf(2, 3)] = WHITE;
    board[cellOf(3, 4)] = BLACK;
    const state = stateWithBoard(board);
    expect(isValidMove(state, { from: cellOf(2, 3), to: cellOf(3, 4) })).toBe(true);
  });

  it('rejects a diagonal move onto an empty square (no capture without a target)', () => {
    const board = emptyBoard();
    board[cellOf(2, 3)] = WHITE;
    const state = stateWithBoard(board);
    expect(isValidMove(state, { from: cellOf(2, 3), to: cellOf(3, 4) })).toBe(false);
  });

  it('rejects a straight capture (forward move onto an opponent)', () => {
    const board = emptyBoard();
    board[cellOf(2, 3)] = WHITE;
    board[cellOf(3, 3)] = BLACK;
    const state = stateWithBoard(board);
    expect(isValidMove(state, { from: cellOf(2, 3), to: cellOf(3, 3) })).toBe(false);
  });

  it('does not mutate the input state on applyMove', () => {
    const state = createState([WHITE, BLACK], 0);
    const boardBefore = state.board.slice();
    applyMove(state, { from: cellOf(1, 0), to: cellOf(2, 0) });
    expect(state.board).toEqual(boardBefore);
    expect(state.turn).toBe(WHITE);
  });

  it('alternates the turn after a move', () => {
    const state = createState([WHITE, BLACK], 0);
    const next = applyMove(state, { from: cellOf(1, 0), to: cellOf(2, 0) });
    expect(next.turn).toBe(BLACK);
    expect(next.board[cellOf(2, 0)]).toBe(WHITE);
    expect(next.board[cellOf(1, 0)]).toBeNull();
  });

  it('has no last move before the first move is played', () => {
    const state = createState([WHITE, BLACK], 0);
    expect(state.lastMove).toBeNull();
  });

  it('records the move just played as lastMove', () => {
    const state = createState([WHITE, BLACK], 0);
    const move = { from: cellOf(1, 0), to: cellOf(2, 0) };
    const next = applyMove(state, move);
    expect(next.lastMove).toEqual(move);
  });

  it('detects a win when a white chick reaches row 8', () => {
    const board = emptyBoard();
    board[cellOf(7, 2)] = WHITE;
    const state = stateWithBoard(board);
    expect(getResult(state)).toEqual({ kind: 'win', winner: WHITE });
  });

  it('detects a win when a black chick reaches row 1', () => {
    const board = emptyBoard();
    board[cellOf(0, 5)] = BLACK;
    const state = stateWithBoard(board);
    expect(getResult(state)).toEqual({ kind: 'win', winner: BLACK });
  });

  it('detects a win by elimination when the opponent has no chicks left', () => {
    const board = emptyBoard();
    board[cellOf(3, 3)] = WHITE;
    const state = stateWithBoard(board);
    expect(getResult(state)).toEqual({ kind: 'win', winner: WHITE });
  });

  it('detects a draw when the player to move has no legal move', () => {
    // Le seul jaune restant est en a4 : la case devant (a5) est occupée, la
    // seule diagonale existante (b5) est vide donc pas de prise possible —
    // aucun coup légal pour les jaunes, au trait. Un roux ailleurs garde un
    // coup légal, pour ne pas déclencher une victoire par élimination.
    const board = emptyBoard();
    board[cellOf(3, 0)] = WHITE; // a4
    board[cellOf(4, 0)] = BLACK; // a5, bloque l'avance
    board[cellOf(6, 7)] = BLACK; // h7, a un coup légal, non concerné par le blocage
    const state = stateWithBoard(board, WHITE);
    expect(getResult(state)).toEqual({ kind: 'draw' });
  });

  it('lists no legal moves once the game is over', () => {
    const board = emptyBoard();
    board[cellOf(7, 2)] = WHITE;
    const state = stateWithBoard(board);
    expect(allLegalMoves(state)).toEqual([]);
  });

  it('rejects any move once the game is over', () => {
    const board = emptyBoard();
    board[cellOf(7, 2)] = WHITE;
    board[cellOf(6, 2)] = WHITE;
    const state = stateWithBoard(board);
    expect(isValidMove(state, { from: cellOf(6, 2), to: cellOf(6, 3) })).toBe(false);
  });
});
