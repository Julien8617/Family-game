import { attackedSquares } from '../../chess/attacks';
import { cellOf } from '../../chess/geometry';
import { createEmptyBoard, reachableSquares } from '../../chess/pieces';
import type { Board, PieceType, ReachOptions, Side } from '../../chess/pieces';

// Génération des positions du quiz de déplacement — pur, déterministe à
// partir du seed de la partie et du numéro de niveau (spec 06, §« Génération
// des positions »). Aucune pièce jamais construite « à la main » avec des
// cases attendues calculées par du code dupliqué : chaque candidat est
// entièrement composé de placements de pièces, puis reachableSquares()
// (le même socle que src/chess/pieces.ts, testé séparément) en dérive les
// cases attendues — la seule source de vérité pour « où va-t-elle ? ».

export type Tier = 'easy' | 'medium' | 'hard';

export const TIER_RANGES: Record<Tier, [number, number]> = {
  easy: [1, 30],
  medium: [31, 70],
  hard: [71, 100],
};

export function tierOf(level: number): Tier {
  if (level <= 30) return 'easy';
  if (level <= 70) return 'medium';
  return 'hard';
}

export const QUESTIONS_PER_LEVEL = 5;

export interface PlacedPiece {
  square: number;
  type: PieceType;
  side: Side;
}

export interface PieceQuizQuestion {
  boardSize: 5 | 8;
  pieceType: PieceType;
  // Toutes les pièces de la position, la pièce interrogée comprise (toujours
  // side: 'own', toujours présente une fois).
  pieces: PlacedPiece[];
  queriedSquare: number;
  expectedSquares: number[]; // triées, dérivées de reachableSquares — jamais recalculées à la main
  pawnDoubleStepEnabled: boolean;
  enPassantSquare: number | null;
  // Coup adverse à surligner (départ/arrivée), nécessaire seulement pour une
  // question de prise en passant — sinon null. Même patron que
  // chess-race/ChessRaceState.lastMove.
  lastMove: { from: number; to: number } | null;
}

// mulberry32 : PRNG seedé (CLAUDE.md règle 3), même générateur que les autres
// jeux (connect4, sound-memory...). Jamais Math.random().
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng: () => number, minIncl: number, maxIncl: number): number {
  return minIncl + Math.floor(rng() * (maxIncl - minIncl + 1));
}

function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[randInt(rng, 0, items.length - 1)];
}

function shuffle<T>(rng: () => number, items: readonly T[]): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = randInt(rng, 0, i);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Jamais 'king' : un roi n'apparaît que comme pièce interrogée, jamais comme
// pièce secondaire (spec 06, §« Le roi et la notion d'échec ») — en excluant
// systématiquement 'king' de ce bassin, aucune position générée ne peut
// contenir un second roi, et donc aucun clouage n'est possible (un clouage
// suppose un roi ami *derrière* la pièce clouée).
const OBSTACLE_TYPES: PieceType[] = ['pawn', 'rook', 'bishop', 'knight', 'queen'];
const MIXED_TYPES: PieceType[] = ['pawn', 'rook', 'bishop', 'knight', 'queen', 'king'];

type Feature = 'plain' | 'pawnCapture' | 'pawnBlock' | 'open' | 'king' | 'pawnAdvanced' | 'mixed';

interface BlockConfig {
  start: number;
  end: number;
  boardSize: 5 | 8;
  pieceTypes: PieceType[];
  feature: Feature;
}

const BLOCKS: BlockConfig[] = [
  { start: 1, end: 10, boardSize: 5, pieceTypes: ['pawn'], feature: 'plain' },
  { start: 11, end: 20, boardSize: 5, pieceTypes: ['pawn'], feature: 'pawnCapture' },
  { start: 21, end: 30, boardSize: 5, pieceTypes: ['pawn'], feature: 'pawnBlock' },
  { start: 31, end: 40, boardSize: 8, pieceTypes: ['rook'], feature: 'open' },
  { start: 41, end: 50, boardSize: 8, pieceTypes: ['bishop'], feature: 'open' },
  { start: 51, end: 60, boardSize: 8, pieceTypes: ['king'], feature: 'king' },
  { start: 61, end: 70, boardSize: 8, pieceTypes: ['queen'], feature: 'open' },
  { start: 71, end: 80, boardSize: 8, pieceTypes: ['knight'], feature: 'open' },
  { start: 81, end: 90, boardSize: 8, pieceTypes: ['pawn'], feature: 'pawnAdvanced' },
  { start: 91, end: 100, boardSize: 8, pieceTypes: MIXED_TYPES, feature: 'mixed' },
];

function blockFor(level: number): BlockConfig {
  const block = BLOCKS.find((b) => level >= b.start && level <= b.end);
  if (!block) throw new Error(`piece-quiz: niveau hors plage (${level})`);
  return block;
}

function boardFromPieces(size: 5 | 8, pieces: PlacedPiece[]): Board {
  const board = createEmptyBoard(size);
  for (const p of pieces) board[p.square] = { type: p.type, side: p.side };
  return board;
}

// Prédicat unique de validité — utilisé aussi bien par le générateur pour
// accepter/rejeter un candidat que par generate.test.ts pour vérifier les
// garanties de la spec : une seule définition de « position valide », jamais
// deux versions qui pourraient diverger.
export function isValidQuestion(question: PieceQuizQuestion, level: number): boolean {
  if (question.expectedSquares.length < 1) return false;
  if (level > 10 && question.expectedSquares.length < 2) return false;
  if (level < 71 && (question.pawnDoubleStepEnabled || question.enPassantSquare !== null)) return false;

  if (question.pieceType === 'king') {
    const board = boardFromPieces(question.boardSize, question.pieces);
    // Case du roi retirée du calcul : une pièce adverse qui l'attaquait au
    // travers de sa propre case continue d'attaquer les cases situées
    // derrière lui (voir chess/attacks.ts) — nécessaire pour que « aucune
    // destination attaquée » ait un sens une fois le roi déplacé.
    const attacked = attackedSquares(board, question.boardSize, 'enemy', question.queriedSquare);
    if (attacked.has(question.queriedSquare)) return false;
    if (question.expectedSquares.some((sq) => attacked.has(sq))) return false;
  }

  return true;
}

interface RawCandidate {
  queriedSquare: number;
  pieces: PlacedPiece[];
  pawnDoubleStep: boolean;
  enPassantSquare: number | null;
  lastMove: { from: number; to: number } | null;
}

function addRandomDecoys(rng: () => number, size: number, pieces: PlacedPiece[], count: number): void {
  const used = new Set(pieces.map((p) => p.square));
  for (let i = 0; i < count; i++) {
    let target: number | null = null;
    for (let attempt = 0; attempt < 20; attempt++) {
      const candidate = cellOf(size, randInt(rng, 0, size - 1), randInt(rng, 0, size - 1));
      if (!used.has(candidate)) {
        target = candidate;
        break;
      }
    }
    if (target === null) break;
    used.add(target);
    pieces.push({ square: target, type: pick(rng, OBSTACLE_TYPES), side: rng() < 0.5 ? 'own' : 'enemy' });
  }
}

// Un peu plus de chances de se rapprocher d'un bord à mesure que la
// difficulté monte dans le bloc — jamais garanti, juste plus fréquent
// (spec : « pièce interrogée plus près des bords »).
function biasedCoord(rng: () => number, size: number, difficulty: number): number {
  if (rng() < difficulty * 0.6) return rng() < 0.5 ? 0 : size - 1;
  return randInt(rng, 0, size - 1);
}

function buildPlainPawn(rng: () => number, size: number): RawCandidate {
  const row = randInt(rng, 0, size - 2);
  const col = randInt(rng, 0, size - 1);
  const sq = cellOf(size, row, col);
  return {
    queriedSquare: sq,
    pieces: [{ square: sq, type: 'pawn', side: 'own' }],
    pawnDoubleStep: false,
    enPassantSquare: null,
    lastMove: null,
  };
}

function buildPawnCapture(rng: () => number, size: number, forceRule: boolean, difficulty: number): RawCandidate {
  const row = randInt(rng, 0, size - 2);
  const col = randInt(rng, 0, size - 1);
  const sq = cellOf(size, row, col);
  const pieces: PlacedPiece[] = [{ square: sq, type: 'pawn', side: 'own' }];
  const diagCols = [col - 1, col + 1].filter((c) => c >= 0 && c < size);

  if (forceRule && diagCols.length > 0) {
    const count = diagCols.length === 2 && rng() < 0.3 + 0.5 * difficulty ? 2 : 1;
    for (const c of shuffle(rng, diagCols).slice(0, count)) {
      pieces.push({ square: cellOf(size, row + 1, c), type: pick(rng, OBSTACLE_TYPES), side: 'enemy' });
    }
  } else if (!forceRule && diagCols.length > 0 && rng() < 0.3) {
    // Décoy amie sur une diagonale (jamais prenable) : ajoute une pièce sans
    // changer la réponse, pour un peu de variété sur la question « hors
    // règle » du niveau.
    const c = pick(rng, diagCols);
    pieces.push({ square: cellOf(size, row + 1, c), type: pick(rng, OBSTACLE_TYPES), side: 'own' });
  }

  return { queriedSquare: sq, pieces, pawnDoubleStep: false, enPassantSquare: null, lastMove: null };
}

function buildPawnBlock(rng: () => number, size: number, forceRule: boolean, difficulty: number): RawCandidate {
  const row = randInt(rng, 0, size - 2);
  // Le blocage a besoin des deux diagonales pour garantir >= 2 cases
  // accessibles malgré l'avance bloquée (niveaux 21-30, tous > 10) : colonne
  // non-bord dans ce cas.
  const col = forceRule ? randInt(rng, 1, size - 2) : randInt(rng, 0, size - 1);
  const sq = cellOf(size, row, col);
  const pieces: PlacedPiece[] = [{ square: sq, type: 'pawn', side: 'own' }];

  if (forceRule) {
    const blockerSide: Side = rng() < 0.5 ? 'own' : 'enemy';
    pieces.push({ square: cellOf(size, row + 1, col), type: pick(rng, OBSTACLE_TYPES), side: blockerSide });
    pieces.push({ square: cellOf(size, row + 1, col - 1), type: pick(rng, OBSTACLE_TYPES), side: 'enemy' });
    pieces.push({ square: cellOf(size, row + 1, col + 1), type: pick(rng, OBSTACLE_TYPES), side: 'enemy' });
    void difficulty; // pas d'usage de la difficulté ici, gardé pour une signature homogène
  } else {
    const diagCols = [col - 1, col + 1].filter((c) => c >= 0 && c < size);
    if (diagCols.length > 0) {
      pieces.push({ square: cellOf(size, row + 1, pick(rng, diagCols)), type: pick(rng, OBSTACLE_TYPES), side: 'enemy' });
    }
  }

  return { queriedSquare: sq, pieces, pawnDoubleStep: false, enPassantSquare: null, lastMove: null };
}

function buildOpen(rng: () => number, size: number, pieceType: PieceType, difficulty: number): RawCandidate {
  const row = biasedCoord(rng, size, difficulty);
  const col = biasedCoord(rng, size, difficulty);
  const sq = cellOf(size, row, col);
  const pieces: PlacedPiece[] = [{ square: sq, type: pieceType, side: 'own' }];
  addRandomDecoys(rng, size, pieces, Math.round(difficulty * 5));
  return { queriedSquare: sq, pieces, pawnDoubleStep: false, enPassantSquare: null, lastMove: null };
}

function buildKing(rng: () => number, size: number, difficulty: number): RawCandidate {
  const row = biasedCoord(rng, size, difficulty);
  const col = biasedCoord(rng, size, difficulty);
  const sq = cellOf(size, row, col);
  const pieces: PlacedPiece[] = [{ square: sq, type: 'king', side: 'own' }];
  addRandomDecoys(rng, size, pieces, Math.round(difficulty * 4));
  return { queriedSquare: sq, pieces, pawnDoubleStep: false, enPassantSquare: null, lastMove: null };
}

// Rangée où atterrit un pion adverse qui vient de faire un double pas depuis
// sa rangée de départ (size - 2) — fixe, indépendante de la difficulté :
// c'est la seule rangée où la prise en passant est géométriquement possible.
function buildEnPassant(rng: () => number, size: number): RawCandidate | null {
  const row = size - 4;
  const col = randInt(rng, 0, size - 1);
  const enemyCols = [col - 1, col + 1].filter((c) => c >= 0 && c < size);
  if (enemyCols.length === 0) return null;
  const enemyCol = pick(rng, enemyCols);

  const sq = cellOf(size, row, col);
  const enemyTo = cellOf(size, row, enemyCol);
  const enemyFrom = cellOf(size, row + 2, enemyCol);
  const skipped = cellOf(size, row + 1, enemyCol);

  const pieces: PlacedPiece[] = [
    { square: sq, type: 'pawn', side: 'own' },
    { square: enemyTo, type: 'pawn', side: 'enemy' },
  ];

  return {
    queriedSquare: sq,
    pieces,
    pawnDoubleStep: false,
    enPassantSquare: skipped,
    lastMove: { from: enemyFrom, to: enemyTo },
  };
}

function buildDoubleStep(rng: () => number, size: number): RawCandidate {
  const row = 1; // rangée de départ d'un pion ami
  const col = randInt(rng, 0, size - 1);
  const sq = cellOf(size, row, col);
  return {
    queriedSquare: sq,
    pieces: [{ square: sq, type: 'pawn', side: 'own' }],
    pawnDoubleStep: true,
    enPassantSquare: null,
    lastMove: null,
  };
}

function buildPawnAdvanced(rng: () => number, size: number, forceRule: boolean, difficulty: number): RawCandidate | null {
  if (!forceRule) return buildPawnCapture(rng, size, true, difficulty);
  if (rng() < 0.5) return buildEnPassant(rng, size);
  return buildDoubleStep(rng, size);
}

function buildMixed(rng: () => number, size: number, difficulty: number): RawCandidate | null {
  const pieceType = pick(rng, MIXED_TYPES);
  switch (pieceType) {
    case 'king':
      return buildKing(rng, size, difficulty);
    case 'pawn': {
      const roll = rng();
      if (roll < 0.25) return buildEnPassant(rng, size);
      if (roll < 0.5) return buildDoubleStep(rng, size);
      if (roll < 0.75) return buildPawnCapture(rng, size, true, difficulty);
      return buildPawnBlock(rng, size, true, difficulty);
    }
    default:
      return buildOpen(rng, size, pieceType, difficulty);
  }
}

function buildCandidate(
  rng: () => number,
  cfg: BlockConfig,
  difficulty: number,
  forceRule: boolean,
): RawCandidate | null {
  switch (cfg.feature) {
    case 'plain':
      return buildPlainPawn(rng, cfg.boardSize);
    case 'pawnCapture':
      return buildPawnCapture(rng, cfg.boardSize, forceRule, difficulty);
    case 'pawnBlock':
      return buildPawnBlock(rng, cfg.boardSize, forceRule, difficulty);
    case 'pawnAdvanced':
      return buildPawnAdvanced(rng, cfg.boardSize, forceRule, difficulty);
    case 'king':
      return buildKing(rng, cfg.boardSize, difficulty);
    case 'open':
      return buildOpen(rng, cfg.boardSize, pick(rng, cfg.pieceTypes), difficulty);
    case 'mixed':
      return buildMixed(rng, cfg.boardSize, difficulty);
  }
}

function finalizeQuestion(cfg: BlockConfig, level: number, raw: RawCandidate): PieceQuizQuestion | null {
  const board = boardFromPieces(cfg.boardSize, raw.pieces);
  const options: ReachOptions = { pawnDoubleStep: raw.pawnDoubleStep, enPassantSquare: raw.enPassantSquare };
  const piece = board[raw.queriedSquare];
  if (piece === null) return null;
  const expectedSquares = reachableSquares(board, cfg.boardSize, raw.queriedSquare, options).sort((a, b) => a - b);

  const question: PieceQuizQuestion = {
    boardSize: cfg.boardSize,
    pieceType: piece.type,
    pieces: raw.pieces,
    queriedSquare: raw.queriedSquare,
    expectedSquares,
    pawnDoubleStepEnabled: raw.pawnDoubleStep,
    enPassantSquare: raw.enPassantSquare,
    lastMove: raw.lastMove,
  };

  return isValidQuestion(question, level) ? question : null;
}

// Filet de sécurité si le tirage aléatoire n'a rien trouvé de valide après
// QUESTION_ATTEMPTS essais (en pratique jamais atteint sur les positions
// testées, voir generate.test.ts) : une position minimale, toujours valide
// par construction, qui ne relâche que la difficulté (moins de pièces),
// jamais les garanties (spec, §« Génération des positions »).
function fallbackQuestion(rng: () => number, level: number, cfg: BlockConfig): PieceQuizQuestion | null {
  const size = cfg.boardSize;
  const pieceType = cfg.pieceTypes.includes('pawn') ? 'pawn' : cfg.pieceTypes[0];

  if (pieceType === 'pawn') {
    const row = randInt(rng, 0, size - 2);
    const col = randInt(rng, 0, size - 1);
    const sq = cellOf(size, row, col);
    const pieces: PlacedPiece[] = [{ square: sq, type: 'pawn', side: 'own' }];
    if (level > 10) {
      const diagCols = [col - 1, col + 1].filter((c) => c >= 0 && c < size);
      if (diagCols.length === 0) return null;
      pieces.push({ square: cellOf(size, row + 1, pick(rng, diagCols)), type: 'rook', side: 'enemy' });
    }
    return finalizeQuestion(cfg, level, { queriedSquare: sq, pieces, pawnDoubleStep: false, enPassantSquare: null, lastMove: null });
  }

  const sq = cellOf(size, randInt(rng, 0, size - 1), randInt(rng, 0, size - 1));
  const pieces: PlacedPiece[] = [{ square: sq, type: pieceType, side: 'own' }];
  return finalizeQuestion(cfg, level, { queriedSquare: sq, pieces, pawnDoubleStep: false, enPassantSquare: null, lastMove: null });
}

function canonicalKey(question: PieceQuizQuestion): string {
  const piecesKey = [...question.pieces]
    .sort((a, b) => a.square - b.square)
    .map((p) => `${p.square}:${p.type}:${p.side}`)
    .join(',');
  return `${question.pieceType}|${question.queriedSquare}|${piecesKey}|${question.pawnDoubleStepEnabled}|${question.enPassantSquare}`;
}

const QUESTION_ATTEMPTS = 150;
const FALLBACK_ATTEMPTS = 30;

// Cinq questions distinctes, déterministes à partir de (seed, level) : la
// spec exige la génération au niveau du bloc (pas question par question) pour
// pouvoir vérifier « majorité des questions » et « distinctes entre elles »,
// qui sont des propriétés du niveau entier.
export function generateLevel(seed: number, level: number): PieceQuizQuestion[] {
  const cfg = blockFor(level);
  const difficulty = cfg.end === cfg.start ? 0 : (level - cfg.start) / (cfg.end - cfg.start);
  const rng = mulberry32((seed ^ (level * 0x9e3779b9)) >>> 0);

  const needsMajority = cfg.feature === 'pawnCapture' || cfg.feature === 'pawnBlock' || cfg.feature === 'pawnAdvanced';
  // Une seule question du niveau, tirée au sort, n'exerce pas la règle
  // introduite par le bloc — le reste (4/5) l'exerce toujours : respecte la
  // « majorité » demandée par la spec sans forcer 5/5 à chaque fois.
  const offIndex = needsMajority ? randInt(rng, 0, QUESTIONS_PER_LEVEL - 1) : -1;

  const questions: PieceQuizQuestion[] = [];
  const usedKeys = new Set<string>();

  for (let i = 0; i < QUESTIONS_PER_LEVEL; i++) {
    const forceRule = i !== offIndex;
    let question: PieceQuizQuestion | null = null;

    for (let attempt = 0; attempt < QUESTION_ATTEMPTS && !question; attempt++) {
      const candidate = buildCandidate(rng, cfg, difficulty, forceRule);
      const finalized = candidate ? finalizeQuestion(cfg, level, candidate) : null;
      if (finalized && !usedKeys.has(canonicalKey(finalized))) question = finalized;
    }

    for (let attempt = 0; attempt < FALLBACK_ATTEMPTS && !question; attempt++) {
      const finalized = fallbackQuestion(rng, level, cfg);
      if (finalized && !usedKeys.has(canonicalKey(finalized))) question = finalized;
    }

    if (!question) throw new Error(`piece-quiz: génération impossible (niveau ${level}, question ${i})`);
    usedKeys.add(canonicalKey(question));
    questions.push(question);
  }

  return questions;
}
