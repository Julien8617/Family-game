import { cellOf, colOf, inBounds, rowOf } from './geometry';
import { raysFor, KING_OFFSETS, KNIGHT_OFFSETS } from './offsets';

// Les six pièces et le calcul de leurs cases accessibles — pur, sans notion
// de « partie » (pas de joueur au trait, pas de tour). `side` ne distingue
// que « amie » (la pièce interrogée, colorable par le profil) et « adverse »
// (couleur neutre) — pas de blanc/noir : ce socle sert un jeu à un seul
// camp qui bouge, pas une vraie partie à deux joueurs (voir chess-race pour
// ça, non migré ici, voir NOTES.md).

export type PieceType = 'pawn' | 'rook' | 'knight' | 'bishop' | 'queen' | 'king';
export type Side = 'own' | 'enemy';

export interface BoardPiece {
  type: PieceType;
  side: Side;
}

export type Board = (BoardPiece | null)[];

export function createEmptyBoard(size: number): Board {
  return Array(size * size).fill(null);
}

// Direction d'avance d'un pion : les pièces amies avancent vers row croissant
// (« vers le haut de l'écran », CLAUDE.md) ; une pièce adverse — simple
// obstacle/menace, jamais un vrai second camp qui joue — avance dans l'autre
// sens, comme un pion qui viendrait à la rencontre du joueur.
export function pawnDirection(side: Side): 1 | -1 {
  return side === 'own' ? 1 : -1;
}

// Pion en avant de sa rangée de départ (`homeRow`), pour le double pas — le
// double pas n'a de sens que pour une pièce qui n'a jamais bougé ; ce socle
// n'a pas de notion de partie/historique, donc `homeRow` fige la seule
// rangée où un double pas est géométriquement plausible (rangée 2 pour une
// pièce amie, l'équivalent en miroir pour une pièce adverse).
function homeRow(size: number, side: Side): number {
  return side === 'own' ? 1 : size - 2;
}

export interface ReachOptions {
  // Désactivé par défaut (CLAUDE.md : hors périmètre sauf activation
  // explicite) — seul le palier Difficile de piece-quiz l'active.
  pawnDoubleStep?: boolean;
  // Case d'arrivée d'une prise en passant valide pour CE pion, ou null. Le
  // générateur (piece-quiz/generate.ts) est seul responsable de vérifier que
  // le coup adverse qui la justifie est réel ; ce module se contente de
  // l'ajouter aux cases accessibles si elle correspond à une diagonale.
  enPassantSquare?: number | null;
}

// Cases accessibles depuis `from` pour LA pièce qui s'y trouve — pièces amies
// qui bloquent (jamais une cible), pièces adverses qui se prennent (une
// cible, qui arrête une pièce à trajectoire glissante), avance et prise du
// pion distinguées. Ne dit rien sur l'échec/la mise en échec : voir
// chess/attacks.ts, utilisé par le générateur pour ne jamais poser le roi
// interrogé à portée d'une case attaquée.
export function reachableSquares(board: Board, size: number, from: number, options: ReachOptions = {}): number[] {
  const piece = board[from];
  if (piece === null) return [];
  const row = rowOf(size, from);
  const col = colOf(size, from);
  const results: number[] = [];

  switch (piece.type) {
    case 'pawn': {
      const dir = pawnDirection(piece.side);
      const r1 = row + dir;

      if (inBounds(size, r1, col)) {
        const straight = cellOf(size, r1, col);
        if (board[straight] === null) {
          results.push(straight);
          if (options.pawnDoubleStep && row === homeRow(size, piece.side)) {
            const r2 = row + 2 * dir;
            if (inBounds(size, r2, col)) {
              const doubleStep = cellOf(size, r2, col);
              if (board[doubleStep] === null) results.push(doubleStep);
            }
          }
        }
      }

      for (const dc of [-1, 1]) {
        const c = col + dc;
        if (!inBounds(size, r1, c)) continue;
        const target = cellOf(size, r1, c);
        const occupant = board[target];
        if (occupant !== null && occupant.side !== piece.side) {
          results.push(target);
        } else if (occupant === null && options.enPassantSquare === target) {
          results.push(target);
        }
      }
      break;
    }

    case 'knight':
      for (const [dr, dc] of KNIGHT_OFFSETS) {
        const r = row + dr;
        const c = col + dc;
        if (!inBounds(size, r, c)) continue;
        const target = cellOf(size, r, c);
        const occupant = board[target];
        if (occupant === null || occupant.side !== piece.side) results.push(target);
      }
      break;

    case 'king':
      for (const [dr, dc] of KING_OFFSETS) {
        const r = row + dr;
        const c = col + dc;
        if (!inBounds(size, r, c)) continue;
        const target = cellOf(size, r, c);
        const occupant = board[target];
        if (occupant === null || occupant.side !== piece.side) results.push(target);
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
          const occupant = board[target];
          if (occupant === null) {
            results.push(target);
          } else {
            if (occupant.side !== piece.side) results.push(target);
            break;
          }
          r += dr;
          c += dc;
        }
      }
      break;
    }
  }

  return results;
}
