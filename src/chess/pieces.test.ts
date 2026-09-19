import { describe, expect, it } from 'vitest';
import { cellOf } from './geometry';
import { createEmptyBoard, reachableSquares } from './pieces';
import type { Board } from './pieces';

const SIZE = 8;

function place(board: Board, size: number, row: number, col: number, type: import('./pieces').PieceType, side: 'own' | 'enemy') {
  board[cellOf(size, row, col)] = { type, side };
}

function sorted(cells: number[]): number[] {
  return [...cells].sort((a, b) => a - b);
}

describe('pawn', () => {
  it('avance d\'une case sur plateau vide', () => {
    const board = createEmptyBoard(SIZE);
    place(board, SIZE, 3, 3, 'pawn', 'own');
    const from = cellOf(SIZE, 3, 3);
    expect(reachableSquares(board, SIZE, from)).toEqual([cellOf(SIZE, 4, 3)]);
  });

  it('avance bloquée par une pièce amie ou adverse', () => {
    for (const side of ['own', 'enemy'] as const) {
      const board = createEmptyBoard(SIZE);
      place(board, SIZE, 3, 3, 'pawn', 'own');
      place(board, SIZE, 4, 3, 'rook', side);
      const from = cellOf(SIZE, 3, 3);
      expect(reachableSquares(board, SIZE, from)).toEqual([]);
    }
  });

  it('prise en diagonale sur pièce adverse, refusée sur pièce amie', () => {
    const board = createEmptyBoard(SIZE);
    place(board, SIZE, 3, 3, 'pawn', 'own');
    place(board, SIZE, 4, 2, 'rook', 'enemy');
    place(board, SIZE, 4, 4, 'rook', 'own');
    const from = cellOf(SIZE, 3, 3);
    expect(sorted(reachableSquares(board, SIZE, from))).toEqual(sorted([cellOf(SIZE, 4, 3), cellOf(SIZE, 4, 2)]));
  });

  it('ne prend jamais tout droit', () => {
    const board = createEmptyBoard(SIZE);
    place(board, SIZE, 3, 3, 'pawn', 'own');
    place(board, SIZE, 4, 3, 'rook', 'enemy');
    const from = cellOf(SIZE, 3, 3);
    // La case devant est occupée par un adversaire : ni avance (occupée), ni
    // prise (les prises ne sont que diagonales) — aucune case accessible.
    expect(reachableSquares(board, SIZE, from)).toEqual([]);
  });

  it('double pas refusé par défaut, accepté quand activé depuis la rangée de départ', () => {
    const board = createEmptyBoard(SIZE);
    place(board, SIZE, 1, 3, 'pawn', 'own');
    const from = cellOf(SIZE, 1, 3);

    expect(reachableSquares(board, SIZE, from)).toEqual([cellOf(SIZE, 2, 3)]);
    expect(sorted(reachableSquares(board, SIZE, from, { pawnDoubleStep: true }))).toEqual(
      sorted([cellOf(SIZE, 2, 3), cellOf(SIZE, 3, 3)]),
    );
  });

  it('double pas refusé hors de la rangée de départ, même activé', () => {
    const board = createEmptyBoard(SIZE);
    place(board, SIZE, 2, 3, 'pawn', 'own');
    const from = cellOf(SIZE, 2, 3);
    expect(reachableSquares(board, SIZE, from, { pawnDoubleStep: true })).toEqual([cellOf(SIZE, 3, 3)]);
  });

  it('double pas refusé si la case intermédiaire ou finale est occupée', () => {
    const board = createEmptyBoard(SIZE);
    place(board, SIZE, 1, 3, 'pawn', 'own');
    place(board, SIZE, 3, 3, 'rook', 'enemy');
    const from = cellOf(SIZE, 1, 3);
    expect(reachableSquares(board, SIZE, from, { pawnDoubleStep: true })).toEqual([cellOf(SIZE, 2, 3)]);
  });

  it('prise en passant refusée par défaut, acceptée quand la case est fournie', () => {
    const board = createEmptyBoard(SIZE);
    place(board, SIZE, 4, 3, 'pawn', 'own');
    place(board, SIZE, 4, 4, 'pawn', 'enemy'); // vient de faire un double pas
    const from = cellOf(SIZE, 4, 3);
    const enPassantSquare = cellOf(SIZE, 5, 4);

    expect(sorted(reachableSquares(board, SIZE, from, { enPassantSquare: null }))).toEqual([cellOf(SIZE, 5, 3)]);
    expect(reachableSquares(board, SIZE, from, { enPassantSquare }).length).toBe(2);
    expect(reachableSquares(board, SIZE, from, { enPassantSquare })).toContain(cellOf(SIZE, 5, 4));
  });

  it('au bord (dernière rangée), aucune case accessible', () => {
    const board = createEmptyBoard(SIZE);
    place(board, SIZE, SIZE - 1, 3, 'pawn', 'own');
    const from = cellOf(SIZE, SIZE - 1, 3);
    expect(reachableSquares(board, SIZE, from)).toEqual([]);
  });
});

describe('tour', () => {
  it('lignes et colonnes au centre, arrêtée par une pièce amie', () => {
    const board = createEmptyBoard(SIZE);
    place(board, SIZE, 3, 3, 'rook', 'own');
    place(board, SIZE, 3, 5, 'pawn', 'own');
    const from = cellOf(SIZE, 3, 3);
    const targets = reachableSquares(board, SIZE, from);
    expect(targets).toContain(cellOf(SIZE, 3, 4));
    expect(targets).not.toContain(cellOf(SIZE, 3, 5));
    expect(targets).not.toContain(cellOf(SIZE, 3, 6));
  });

  it('prend une pièce adverse et s\'arrête dessus', () => {
    const board = createEmptyBoard(SIZE);
    place(board, SIZE, 3, 3, 'rook', 'own');
    place(board, SIZE, 3, 5, 'pawn', 'enemy');
    const from = cellOf(SIZE, 3, 3);
    const targets = reachableSquares(board, SIZE, from);
    expect(targets).toContain(cellOf(SIZE, 3, 5));
    expect(targets).not.toContain(cellOf(SIZE, 3, 6));
  });

  it('dans un coin, seulement deux directions', () => {
    const board = createEmptyBoard(SIZE);
    place(board, SIZE, 0, 0, 'rook', 'own');
    const targets = reachableSquares(board, SIZE, cellOf(SIZE, 0, 0));
    expect(targets.length).toBe((SIZE - 1) * 2);
  });
});

describe('fou', () => {
  it('diagonales au centre, arrêté par une pièce amie', () => {
    const board = createEmptyBoard(SIZE);
    place(board, SIZE, 3, 3, 'bishop', 'own');
    place(board, SIZE, 5, 5, 'pawn', 'own');
    const targets = reachableSquares(board, SIZE, cellOf(SIZE, 3, 3));
    expect(targets).toContain(cellOf(SIZE, 4, 4));
    expect(targets).not.toContain(cellOf(SIZE, 5, 5));
    expect(targets).not.toContain(cellOf(SIZE, 6, 6));
  });

  it('dans un coin, une seule diagonale', () => {
    const board = createEmptyBoard(SIZE);
    place(board, SIZE, 0, 0, 'bishop', 'own');
    const targets = reachableSquares(board, SIZE, cellOf(SIZE, 0, 0));
    expect(targets.length).toBe(SIZE - 1);
  });
});

describe('cavalier', () => {
  it('saute par-dessus les pièces au centre', () => {
    const board = createEmptyBoard(SIZE);
    place(board, SIZE, 3, 3, 'knight', 'own');
    // Entoure complètement le cavalier de pièces amies : le saut doit rester
    // possible malgré tout ce qui l'encercle.
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        place(board, SIZE, 3 + dr, 3 + dc, 'pawn', 'own');
      }
    }
    const targets = reachableSquares(board, SIZE, cellOf(SIZE, 3, 3));
    expect(sorted(targets)).toEqual(
      sorted([
        cellOf(SIZE, 4, 5),
        cellOf(SIZE, 5, 4),
        cellOf(SIZE, 2, 5),
        cellOf(SIZE, 1, 4),
        cellOf(SIZE, 4, 1),
        cellOf(SIZE, 5, 2),
        cellOf(SIZE, 2, 1),
        cellOf(SIZE, 1, 2),
      ]),
    );
  });

  it('dans un coin, seulement deux sauts possibles', () => {
    const board = createEmptyBoard(SIZE);
    place(board, SIZE, 0, 0, 'knight', 'own');
    const targets = reachableSquares(board, SIZE, cellOf(SIZE, 0, 0));
    expect(targets.length).toBe(2);
  });

  it('ne saute jamais sur une pièce amie, mais prend une pièce adverse', () => {
    const board = createEmptyBoard(SIZE);
    place(board, SIZE, 3, 3, 'knight', 'own');
    place(board, SIZE, 5, 4, 'rook', 'own');
    place(board, SIZE, 4, 5, 'rook', 'enemy');
    const targets = reachableSquares(board, SIZE, cellOf(SIZE, 3, 3));
    expect(targets).not.toContain(cellOf(SIZE, 5, 4));
    expect(targets).toContain(cellOf(SIZE, 4, 5));
  });
});

describe('dame', () => {
  it('combine tour et fou', () => {
    const board = createEmptyBoard(SIZE);
    place(board, SIZE, 3, 3, 'queen', 'own');
    const targets = reachableSquares(board, SIZE, cellOf(SIZE, 3, 3));
    expect(targets).toContain(cellOf(SIZE, 3, 6)); // ligne
    expect(targets).toContain(cellOf(SIZE, 6, 6)); // diagonale
  });
});

describe('roi', () => {
  it('une case dans toutes les directions au centre', () => {
    const board = createEmptyBoard(SIZE);
    place(board, SIZE, 3, 3, 'king', 'own');
    const targets = reachableSquares(board, SIZE, cellOf(SIZE, 3, 3));
    expect(targets.length).toBe(8);
  });

  it('dans un coin, seulement trois cases', () => {
    const board = createEmptyBoard(SIZE);
    place(board, SIZE, 0, 0, 'king', 'own');
    const targets = reachableSquares(board, SIZE, cellOf(SIZE, 0, 0));
    expect(targets.length).toBe(3);
  });

  it('bloqué par des pièces amies, libre de prendre les adverses', () => {
    const board = createEmptyBoard(SIZE);
    place(board, SIZE, 3, 3, 'king', 'own');
    place(board, SIZE, 2, 3, 'pawn', 'own');
    place(board, SIZE, 4, 3, 'pawn', 'enemy');
    const targets = reachableSquares(board, SIZE, cellOf(SIZE, 3, 3));
    expect(targets).not.toContain(cellOf(SIZE, 2, 3));
    expect(targets).toContain(cellOf(SIZE, 4, 3));
  });
});
