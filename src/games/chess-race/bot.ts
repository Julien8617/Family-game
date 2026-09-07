import type { PlayerId } from '../types';
import {
  allLegalMoves,
  applyMove,
  cellOf,
  colOf,
  getResult,
  rowOf,
  SIZE,
} from './logic';
import type { ChessRaceMove, ChessRaceState } from './logic';

// mulberry32 : PRNG seedé, quelques lignes, déterministe. Jamais Math.random()
// (CLAUDE.md, règle 3) — toute variation dérive de state.seed et
// state.moveCount, déjà rangés dans l'état par logic.ts.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickAmong(state: ChessRaceState, moves: ChessRaceMove[]): ChessRaceMove {
  if (moves.length === 1) return moves[0];
  const random = mulberry32((state.seed ^ (state.moveCount * 0x9e3779b9)) >>> 0);
  return moves[Math.floor(random() * moves.length)];
}

// ---- niveau 1 — l'œuf : coup légal tiré au hasard ----

function chooseRandom(state: ChessRaceState): ChessRaceMove {
  return pickAmong(state, allLegalMoves(state));
}

// ---- niveau 2 — le poussin : glouton sur un coup ----

function progress(state: ChessRaceState, cell: number): number {
  const [white] = state.players;
  const piece = state.board[cell];
  const row = rowOf(cell);
  return piece === white ? row : SIZE - 1 - row;
}

function chooseGreedy(state: ChessRaceState): ChessRaceMove {
  const moves = allLegalMoves(state);
  const captures = moves.filter((m) => state.board[m.to] !== null);
  const pool = captures.length > 0 ? captures : moves;

  let bestProgress = -Infinity;
  for (const m of pool) {
    const p = progress(state, m.from);
    if (p > bestProgress) bestProgress = p;
  }
  const mostAdvanced = pool.filter((m) => progress(state, m.from) === bestProgress);
  return pickAmong(state, mostAdvanced);
}

// ---- niveaux 3 et 4 — minimax (negamax) alpha-bêta ----

const WIN_SCORE = 100_000;
const RACE_WEIGHT = 100;
const FREE_WEIGHT = 50;
const COUNT_WEIGHT = 10;

// Distance (en cases) du poussin le plus avancé de `player` jusqu'à sa
// rangée d'arrivée. 0 s'il n'en a plus (n'arrive jamais).
function distanceToGoal(state: ChessRaceState, player: PlayerId, isWhite: boolean): number {
  let best = -1;
  for (let cell = 0; cell < SIZE * SIZE; cell++) {
    if (state.board[cell] !== player) continue;
    const row = rowOf(cell);
    const advancement = isWhite ? row : SIZE - 1 - row;
    if (advancement > best) best = advancement;
  }
  if (best === -1) return SIZE; // aucun poussin : distance maximale, sans intérêt (compté ailleurs)
  return SIZE - 1 - best;
}

// Un poussin est « libre » si aucun adversaire ne peut jamais lui barrer la
// route ou le prendre en chemin : aucune case adverse devant lui, sur sa
// colonne ou les deux voisines (l'équivalent d'un pion passé aux échecs).
function isFree(state: ChessRaceState, cell: number, isWhite: boolean): boolean {
  const [white, black] = state.players;
  const opponent = isWhite ? black : white;
  const col = colOf(cell);
  const row = rowOf(cell);
  for (let c = Math.max(0, col - 1); c <= Math.min(SIZE - 1, col + 1); c++) {
    for (let r = 0; r < SIZE; r++) {
      const ahead = isWhite ? r > row : r < row;
      if (!ahead) continue;
      if (state.board[cellOf(r, c)] === opponent) return false;
    }
  }
  return true;
}

function evaluateWhitePerspective(state: ChessRaceState): number {
  const [white, black] = state.players;
  let whiteCount = 0;
  let blackCount = 0;
  let whiteFree = 0;
  let blackFree = 0;

  for (let cell = 0; cell < SIZE * SIZE; cell++) {
    const occupant = state.board[cell];
    if (occupant === white) {
      whiteCount++;
      if (isFree(state, cell, true)) whiteFree++;
    } else if (occupant === black) {
      blackCount++;
      if (isFree(state, cell, false)) blackFree++;
    }
  }

  let dWhite = distanceToGoal(state, white, true);
  let dBlack = distanceToGoal(state, black, false);
  // Tempo : le camp au trait est effectivement une demi-case plus proche —
  // « un coup d'avance vaut plus que n'importe quoi d'autre » dans une course.
  if (state.turn === white) dWhite -= 0.5;
  else dBlack -= 0.5;

  const raceScore = (dBlack - dWhite) * RACE_WEIGHT;
  const freeScore = (whiteFree - blackFree) * FREE_WEIGHT;
  const countScore = (whiteCount - blackCount) * COUNT_WEIGHT;

  return raceScore + freeScore + countScore;
}

function evaluate(state: ChessRaceState): number {
  const [white] = state.players;
  const score = evaluateWhitePerspective(state);
  return state.turn === white ? score : -score;
}

function orderMoves(state: ChessRaceState, moves: ChessRaceMove[]): ChessRaceMove[] {
  return moves.slice().sort((a, b) => {
    const aCapture = state.board[a.to] !== null ? 1 : 0;
    const bCapture = state.board[b.to] !== null ? 1 : 0;
    return bCapture - aCapture;
  });
}

// Score, du point de vue du joueur au trait dans `state` (negamax standard).
function negamaxScore(state: ChessRaceState, depth: number, alpha: number, beta: number): number {
  const result = getResult(state);
  if (result) {
    if (result.kind === 'draw') return 0;
    const winnerIsMover = result.winner === state.turn;
    const score = WIN_SCORE + depth; // gagner plus vite (depth restant plus grand) vaut mieux
    return winnerIsMover ? score : -score;
  }
  if (depth === 0) return evaluate(state);

  const moves = orderMoves(state, allLegalMoves(state));
  let best = -Infinity;
  for (const move of moves) {
    const score = -negamaxScore(applyMove(state, move), depth - 1, -beta, -alpha);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

// Recherche pure, profondeur fixée — aucune horloge lue ici. C'est la brique
// déterministe : les tests de force et de déterminisme s'appuient dessus
// directement plutôt que sur le budget temps du niveau 4 (voir bot.test.ts).
export function searchBestMove(state: ChessRaceState, depth: number): ChessRaceMove {
  const moves = orderMoves(state, allLegalMoves(state));
  let bestScore = -Infinity;
  let bestMoves: ChessRaceMove[] = [];
  let alpha = -Infinity;
  const beta = Infinity;

  for (const move of moves) {
    const score = -negamaxScore(applyMove(state, move), depth - 1, -beta, -alpha);
    if (score > bestScore) {
      bestScore = score;
      bestMoves = [move];
    } else if (score === bestScore) {
      bestMoves.push(move);
    }
    if (score > alpha) alpha = score;
  }

  return pickAmong(state, bestMoves);
}

// ---- niveau 4 — le coq : approfondissement itératif sous budget de temps ----
//
// La seule fonction de ce fichier qui lit l'horloge. L'horloge ne sert qu'à
// décider si une profondeur *de plus* vaut la peine d'être lancée — jamais à
// interrompre une recherche en cours — pour que chaque profondeur terminée
// reste un résultat de searchBestMove() intégralement pur. Le budget de
// 500 ms (critère 8) se vérifie sur l'iPad réel ; les tests automatisés
// mesurent la force en épinglant une profondeur (voir bot.test.ts), pas en
// rejouant ce budget des centaines de fois.

const TIME_BUDGET_MS = 500;
const SAFETY_MARGIN = 0.5; // n'attaque une profondeur de plus qu'avec cette marge de temps restante
const MAX_DEPTH = 12;

function iterativeDeepen(state: ChessRaceState, budgetMs: number): ChessRaceMove {
  const start = performance.now();
  let best = searchBestMove(state, 1);
  for (let depth = 2; depth <= MAX_DEPTH; depth++) {
    if (performance.now() - start >= budgetMs * SAFETY_MARGIN) break;
    best = searchBestMove(state, depth);
  }
  return best;
}

// ---- point d'entrée du contrat GameModule.bot ----

const DEPTH_LEVEL_3 = 4;

export function chooseMove(state: ChessRaceState, level: number): ChessRaceMove {
  switch (level) {
    case 1:
      return chooseRandom(state);
    case 2:
      return chooseGreedy(state);
    case 3:
      return searchBestMove(state, DEPTH_LEVEL_3);
    case 4:
      return iterativeDeepen(state, TIME_BUDGET_MS);
    default:
      return chooseRandom(state);
  }
}
