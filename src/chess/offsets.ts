// Déplacements en (dRow, dCol) partagés par pieces.ts (cases accessibles) et
// attacks.ts (cases attaquées) — même géométrie, deux usages différents,
// une seule table pour ne pas la faire diverger accidentellement.

export const KNIGHT_OFFSETS: Array<[number, number]> = [
  [1, 2],
  [2, 1],
  [-1, 2],
  [-2, 1],
  [1, -2],
  [2, -1],
  [-1, -2],
  [-2, -1],
];

export const KING_OFFSETS: Array<[number, number]> = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

export const ROOK_RAYS: Array<[number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

export const BISHOP_RAYS: Array<[number, number]> = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

export const QUEEN_RAYS: Array<[number, number]> = [...ROOK_RAYS, ...BISHOP_RAYS];

export function raysFor(type: 'rook' | 'bishop' | 'queen'): Array<[number, number]> {
  return type === 'rook' ? ROOK_RAYS : type === 'bishop' ? BISHOP_RAYS : QUEEN_RAYS;
}
