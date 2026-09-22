import type { PlayerId, Result } from '../types';
import { attackedSquares } from '../../chess/attacks';
import { createEmptyBoard, reachableSquares } from '../../chess/pieces';
import type { Board } from '../../chess/pieces';

// « La chasse au roi » — deux tours traquent un roi sur un plateau 5×5, avec
// un budget de coups pour les tours (spec 07). Pur, testé, sans React ;
// déplacements délégués à src/chess/ (même socle géométrique que
// piece-quiz, voir ARCHITECTURE.md).

export const SIZE = 5;
export const ROOKS_COUNT = 2;

export type KingHuntSide = 'rooks' | 'king';

export interface KingHuntMove {
  from: number;
  to: number;
}

export interface KingHuntState {
  board: Board;
  turn: KingHuntSide;
  // [joueur des tours, joueur du roi] — même ordre que GameMeta.colorLabels
  // (['Tours', 'Roi']).
  players: [PlayerId, PlayerId];
  seed: number;
  // Niveau du roi (1-4, voir bot.ts) : pilote le budget de départ (table
  // ci-dessous) et l'affichage des cases contrôlées dans Board.tsx. Le
  // contrat GameModule ne transmet le niveau choisi contre l'ordinateur qu'à
  // bot.chooseMove, jamais à createState (voir GameScreen.tsx) — en pratique
  // aujourd'hui `level` retombe donc toujours sur DEFAULT_LEVEL, y compris
  // contre un roi difficile ; NOTES.md détaille pourquoi et propose la
  // ligne de shell qui débloquerait le vrai niveau ici.
  level: number;
  budgetTotal: number;
  budgetLeft: number;
  lastMove: KingHuntMove | null;
  moveCount: number;
}

// Table de constantes (spec 07, « Niveaux et budget ») — un budget par
// niveau de roi, du plus généreux (l'œuf) au plus serré (le coq).
export const LEVEL_BUDGET: Record<number, number> = { 1: 25, 2: 20, 3: 16, 4: 12 };
export const DEFAULT_LEVEL = 1;
export const DEFAULT_BUDGET = LEVEL_BUDGET[DEFAULT_LEVEL];

// À partir de quel niveau les cases contrôlées par les tours restent
// masquées (spec 07 : affichées à l'œuf/poussin, masquées à la poule/coq).
export const CONTROLLED_SQUARES_VISIBLE_MAX_LEVEL = 2;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function kingOffsetSquares(size: number, square: number): number[] {
  const row = Math.floor(square / size);
  const col = square % size;
  const squares: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r = row + dr;
      const c = col + dc;
      if (r >= 0 && r < size && c >= 0 && c < size) squares.push(r * size + c);
    }
  }
  return squares;
}

// Position de départ : deux tours et un roi sur des cases distinctes,
// tirées par rejet depuis le seed — déterministe. Deux garanties (spec 07) :
// le roi n'est jamais adjacent à une tour, et il n'est jamais attaquable dès
// le premier coup (import différé pour éviter un cycle : attacks.ts importe
// déjà pieces.ts).
function generateStartBoard(seed: number): Board {
  const random = mulberry32(seed);
  const total = SIZE * SIZE;

  for (let attempt = 0; attempt < 1000; attempt++) {
    const a = Math.floor(random() * total);
    let b = Math.floor(random() * total);
    while (b === a) b = Math.floor(random() * total);
    let king = Math.floor(random() * total);
    while (king === a || king === b) king = Math.floor(random() * total);

    if (kingOffsetSquares(SIZE, king).includes(a) || kingOffsetSquares(SIZE, king).includes(b)) continue;

    const board = createEmptyBoard(SIZE);
    board[a] = { type: 'rook', side: 'own' };
    board[b] = { type: 'rook', side: 'own' };
    board[king] = { type: 'king', side: 'enemy' };

    if (attackedSquares(board, SIZE, 'own').has(king)) continue;

    return board;
  }
  // Ne devrait jamais arriver (l'espace de positions valides est largement
  // majoritaire sur 25 cases) — filet de sécurité déterministe plutôt qu'une
  // boucle infinie.
  const board = createEmptyBoard(SIZE);
  board[0] = { type: 'rook', side: 'own' };
  board[4] = { type: 'rook', side: 'own' };
  board[24] = { type: 'king', side: 'enemy' };
  return board;
}

export function createState(players: PlayerId[], seed: number, options?: { level?: number }): KingHuntState {
  const [rooksPlayer, kingPlayer] = players as [PlayerId, PlayerId];
  const level = options?.level ?? DEFAULT_LEVEL;
  const budgetTotal = LEVEL_BUDGET[level] ?? DEFAULT_BUDGET;
  const board = generateStartBoard(seed);
  return {
    board,
    turn: 'rooks',
    players: [rooksPlayer, kingPlayer],
    seed,
    level,
    budgetTotal,
    budgetLeft: budgetTotal,
    lastMove: null,
    moveCount: 0,
  };
}

function sideToMove(turn: KingHuntSide): 'own' | 'enemy' {
  return turn === 'rooks' ? 'own' : 'enemy';
}

export function legalMovesFrom(state: KingHuntState, from: number): number[] {
  const piece = state.board[from];
  if (piece === null || piece.side !== sideToMove(state.turn)) return [];
  return reachableSquares(state.board, SIZE, from);
}

function rawLegalMoves(state: KingHuntState): KingHuntMove[] {
  const moves: KingHuntMove[] = [];
  for (let from = 0; from < SIZE * SIZE; from++) {
    for (const to of legalMovesFrom(state, from)) moves.push({ from, to });
  }
  return moves;
}

export function allLegalMoves(state: KingHuntState): KingHuntMove[] {
  if (getResult(state)) return [];
  return rawLegalMoves(state);
}

export function isValidMove(state: KingHuntState, move: KingHuntMove): boolean {
  if (getResult(state)) return false;
  if (move.from < 0 || move.from >= SIZE * SIZE) return false;
  if (move.to < 0 || move.to >= SIZE * SIZE) return false;
  return legalMovesFrom(state, move.from).includes(move.to);
}

export function applyMove(state: KingHuntState, move: KingHuntMove): KingHuntState {
  const board = state.board.slice();
  const piece = board[move.from];
  board[move.from] = null;
  board[move.to] = piece;

  if (state.turn === 'rooks') {
    return {
      ...state,
      board,
      budgetLeft: state.budgetLeft - 1,
      turn: 'king',
      lastMove: move,
      moveCount: state.moveCount + 1,
    };
  }
  return { ...state, board, turn: 'rooks', lastMove: move, moveCount: state.moveCount + 1 };
}

function rooksAlive(board: Board): number {
  let count = 0;
  for (const piece of board) if (piece?.type === 'rook') count++;
  return count;
}

function kingAlive(board: Board): boolean {
  return board.some((piece) => piece?.type === 'king');
}

// Ordre de vérification important : une capture du roi l'emporte toujours
// sur un budget qui tombe à zéro le même coup (le dernier coup de budget qui
// attrape le roi est une victoire des tours, pas un budget épuisé).
export function getResult(state: KingHuntState): Result | null {
  const [rooksPlayer, kingPlayer] = state.players;

  if (!kingAlive(state.board)) {
    return { kind: 'win', winner: rooksPlayer, score: { value: state.budgetLeft, variant: String(state.level) } };
  }
  if (rooksAlive(state.board) < ROOKS_COUNT) return { kind: 'win', winner: kingPlayer };
  if (state.budgetLeft <= 0) return { kind: 'win', winner: kingPlayer };
  return null;
}

export function currentPlayer(state: KingHuntState): PlayerId | null {
  if (getResult(state)) return null;
  return state.turn === 'rooks' ? state.players[0] : state.players[1];
}

// Cases occupées par les tours et le roi — utilisé par bot.ts (table
// résolue) et les tests, jamais par le rendu (Board.tsx lit state.board
// directement, comme les autres jeux).
export function extractPositions(board: Board): { rooks: [number, number]; king: number } | null {
  const rooks: number[] = [];
  let king = -1;
  for (let square = 0; square < board.length; square++) {
    const piece = board[square];
    if (!piece) continue;
    if (piece.type === 'rook') rooks.push(square);
    else if (piece.type === 'king') king = square;
  }
  if (rooks.length !== ROOKS_COUNT || king === -1) return null;
  return { rooks: [rooks[0], rooks[1]], king };
}
