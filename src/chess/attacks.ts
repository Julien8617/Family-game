import { cellOf, colOf, inBounds, rowOf } from './geometry';
import { raysFor, KING_OFFSETS, KNIGHT_OFFSETS } from './offsets';
import { pawnDirection } from './pieces';
import type { Board, Side } from './pieces';

// Cases attaquées par toutes les pièces d'un camp — distinct de
// reachableSquares (pieces.ts) : une case occupée par une pièce du MÊME camp
// que l'attaquant est quand même « attaquée » (elle serait prise si elle
// appartenait à l'autre camp), et un pion attaque ses deux diagonales qu'elles
// soient occupées ou non (il ne les *atteint* que si elles le sont, mais il
// les *menace* dans les deux cas — distinction nécessaire pour la sécurité du
// roi, seul usage de ce module).
//
// `ignoreSquare` retire une case du plateau avant de calculer les
// trajectoires glissantes (tour/fou/dame) — nécessaire pour le roi : une fois
// qu'il s'est déplacé, une pièce qui l'attaquait au travers de son ancienne
// case continue d'attaquer la case derrière lui. Le générateur de piece-quiz
// s'en sert pour vérifier qu'aucune case où le roi pourrait se trouver n'est
// attaquée, roi actuel compris.
export function attackedSquares(board: Board, size: number, attackerSide: Side, ignoreSquare: number | null = null): Set<number> {
  const attacked = new Set<number>();

  for (let square = 0; square < board.length; square++) {
    if (square === ignoreSquare) continue;
    const piece = board[square];
    if (piece === null || piece.side !== attackerSide) continue;

    const row = rowOf(size, square);
    const col = colOf(size, square);

    switch (piece.type) {
      case 'pawn': {
        const dir = pawnDirection(piece.side);
        for (const dc of [-1, 1]) {
          const r = row + dir;
          const c = col + dc;
          if (inBounds(size, r, c)) attacked.add(cellOf(size, r, c));
        }
        break;
      }

      case 'knight':
        for (const [dr, dc] of KNIGHT_OFFSETS) {
          const r = row + dr;
          const c = col + dc;
          if (inBounds(size, r, c)) attacked.add(cellOf(size, r, c));
        }
        break;

      case 'king':
        for (const [dr, dc] of KING_OFFSETS) {
          const r = row + dr;
          const c = col + dc;
          if (inBounds(size, r, c)) attacked.add(cellOf(size, r, c));
        }
        break;

      case 'rook':
      case 'bishop':
      case 'queen': {
        const rays = raysFor(piece.type);
        for (const [dr, dc] of rays) {
          let r = row + dr;
          let c = col + dc;
          while (inBounds(size, r, c)) {
            const target = cellOf(size, r, c);
            attacked.add(target);
            const occupant = target === ignoreSquare ? null : board[target];
            if (occupant !== null) break;
            r += dr;
            c += dc;
          }
        }
        break;
      }
    }
  }

  return attacked;
}

export function isSquareAttacked(
  board: Board,
  size: number,
  square: number,
  attackerSide: Side,
  ignoreSquare: number | null = null,
): boolean {
  return attackedSquares(board, size, attackerSide, ignoreSquare).has(square);
}
