import { describe, expect, it } from 'vitest';
import { applyMove, createState, getResult, isValidMove } from './logic';
import type { TicTacToeState } from './logic';

const P1 = 'p1';
const P2 = 'p2';

function stateWithBoard(board: TicTacToeState['board'], turn = P1): TicTacToeState {
  return { board, turn, players: [P1, P2], seed: 0 };
}

describe('tictactoe logic', () => {
  it('accepts a move on an empty cell', () => {
    const state = createState([P1, P2], 0);
    expect(isValidMove(state, { cell: 4 })).toBe(true);
  });

  it('rejects a move on an occupied cell', () => {
    const state = stateWithBoard([P1, null, null, null, null, null, null, null, null]);
    expect(isValidMove(state, { cell: 0 })).toBe(false);
  });

  it('rejects a move once the game is over', () => {
    const state = stateWithBoard([P1, P1, P1, P2, P2, null, null, null, null]);
    expect(isValidMove(state, { cell: 5 })).toBe(false);
  });

  it('does not mutate the input state', () => {
    const state = createState([P1, P2], 0);
    const boardBefore = state.board.slice();
    applyMove(state, { cell: 0 });
    expect(state.board).toEqual(boardBefore);
  });

  it('detects a row win', () => {
    const state = stateWithBoard([P1, P1, P1, P2, P2, null, null, null, null]);
    expect(getResult(state)).toEqual({ kind: 'win', winner: P1 });
  });

  it('detects a column win', () => {
    const state = stateWithBoard([P1, P2, null, P1, P2, null, P1, null, null]);
    expect(getResult(state)).toEqual({ kind: 'win', winner: P1 });
  });

  it('detects a diagonal win', () => {
    const state = stateWithBoard([P1, P2, P2, null, P1, null, null, null, P1]);
    expect(getResult(state)).toEqual({ kind: 'win', winner: P1 });
  });

  it('detects a draw when the board is full without a winner', () => {
    const state = stateWithBoard([P1, P2, P1, P1, P2, P2, P2, P1, P1]);
    expect(getResult(state)).toEqual({ kind: 'draw' });
  });

  it('returns null while the game continues', () => {
    const state = createState([P1, P2], 0);
    expect(getResult(state)).toBeNull();
  });

  it('alternates the turn after a move', () => {
    const state = createState([P1, P2], 0);
    const next = applyMove(state, { cell: 0 });
    expect(next.turn).toBe(P2);
    expect(next.board[0]).toBe(P1);
  });
});
