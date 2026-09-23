import type { PlayerId, ProgressSignal, Result } from '../types';
import { createEmptyBoard } from '../../chess/pieces';
import {
  allLegalMoves,
  applyMove,
  createState,
  extractPositions,
  getResult,
  isValidMove,
  SIZE,
} from './logic';
import type { KingHuntMove, KingHuntState } from './logic';

// Adversaire artificiel à quatre niveaux (spec 07, revu solo-tours après
// retour utilisateur : jouer le roi contre un niveau fort est structurellement
// invivable, la finale « deux tours contre roi » est gagnée d'avance pour les
// tours en jeu parfait — voir NOTES.md). Pur et déterministe (CLAUDE.md règle
// 3, ARCHITECTURE.md invariant 6) : chooseMove ne lit ni l'horloge ni
// Math.random(). Reste générique sur le camp au trait (utile aux tests, qui
// simulent aussi un « joueur de tours parfait ») même si en jeu réel seul le
// roi est jamais piloté par ce fichier — voir la couche « manche » plus bas,
// seule exposée au contrat GameModule (index.ts).

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickAmong(state: KingHuntState, moves: KingHuntMove[]): KingHuntMove {
  if (moves.length === 1) return moves[0];
  const random = mulberry32((state.seed ^ (state.moveCount * 0x9e3779b9)) >>> 0);
  return moves[Math.floor(random() * moves.length)];
}

function moverPlayerId(state: KingHuntState): PlayerId {
  return state.turn === 'rooks' ? state.players[0] : state.players[1];
}

// Un coup qui termine la partie tout de suite en faveur de qui joue (une
// tour qui prend le roi, ou le roi qui mange une tour) — toujours joué aux
// niveaux 2 à 4 (« mange une tour s'il peut », spec 07). Le niveau 1 ne s'en
// sert pas : coup légal au hasard, sans préférence, y compris pour une
// capture (spec 07, tableau des niveaux).
function winningMoveIfAny(state: KingHuntState): KingHuntMove | null {
  const mover = moverPlayerId(state);
  for (const move of allLegalMoves(state)) {
    const result = getResult(applyMove(state, move));
    if (result?.kind === 'win' && result.winner === mover) return move;
  }
  return null;
}

// ---- niveau 1 — l'œuf : coup légal tiré au hasard ----

function chooseRandom(state: KingHuntState): KingHuntMove {
  return pickAmong(state, allLegalMoves(state));
}

// ---- niveau 2 — le poussin : glouton sur un coup ----
//
// Heuristique volontairement simple (technique de l'escalier réduite à
// l'essentiel) : la mobilité du roi (moins de cases où fuir) et sa distance
// au bord (le pousser vers le bord) sont bonnes pour les tours, mauvaises
// pour le roi — un seul coup d'avance suffit pour donner l'impression du
// filet qui se resserre sans calculer une vraie recherche.

const MOBILITY_WEIGHT = 10;
const EDGE_WEIGHT = 6;

function kingSquareOf(state: KingHuntState): number {
  const positions = extractPositions(state.board);
  return positions ? positions.king : -1;
}

function kingMobility(state: KingHuntState): number {
  const king = kingSquareOf(state);
  if (king === -1) return 0;
  const row = Math.floor(king / SIZE);
  const col = king % SIZE;
  let count = 0;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r = row + dr;
      const c = col + dc;
      if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) continue;
      const target = r * SIZE + c;
      const occupant = state.board[target];
      // Case libre, ou occupée par une tour (le roi peut toujours la
      // prendre, spec 07 : « le roi mange toute tour voisine ») — pas une
      // case tenue par une autre pièce amie (il n'y en a pas ici).
      if (occupant === null || occupant.type === 'rook') count++;
    }
  }
  return count;
}

function kingEdgeDistance(state: KingHuntState): number {
  const king = kingSquareOf(state);
  if (king === -1) return 0;
  const row = Math.floor(king / SIZE);
  const col = king % SIZE;
  return Math.min(row, SIZE - 1 - row, col, SIZE - 1 - col);
}

// Score du point de vue des tours (positif = bon pour les tours) — négué
// pour le roi dans evaluate().
function evaluateRooksPerspective(state: KingHuntState): number {
  return -(MOBILITY_WEIGHT * kingMobility(state) + EDGE_WEIGHT * kingEdgeDistance(state));
}

function evaluate(state: KingHuntState): number {
  const score = evaluateRooksPerspective(state);
  return state.turn === 'rooks' ? score : -score;
}

function chooseGreedy(state: KingHuntState): KingHuntMove {
  const moves = allLegalMoves(state);
  let best = -Infinity;
  let bestMoves: KingHuntMove[] = [];
  for (const move of moves) {
    const score = -evaluate(applyMove(state, move));
    if (score > best) {
      best = score;
      bestMoves = [move];
    } else if (score === best) {
      bestMoves.push(move);
    }
  }
  return pickAmong(state, bestMoves);
}

// ---- niveau 3 — la poule : minimax (negamax) à profondeur limitée ----
//
// Même patron que chess-race/bot.ts (recherche pure, profondeur fixe, testée
// telle quelle) — générique sur le camp au trait, comme tout ce fichier.

const WIN_SCORE = 100_000;
const DEPTH_LEVEL_3 = 3;

function negamaxScore(state: KingHuntState, depth: number): number {
  const result = getResult(state);
  if (result) {
    // applyMove alterne toujours le trait (comme chess-race) : state.turn,
    // ici, est le camp qui aurait la main si la partie continuait — le score
    // est rendu de son point de vue (négamax standard), presque toujours
    // négatif puisque c'est l'AUTRE camp qui vient de gagner. `getResult`
    // ne renvoie jamais 'draw' dans ce jeu (voir logic.ts), mais Result le
    // permet par contrat — narrowing explicite plutôt qu'un cast.
    const winnerIsMover = result.kind === 'win' && result.winner === moverPlayerId(state);
    return winnerIsMover ? WIN_SCORE + depth : -(WIN_SCORE + depth);
  }
  if (depth === 0) return evaluate(state);

  let best = -Infinity;
  for (const move of allLegalMoves(state)) {
    const score = -negamaxScore(applyMove(state, move), depth - 1);
    if (score > best) best = score;
  }
  return best;
}

function searchBestMove(state: KingHuntState, depth: number): KingHuntMove {
  const moves = allLegalMoves(state);
  let bestScore = -Infinity;
  let bestMoves: KingHuntMove[] = [];
  for (const move of moves) {
    const score = -negamaxScore(applyMove(state, move), depth - 1);
    if (score > bestScore) {
      bestScore = score;
      bestMoves = [move];
    } else if (score === bestScore) {
      bestMoves.push(move);
    }
  }
  return pickAmong(state, bestMoves);
}

// ---- niveau 4 — le coq : défense/attaque parfaite par table résolue ----
//
// Sur 5×5, deux tours et un roi tiennent dans ~14 000 positions (300 paires
// de tours × 23 cases de roi × 2 camps au trait) — assez petit pour résoudre
// EXACTEMENT par induction arrière (comme une table de finale d'échecs),
// plutôt que d'approximer avec une recherche à profondeur limitée. La table
// donne, pour chaque position, le nombre de coups DE TOUR (jamais de roi,
// même convention que le budget) avant une capture forcée des tours en jeu
// parfait des deux côtés — ou repère qu'aucune capture ne peut être forcée
// (le roi s'échappe indéfiniment, ou peut forcer la prise d'une tour), ce
// qui revient au même du point de vue du budget : les tours ne gagnent pas.
//
// chooseMove reste pure : la table est calculée par solve() (elle-même pure,
// aucune horloge lue) et mémoïsée au premier appel (voir getSolvedTable) —
// le seul effet de bord est ce cache, jamais un résultat qui varierait d'un
// appel à l'autre pour un même state.

const SQUARES = SIZE * SIZE; // 25
const NOT_FORCED = -1;

// Encodage compact d'une position (paire de tours triée, roi, camp au
// trait) en un entier — sert d'index dans les tableaux plats de solve().
function encodeKey(rookLo: number, rookHi: number, king: number, turnBit: 0 | 1): number {
  return ((rookLo * SQUARES + rookHi) * SQUARES + king) * 2 + turnBit;
}

const SOLVER_BUDGET = 9999; // budget factice, jamais épuisé : solve() ignore la règle de budget par construction

function positionState(rooks: [number, number], king: number, turn: 'rooks' | 'king'): KingHuntState {
  const board = createEmptyBoard(SIZE);
  board[rooks[0]] = { type: 'rook', side: 'own' };
  board[rooks[1]] = { type: 'rook', side: 'own' };
  board[king] = { type: 'king', side: 'enemy' };
  return {
    board,
    turn,
    players: ['rooks', 'king'],
    seed: 0,
    level: 1,
    budgetTotal: SOLVER_BUDGET,
    budgetLeft: SOLVER_BUDGET,
    lastMove: null,
    moveCount: 0,
  };
}

interface PositionNode {
  hasImmediateWin: boolean; // ce camp peut terminer la partie à son avantage tout de suite
  children: number[]; // clés des positions atteintes par les coups qui NE terminent PAS la partie
}

interface SolvedTable {
  value: Int32Array; // NOT_FORCED, ou nombre de coups de tour avant capture forcée
}

let cached: SolvedTable | undefined;

function buildGraph(): Map<number, PositionNode> {
  const graph = new Map<number, PositionNode>();

  for (let rookLo = 0; rookLo < SQUARES; rookLo++) {
    for (let rookHi = rookLo + 1; rookHi < SQUARES; rookHi++) {
      for (let king = 0; king < SQUARES; king++) {
        if (king === rookLo || king === rookHi) continue;

        for (const turn of ['rooks', 'king'] as const) {
          const turnBit = turn === 'rooks' ? 0 : 1;
          const key = encodeKey(rookLo, rookHi, king, turnBit);
          const state = positionState([rookLo, rookHi], king, turn);
          const mover = moverPlayerId(state);

          let hasImmediateWin = false;
          const children: number[] = [];

          for (const move of allLegalMoves(state)) {
            const next = applyMove(state, move);
            const result = getResult(next);
            if (result?.kind === 'win' && result.winner === mover) {
              hasImmediateWin = true;
              continue;
            }
            const positions = extractPositions(next.board);
            if (!positions) continue; // ne devrait pas arriver (pas de résultat => les trois pièces vivent encore)
            const [a, b] = positions.rooks;
            const childKey = encodeKey(Math.min(a, b), Math.max(a, b), positions.king, next.turn === 'rooks' ? 0 : 1);
            children.push(childKey);
          }

          graph.set(key, { hasImmediateWin, children });
        }
      }
    }
  }

  return graph;
}

// Induction arrière par balayages répétés jusqu'à point fixe. Les valeurs ne
// font que décroître d'un balayage à l'autre (tour : min sur les enfants
// résolus ; roi : max, mais seulement une fois TOUS ses enfants résolus —
// sinon le roi préfère l'échappatoire non résolue) donc la convergence est
// garantie ; MAX_SWEEPS est une marge large, pas une estimation ajustée.
const MAX_SWEEPS = 200;

function solve(): SolvedTable {
  const graph = buildGraph();
  const value = new Int32Array(SQUARES * SQUARES * SQUARES * 2).fill(NOT_FORCED);

  for (let sweep = 0; sweep < MAX_SWEEPS; sweep++) {
    let changed = false;

    for (const [key, node] of graph) {
      const turnBit = key % 2;
      let newValue: number;

      if (turnBit === 0) {
        // camp des tours : min sur les enfants déjà résolus
        if (node.hasImmediateWin) {
          newValue = 1;
        } else {
          let best = Infinity;
          for (const childKey of node.children) {
            const cv = value[childKey];
            if (cv === NOT_FORCED) continue;
            if (1 + cv < best) best = 1 + cv;
          }
          newValue = best === Infinity ? NOT_FORCED : best;
        }
      } else {
        // camp du roi : jamais forcé s'il peut prendre une tour tout de
        // suite ; sinon max sur ses enfants, seulement si TOUS sont résolus
        if (node.hasImmediateWin) {
          newValue = NOT_FORCED;
        } else if (node.children.length === 0) {
          newValue = NOT_FORCED; // aucun coup légal — ne devrait pas arriver (voir bot.test.ts)
        } else {
          let worst = -Infinity;
          let allResolved = true;
          for (const childKey of node.children) {
            const cv = value[childKey];
            if (cv === NOT_FORCED) {
              allResolved = false;
              break;
            }
            if (cv > worst) worst = cv;
          }
          newValue = allResolved ? worst : NOT_FORCED;
        }
      }

      if (newValue !== NOT_FORCED && newValue !== value[key]) {
        value[key] = newValue;
        changed = true;
      }
    }

    if (!changed) break;
  }

  return { value };
}

export function getSolvedTable(): SolvedTable {
  if (!cached) cached = solve();
  return cached;
}

// Précalcule la table avant qu'elle ne soit vraiment nécessaire (premier
// coup du roi niveau 4) — à appeler depuis un effet de montage de Board.tsx,
// jamais depuis logic.ts/bot.ts eux-mêmes (qui restent purs et ne décident
// jamais QUAND calculer). Voir critère d'acceptation 10 : mesuré hors iPad
// réel, voir NOTES.md.
export function warmSolvedTable(): void {
  getSolvedTable();
}

function valueAt(table: SolvedTable, state: KingHuntState): number {
  const positions = extractPositions(state.board);
  if (!positions) return NOT_FORCED;
  const [a, b] = positions.rooks;
  const key = encodeKey(Math.min(a, b), Math.max(a, b), positions.king, state.turn === 'rooks' ? 0 : 1);
  return table.value[key];
}

// Distance de capture forcée depuis `state`, ou NOT_FORCED si les tours ne
// peuvent pas forcer une capture (roi imparable, ou qui peut forcer la
// prise d'une tour) — exporté pour les tests de faisabilité/force (bot.test.ts).
export function forcedCaptureDistance(state: KingHuntState): number | null {
  const v = valueAt(getSolvedTable(), state);
  return v === NOT_FORCED ? null : v;
}

function choosePerfect(state: KingHuntState): KingHuntMove {
  const win = winningMoveIfAny(state);
  if (win) return win;

  const table = getSolvedTable();
  const moves = allLegalMoves(state);
  let bestMoves: KingHuntMove[] = [];

  if (state.turn === 'rooks') {
    // Les tours minimisent le nombre de coups avant capture forcée.
    let best = Infinity;
    for (const move of moves) {
      const v = valueAt(table, applyMove(state, move));
      const score = v === NOT_FORCED ? Infinity : v;
      if (score < best) {
        best = score;
        bestMoves = [move];
      } else if (score === best) {
        bestMoves.push(move);
      }
    }
  } else {
    // Le roi maximise (ou échappe complètement : NOT_FORCED bat toute
    // valeur finie).
    let best = -Infinity;
    for (const move of moves) {
      const v = valueAt(table, applyMove(state, move));
      const score = v === NOT_FORCED ? Infinity : v;
      if (score > best) {
        best = score;
        bestMoves = [move];
      } else if (score === best) {
        bestMoves.push(move);
      }
    }
  }

  return pickAmong(state, bestMoves.length > 0 ? bestMoves : moves);
}

// ---- point d'entrée du contrat GameModule.bot ----

export function chooseMove(state: KingHuntState, level: number): KingHuntMove {
  switch (level) {
    case 1:
      return chooseRandom(state);
    case 2:
      return winningMoveIfAny(state) ?? chooseGreedy(state);
    case 3:
      return winningMoveIfAny(state) ?? searchBestMove(state, DEPTH_LEVEL_3);
    case 4:
      return choosePerfect(state);
    default:
      return chooseRandom(state);
  }
}

// Réexporté pour bot.test.ts (déterminisme/force) sans dupliquer createState.
export { createState as createStateForTest };

// ---- la manche solo — seule couche exposée au contrat GameModule ----
//
// `logic.ts` modélise la finale à deux camps (utile au solveur et aux tests
// ci-dessus) ; ce qu'affronte réellement l'enfant est différent : elle joue
// toujours les tours, le roi répond tout seul au niveau choisi, et perdre
// (budget épuisé, ou une tour croquée) relance directement une nouvelle
// position à la même difficulté plutôt que d'afficher un écran de défaite —
// même esprit que piece-quiz (spec 06) : un échec fait recommencer, pas
// terminer, jusqu'à la vraie capture du roi (voir GameModule.progressSignal
// et NOTES.md). `logic.ts` reste inchangé : ce fichier compose ses fonctions
// pures avec chooseMove ci-dessus sans jamais que logic.ts importe bot.ts
// (le sens de dépendance reste à sens unique).

// Identifiant interne du roi — jamais un vrai joueur, jamais transmis au
// shell (pas de photo/nom à chercher pour lui : Board.tsx colore le roi via
// chess/skin.ts, pas via un Player). Distinct de shell/bot.ts (BOT_PLAYER_ID)
// : ce jeu n'a plus de mode « contre l'ordinateur » au sens du contrat
// (GameModule.bot), donc pas de faux Player à faire créer par le shell.
export const KING_ID: PlayerId = '__king__';

export interface KingHuntRoundState {
  position: KingHuntState;
  level: number;
  // Nombre de fois où le roi a déjà pris l'avantage (tour croquée ou budget
  // épuisé) et où une nouvelle position a été tirée — lu par
  // roundProgressSignal pour savoir QUAND signaler un échec transitoire.
  attempts: number;
  seed: number;
  // Dernier coup des tours et du roi dans la manche EN COURS (tous deux
  // appliqués par le même roundApplyMove, voir plus bas) — deux repères
  // distincts plutôt qu'un seul `lastMove` écrasé par le second, pour que
  // Board.tsx puisse montrer les deux à l'enfant, pas seulement la réponse
  // du roi. Remis à null à chaque nouvelle position (regenerate).
  lastRookMove: KingHuntMove | null;
  lastKingMove: KingHuntMove | null;
}

function freshPosition(human: PlayerId, seed: number, level: number): KingHuntState {
  return createState([human, KING_ID], seed, { level });
}

export function createRoundState(
  players: PlayerId[],
  seed: number,
  options?: { level?: number },
): KingHuntRoundState {
  const [human] = players as [PlayerId];
  const level = options?.level ?? 1;
  return {
    position: freshPosition(human, seed, level),
    level,
    attempts: 0,
    seed,
    lastRookMove: null,
    lastKingMove: null,
  };
}

export function roundIsValidMove(state: KingHuntRoundState, move: KingHuntMove): boolean {
  return isValidMove(state.position, move);
}

// Dérive une graine pour la position suivante à partir de la graine de
// manche et du nombre d'essais déjà consommés — déterministe (CLAUDE.md
// règle 3), jamais Math.random(), même patron que pickAmong ci-dessus.
function nextAttemptSeed(seed: number, attempts: number): number {
  return (seed ^ ((attempts + 1) * 0x9e3779b9)) >>> 0;
}

export function roundApplyMove(state: KingHuntRoundState, move: KingHuntMove): KingHuntRoundState {
  const human = state.position.players[0];
  let position = applyMove(state.position, move);
  let result = getResult(position);

  if (result) {
    if (result.kind === 'win' && result.winner === human) {
      // Vraie capture du roi : la manche s'arrête ici pour de bon.
      return { ...state, position, lastRookMove: move, lastKingMove: null };
    }
    // Budget épuisé par ce coup-ci, sans capture : le roi « gagne » —
    // relance une position fraîche au lieu d'exposer cette fin de partie.
    return regenerate(state);
  }

  const kingMove = chooseMove(position, state.level);
  position = applyMove(position, kingMove);
  result = getResult(position);

  if (result) {
    // Seule issue possible ici (voir chooseMove/getResult) : le roi vient de
    // croquer une tour non protégée. Même traitement : on relance.
    return regenerate(state);
  }

  return { ...state, position, lastRookMove: move, lastKingMove: kingMove };
}

function regenerate(state: KingHuntRoundState): KingHuntRoundState {
  const attempts = state.attempts + 1;
  const human = state.position.players[0];
  const seed = nextAttemptSeed(state.seed, state.attempts);
  return {
    position: freshPosition(human, seed, state.level),
    level: state.level,
    attempts,
    seed: state.seed,
    lastRookMove: null,
    lastKingMove: null,
  };
}

export function roundGetResult(state: KingHuntRoundState): Result | null {
  return getResult(state.position);
}

export function roundCurrentPlayer(state: KingHuntRoundState): PlayerId | null {
  return roundGetResult(state) ? null : state.position.players[0];
}

// Spec 07 (retour utilisateur) : un échec ne termine pas la partie, il la
// relance — le shell le voit comme un signal transitoire (son, tremblement,
// contour rouge, déjà câblés depuis spec 06/GameScreen.tsx, rien à y
// modifier) plutôt que comme une fin de partie. Détecté en comparant
// `attempts` avant/après, pas en inspectant le contenu du coup joué.
export function roundProgressSignal(prev: KingHuntRoundState, next: KingHuntRoundState): ProgressSignal | null {
  if (next.attempts > prev.attempts) return { player: next.position.players[0], fail: true };
  return null;
}
