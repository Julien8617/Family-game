import type { PlayerId } from '../types';
import { applyMove, getResult, LINES } from './logic';
import type { Cell, TicTacToeMove, TicTacToeState } from './logic';

// mulberry32 : PRNG seedé, quelques lignes, déterministe. Jamais Math.random()
// (CLAUDE.md, règle 3) — toute variation dérive de state.seed et du nombre de
// cases déjà jouées (pas de champ moveCount dédié ici, contrairement à
// chess-race : le nombre de cases non vides suffit, il croît strictement).
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function legalMoves(state: TicTacToeState): TicTacToeMove[] {
  const moves: TicTacToeMove[] = [];
  for (let cell = 0; cell < state.board.length; cell++) {
    if (state.board[cell] === null) moves.push({ cell });
  }
  return moves;
}

function movesPlayed(state: TicTacToeState): number {
  return state.board.filter((c) => c !== null).length;
}

function pickAmong(state: TicTacToeState, moves: TicTacToeMove[]): TicTacToeMove {
  if (moves.length === 1) return moves[0];
  const random = mulberry32((state.seed ^ (movesPlayed(state) * 0x9e3779b9)) >>> 0);
  return moves[Math.floor(random() * moves.length)];
}

// ---- niveau 1 — facile : coup légal tiré au hasard ----

function chooseRandom(state: TicTacToeState): TicTacToeMove {
  return pickAmong(state, legalMoves(state));
}

// ---- niveau 2 — moyen : gagne si possible, sinon bloque, sinon au hasard ----

// Le plateau tel qu'il serait si `player` jouait sur `cell` maintenant —
// indépendant de state.turn, pour pouvoir tester aussi bien son propre coup
// gagnant que celui que l'adversaire jouerait à son prochain tour.
function wouldWin(board: Cell[], cell: number, player: PlayerId): boolean {
  const trial = board.slice();
  trial[cell] = player;
  return LINES.some(([a, b, c]) => trial[a] !== null && trial[a] === trial[b] && trial[a] === trial[c]);
}

function findWinningMove(state: TicTacToeState, player: PlayerId): TicTacToeMove | null {
  for (const move of legalMoves(state)) {
    if (wouldWin(state.board, move.cell, player)) return move;
  }
  return null;
}

function chooseMedium(state: TicTacToeState): TicTacToeMove {
  const ownWin = findWinningMove(state, state.turn);
  if (ownWin) return ownWin;

  const [p1, p2] = state.players;
  const opponent = state.turn === p1 ? p2 : p1;
  const block = findWinningMove(state, opponent);
  if (block) return block;

  return pickAmong(state, legalMoves(state));
}

// ---- niveau 3 — imbattable : minimax exhaustif (espace d'états minuscule,
// au plus 9 coups à jouer — aucun besoin de profondeur limitée ni d'horloge,
// contrairement au moteur bien plus profond de chess-race) ----

// Score du point de vue de state.turn. Un état terminal atteint par
// récursion est toujours une défaite ou un nul pour state.turn : le joueur
// qui vient de jouer (et qui a éventuellement gagné) n'est jamais state.turn,
// applyMove ayant déjà fait passer le trait à l'autre camp.
function negamax(state: TicTacToeState): number {
  const result = getResult(state);
  if (result) {
    if (result.kind === 'draw') return 0;
    return result.winner === state.turn ? 1 : -1;
  }
  let best = -Infinity;
  for (const move of legalMoves(state)) {
    const score = -negamax(applyMove(state, move));
    if (score > best) best = score;
  }
  return best;
}

function chooseUnbeatable(state: TicTacToeState): TicTacToeMove {
  const moves = legalMoves(state);
  let bestScore = -Infinity;
  let bestMoves: TicTacToeMove[] = [];
  for (const move of moves) {
    const score = -negamax(applyMove(state, move));
    if (score > bestScore) {
      bestScore = score;
      bestMoves = [move];
    } else if (score === bestScore) {
      bestMoves.push(move);
    }
  }
  return pickAmong(state, bestMoves);
}

// ---- point d'entrée du contrat GameModule.bot ----

export function chooseMove(state: TicTacToeState, level: number): TicTacToeMove {
  switch (level) {
    case 1:
      return chooseRandom(state);
    case 2:
      return chooseMedium(state);
    case 3:
      return chooseUnbeatable(state);
    default:
      return chooseRandom(state);
  }
}

// Contre l'Imbattable, un enfant qui perd trois fois d'affilée sans jamais
// gagner ni faire nul risque de se lasser du jeu — pas de la difficulté, de
// l'impossibilité. Adoucit alors discrètement (le sélecteur reste sur
// « Imbattable », rien ne l'indique) : Moyen à partir de 3 défaites
// d'affilée, Facile à partir de 5. Toute victoire ou tout nul remet le
// compteur à zéro côté appelant (App.tsx) — ne concerne que ce niveau,
// Facile et Moyen choisis explicitement ne sont jamais réajustés.
export function adjustLevel(selectedLevel: number, lossStreak: number): number {
  if (selectedLevel !== 3) return selectedLevel;
  if (lossStreak >= 5) return 1;
  if (lossStreak >= 3) return 2;
  return 3;
}
