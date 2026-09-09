import { describe, expect, it } from 'vitest';
import { applyMove, COLS, createState, getResult, getWinningLine, isValidMove, ROWS } from './logic';
import type { Connect4State } from './logic';

const P1 = 'p1';
const P2 = 'p2';

function emptyBoard(): Connect4State['board'] {
  return Array(COLS * ROWS).fill(null);
}

function stateWithBoard(board: Connect4State['board'], turn = P1): Connect4State {
  return { board, turn, players: [P1, P2], seed: 0, lastMove: null };
}

// Place les pions un par un depuis le bas, colonne par colonne, pour ne
// jamais décrire un empilement physiquement impossible (un pion « flottant »
// au-dessus d'une case vide).
function boardFromColumns(columns: Array<Array<typeof P1 | typeof P2>>): Connect4State['board'] {
  const board = emptyBoard();
  columns.forEach((col, c) => {
    col.forEach((mark, row) => {
      board[row * COLS + c] = mark;
    });
  });
  return board;
}

describe('connect4 logic', () => {
  it('accepts a move on a column with room', () => {
    const state = createState([P1, P2], 0);
    expect(isValidMove(state, { col: 3 })).toBe(true);
  });

  it('rejects a move outside the board', () => {
    const state = createState([P1, P2], 0);
    expect(isValidMove(state, { col: -1 })).toBe(false);
    expect(isValidMove(state, { col: COLS })).toBe(false);
  });

  it('rejects a move on a full column', () => {
    const board = boardFromColumns([[], [], [], [P1, P2, P1, P2, P1, P2], [], [], []]);
    const state = stateWithBoard(board);
    expect(isValidMove(state, { col: 3 })).toBe(false);
  });

  it('rejects a move once the game is over', () => {
    const board = boardFromColumns([[P1, P1, P1, P1], [], [], [], [], [], []]);
    const state = stateWithBoard(board);
    expect(isValidMove(state, { col: 1 })).toBe(false);
  });

  it('does not mutate the input state', () => {
    const state = createState([P1, P2], 0);
    const boardBefore = state.board.slice();
    applyMove(state, { col: 2 });
    expect(state.board).toEqual(boardBefore);
  });

  it('drops the piece on the lowest empty row of the column', () => {
    const board = boardFromColumns([[], [], [], [P1, P2], [], [], []]);
    const state = stateWithBoard(board);
    const next = applyMove(state, { col: 3 });
    expect(next.board[2 * COLS + 3]).toBe(P1);
    expect(next.lastMove).toBe(2 * COLS + 3);
  });

  it('alternates the turn after a move', () => {
    const state = createState([P1, P2], 0);
    const next = applyMove(state, { col: 0 });
    expect(next.turn).toBe(P2);
  });

  it('detects a horizontal win', () => {
    const board = boardFromColumns([[P1], [P1], [P1], [P1], [], [], []]);
    expect(getResult(stateWithBoard(board))).toEqual({ kind: 'win', winner: P1 });
  });

  it('detects a vertical win', () => {
    const board = boardFromColumns([[P1, P1, P1, P1], [], [], [], [], [], []]);
    expect(getResult(stateWithBoard(board))).toEqual({ kind: 'win', winner: P1 });
  });

  it('detects a rising diagonal win', () => {
    const board = boardFromColumns([[P1], [P2, P1], [P2, P2, P1], [P2, P2, P2, P1], [], [], []]);
    expect(getResult(stateWithBoard(board))).toEqual({ kind: 'win', winner: P1 });
  });

  it('detects a falling diagonal win', () => {
    const board = boardFromColumns([
      [P2, P2, P2, P1],
      [P2, P2, P1],
      [P2, P1],
      [P1],
      [],
      [],
      [],
    ]);
    expect(getResult(stateWithBoard(board))).toEqual({ kind: 'win', winner: P1 });
  });

  it('detects a draw when the board is full without a winner', () => {
    // Motif classique sans quatre alignés : colonnes alternées par paires.
    const col = (pattern: string) => pattern.split('').map((c) => (c === '1' ? P1 : P2));
    const board = boardFromColumns([
      col('121212'),
      col('121212'),
      col('212121'),
      col('212121'),
      col('121212'),
      col('121212'),
      col('212121'),
    ]);
    const state = stateWithBoard(board);
    expect(getResult(state)?.kind).toBe('draw');
  });

  it('returns null while the game continues', () => {
    const state = createState([P1, P2], 0);
    expect(getResult(state)).toBeNull();
  });

  it('returns null for the winning line while the game continues', () => {
    const state = createState([P1, P2], 0);
    expect(getWinningLine(state)).toBeNull();
  });

  it('returns the four cells for a horizontal win', () => {
    const board = boardFromColumns([[P1], [P1], [P1], [P1], [], [], []]);
    expect(getWinningLine(stateWithBoard(board))).toEqual([0, 1, 2, 3]);
  });
});
