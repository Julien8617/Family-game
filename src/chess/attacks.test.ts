import { describe, expect, it } from 'vitest';
import { attackedSquares, isSquareAttacked } from './attacks';
import { cellOf } from './geometry';
import { createEmptyBoard } from './pieces';
import type { Board, PieceType } from './pieces';

const SIZE = 8;

function place(board: Board, size: number, row: number, col: number, type: PieceType, side: 'own' | 'enemy') {
  board[cellOf(size, row, col)] = { type, side };
}

describe('attackedSquares', () => {
  it('un pion adverse attaque ses deux diagonales, jamais la case devant lui', () => {
    const board = createEmptyBoard(SIZE);
    place(board, SIZE, 4, 4, 'pawn', 'enemy');
    const attacked = attackedSquares(board, SIZE, 'enemy');
    expect(attacked.has(cellOf(SIZE, 3, 3))).toBe(true);
    expect(attacked.has(cellOf(SIZE, 3, 5))).toBe(true);
    expect(attacked.has(cellOf(SIZE, 3, 4))).toBe(false);
  });

  it("une pièce glissante attaque au travers d'une case ignorée (le roi qui vient de bouger)", () => {
    const board = createEmptyBoard(SIZE);
    place(board, SIZE, 4, 0, 'rook', 'enemy');
    const kingSquare = cellOf(SIZE, 4, 3);
    place(board, SIZE, 4, 3, 'king', 'own');
    const beyond = cellOf(SIZE, 4, 5);

    // Sans ignorer le roi : la tour s'arrête sur lui, la case derrière n'est
    // pas attaquée.
    expect(attackedSquares(board, SIZE, 'enemy').has(beyond)).toBe(false);
    // Roi retiré du calcul (il vient de s'y déplacer, on teste s'il peut
    // continuer au-delà) : la case derrière est bien attaquée.
    expect(isSquareAttacked(board, SIZE, beyond, 'enemy', kingSquare)).toBe(true);
  });

  it('une case occupée par une pièce du même camp que l\'attaquant reste "attaquée"', () => {
    const board = createEmptyBoard(SIZE);
    place(board, SIZE, 4, 0, 'rook', 'enemy');
    place(board, SIZE, 4, 3, 'pawn', 'enemy');
    expect(attackedSquares(board, SIZE, 'enemy').has(cellOf(SIZE, 4, 3))).toBe(true);
    expect(attackedSquares(board, SIZE, 'enemy').has(cellOf(SIZE, 4, 4))).toBe(false);
  });
});
