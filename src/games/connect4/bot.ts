import type { PlayerId } from '../types';
import { applyMove, colOf, columnHeight, COLS, LINE_DIRECTIONS, ROWS, rowOf } from './logic';
import type { Cell, Connect4Move, Connect4State } from './logic';

// mulberry32 : PRNG seedé, quelques lignes, déterministe. Jamais Math.random()
// (CLAUDE.md, règle 3) — toute variation dérive de state.seed et du nombre de
// pions déjà posés (pas de champ moveCount dédié, comme tictactoe : ce
// compte croît strictement, contrairement à chess-race où des pions
// disparaissent en se faisant prendre).
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function movesPlayed(state: Connect4State): number {
  return state.board.filter((c) => c !== null).length;
}

function pickAmong(state: Connect4State, moves: Connect4Move[]): Connect4Move {
  if (moves.length === 1) return moves[0];
  const random = mulberry32((state.seed ^ (movesPlayed(state) * 0x9e3779b9)) >>> 0);
  return moves[Math.floor(random() * moves.length)];
}

function legalColumns(state: Connect4State): number[] {
  const cols: number[] = [];
  for (let col = 0; col < COLS; col++) {
    if (columnHeight(state.board, col) < ROWS) cols.push(col);
  }
  return cols;
}

// Alignement à 4 en comptant depuis `cell` dans les deux sens de chaque axe —
// seule case qui vient de changer, donc seul point de départ possible pour un
// *nouvel* alignement. Beaucoup plus rapide que de rebalayer tout le plateau
// (logic.getWinningLine) à chaque nœud de la recherche ; le contrat public
// (Board.tsx, getResult) continue lui de passer par getWinningLine.
function winsAt(board: Cell[], cell: number, player: PlayerId): boolean {
  const row = rowOf(cell);
  const col = colOf(cell);
  for (const [dr, dc] of LINE_DIRECTIONS) {
    let count = 1;
    for (const sign of [1, -1]) {
      let r = row + dr * sign;
      let c = col + dc * sign;
      while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r * COLS + c] === player) {
        count++;
        r += dr * sign;
        c += dc * sign;
      }
    }
    if (count >= 4) return true;
  }
  return false;
}

function wouldWin(board: Cell[], col: number, player: PlayerId): boolean {
  const row = columnHeight(board, col);
  if (row >= ROWS) return false;
  const trial = board.slice();
  trial[row * COLS + col] = player;
  return winsAt(trial, row * COLS + col, player);
}

// ---- niveau 1 — l'œuf : coup légal tiré au hasard ----

function chooseRandom(state: Connect4State): Connect4Move {
  return pickAmong(
    state,
    legalColumns(state).map((col) => ({ col })),
  );
}

// ---- niveau 2 — le poussin : gagne si possible, sinon bloque, sinon colonne
// la plus centrale (davantage de lignes possibles y passent) ----

const CENTER_COL = 3;

function findWinningColumn(state: Connect4State, player: PlayerId): number | null {
  for (const col of legalColumns(state)) {
    if (wouldWin(state.board, col, player)) return col;
  }
  return null;
}

function chooseMedium(state: Connect4State): Connect4Move {
  const ownWin = findWinningColumn(state, state.turn);
  if (ownWin !== null) return { col: ownWin };

  const [p1, p2] = state.players;
  const opponent = state.turn === p1 ? p2 : p1;
  const block = findWinningColumn(state, opponent);
  if (block !== null) return { col: block };

  const cols = legalColumns(state);
  const bestDistance = Math.min(...cols.map((col) => Math.abs(col - CENTER_COL)));
  const central = cols.filter((col) => Math.abs(col - CENTER_COL) === bestDistance);
  return pickAmong(
    state,
    central.map((col) => ({ col })),
  );
}

// ---- niveaux 3 et 4 — minimax (negamax) alpha-bêta ----

const WIN_SCORE = 1_000_000;
// Ordre centre -> bords : les colonnes centrales coupent le plus de lignes
// possibles, donc y jouer produit statistiquement les meilleurs coups —
// les explorer en premier resserre alpha/bêta plus tôt et élague bien plus
// (essentiel ici : branchement 7, contrairement au 9 cases figées du morpion).
const CENTER_ORDER = [3, 2, 4, 1, 5, 0, 6];

function orderedColumns(state: Connect4State): number[] {
  return CENTER_ORDER.filter((col) => columnHeight(state.board, col) < ROWS);
}

function windowScore(cells: Cell[], player: PlayerId, opponent: PlayerId): number {
  let mine = 0;
  let theirs = 0;
  for (const cell of cells) {
    if (cell === player) mine++;
    else if (cell === opponent) theirs++;
  }
  if (mine > 0 && theirs > 0) return 0; // fenêtre contestée, morte pour les deux camps
  if (mine > 0) return [0, 1, 10, 50][mine];
  if (theirs > 0) return -[0, 1, 10, 50][theirs];
  return 0;
}

// Nombre de colonnes où `player` gagnerait immédiatement en y jouant. Une
// simple recherche à profondeur fixe s'arrête parfois sur une position où un
// camp a déjà une case gagnante posée là, sans que le coup ait été exploré
// (le budget de profondeur est épuisé un coup trop tôt) — sans ce terme,
// l'heuristique par fenêtres ne voit pas la différence entre « menace prête à
// être jouée » et « simple potentiel à trois coups d'écart », et une
// recherche plus profonde peut alors se diriger tout droit vers un piège
// qu'une recherche plus courte évitait par accident. Coûteux à calculer
// (jusqu'à 7 simulations de coup), mais seulement appelé aux feuilles.
function immediateThreats(board: Cell[], player: PlayerId): number {
  let count = 0;
  for (let col = 0; col < COLS; col++) {
    if (wouldWin(board, col, player)) count++;
  }
  return count;
}

const IMMEDIATE_THREAT_WEIGHT = 500;

// Score du point de vue de state.turn : menaces prêtes à être jouées
// (le terme qui pèse le plus lourd), puis pour chaque fenêtre de 4 cases (les
// mêmes lignes que logic.getWinningLine) le potentiel encore vivant de
// chaque camp, plus un bonus de colonne centrale.
function evaluate(state: Connect4State): number {
  const player = state.turn;
  const [p1, p2] = state.players;
  const opponent = player === p1 ? p2 : p1;
  let score = 0;

  score += immediateThreats(state.board, player) * IMMEDIATE_THREAT_WEIGHT;
  score -= immediateThreats(state.board, opponent) * IMMEDIATE_THREAT_WEIGHT;

  for (let row = 0; row < ROWS; row++) {
    const centerCell = state.board[row * COLS + CENTER_COL];
    if (centerCell === player) score += 3;
    else if (centerCell === opponent) score -= 3;
  }

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      for (const [dr, dc] of LINE_DIRECTIONS) {
        const cells: Cell[] = [];
        let inBounds = true;
        for (let i = 0; i < 4; i++) {
          const r = row + dr * i;
          const c = col + dc * i;
          if (r < 0 || r >= ROWS || c < 0 || c >= COLS) {
            inBounds = false;
            break;
          }
          cells.push(state.board[r * COLS + c]);
        }
        if (inBounds) score += windowScore(cells, player, opponent);
      }
    }
  }
  return score;
}

// Score, du point de vue du joueur au trait dans `state` (negamax standard).
// `state.lastMove` porte toujours le dernier coup joué (par l'autre camp,
// state.turn ayant déjà tourné dans applyMove) : winsAt() ne revérifie que ce
// point-là, jamais tout le plateau.
function negamaxScore(state: Connect4State, depth: number, alpha: number, beta: number): number {
  if (state.lastMove !== null) {
    const [p1, p2] = state.players;
    const mover = state.turn === p1 ? p2 : p1;
    if (winsAt(state.board, state.lastMove, mover)) {
      return -(WIN_SCORE + depth); // gagner plus vite (depth restant plus grand) vaut mieux
    }
  }
  if (state.board.every((cell) => cell !== null)) return 0; // nul

  if (depth === 0) return evaluate(state);

  let best = -Infinity;
  for (const col of orderedColumns(state)) {
    const score = -negamaxScore(applyMove(state, { col }), depth - 1, -beta, -alpha);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

// Recherche pure, profondeur fixée — aucune horloge lue ici. C'est la brique
// déterministe : les tests de force et de déterminisme s'appuient dessus
// directement plutôt que sur le budget temps du niveau 4 (voir bot.test.ts).
export function searchBestMove(state: Connect4State, depth: number): Connect4Move {
  const columns = orderedColumns(state);
  let bestScore = -Infinity;
  let bestMoves: Connect4Move[] = [];
  let alpha = -Infinity;
  const beta = Infinity;

  for (const col of columns) {
    const score = -negamaxScore(applyMove(state, { col }), depth - 1, -beta, -alpha);
    if (score > bestScore) {
      bestScore = score;
      bestMoves = [{ col }];
    } else if (score === bestScore) {
      bestMoves.push({ col });
    }
    if (score > alpha) alpha = score;
  }

  return pickAmong(state, bestMoves);
}

// ---- niveau 4 — le coq : approfondissement itératif sous budget de temps ----
//
// Contrairement à chess-race (branchement borné par le nombre de poussins,
// coût qui croît en douceur d'une profondeur à l'autre), le branchement ici
// est fixe à 7 colonnes et sans table de transposition : une profondeur de
// plus peut coûter de 2x à 7-8x la précédente selon la position (mesuré sur
// plateau vide, machine de développement — voir NOTES.md). Se fier à une
// seule marge fixe (comme chess-race) risquerait soit de gâcher le budget,
// soit de le dépasser largement une fois sur deux. À la place : on projette
// le coût de la prochaine profondeur à partir du coût réel de la précédente
// (facteur de croissance pessimiste), et on ne la lance que si la projection
// tient dans le budget. Le budget de 500 ms se vérifie sur l'iPad réel
// (NOTES.md) — mesuré ici seulement sur machine de dev, bien plus rapide
// qu'un A8X de 2015.
const TIME_BUDGET_MS = 500;
const GROWTH_ESTIMATE = 6;
const MAX_DEPTH = 12;

function iterativeDeepen(state: Connect4State, budgetMs: number): Connect4Move {
  const start = performance.now();
  let depthStart = performance.now();
  let best = searchBestMove(state, 1);
  let lastDepthMs = performance.now() - depthStart;

  for (let depth = 2; depth <= MAX_DEPTH; depth++) {
    const elapsed = performance.now() - start;
    const projected = elapsed + lastDepthMs * GROWTH_ESTIMATE;
    if (projected >= budgetMs) break;
    depthStart = performance.now();
    best = searchBestMove(state, depth);
    lastDepthMs = performance.now() - depthStart;
  }
  return best;
}

// ---- point d'entrée du contrat GameModule.bot ----

const DEPTH_LEVEL_3 = 5;

export function chooseMove(state: Connect4State, level: number): Connect4Move {
  switch (level) {
    case 1:
      return chooseRandom(state);
    case 2:
      return chooseMedium(state);
    case 3:
      return searchBestMove(state, DEPTH_LEVEL_3);
    case 4:
      return iterativeDeepen(state, TIME_BUDGET_MS);
    default:
      return chooseRandom(state);
  }
}
