import { bfsDistances, legalSlots, OPPOSITE_SLOT, previewShift, reachableFrom, SIZE } from './logic';
import type { MazeMove, MazeState, Rotation } from './logic';

// Adversaire artificiel à quatre niveaux (spec 08).
//
// Pur et déterministe (CLAUDE.md règle 3, ARCHITECTURE.md invariant 6) :
// chooseMove ne lit ni l'horloge ni Math.random(), tout le hasard vient de
// state.seed et state.shiftsUsed. Une seule passe d'évaluation par appel :
// ~44-48 coups candidats (une fente légale × une rotation), chacun noté par
// une estimation de « distance restante » — jamais de recherche à
// profondeur N (44^N explose bien avant N=3), conformément à la spec.
//
// L'échelle de niveaux proposée dans la spec (« à N coups de son but ») a dû
// être abandonnée après le test de force : voir le commentaire au-dessus de
// `chooseMove` et NOTES.md pour ce qui a été mesuré et pourquoi.

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickAmong<T>(state: MazeState, items: T[]): T {
  if (items.length === 1) return items[0];
  const random = mulberry32((state.seed ^ (state.shiftsUsed * 0x9e3779b9)) >>> 0);
  return items[Math.floor(random() * items.length)];
}

function manhattan(a: number, b: number): number {
  const ar = Math.floor(a / SIZE);
  const ac = a % SIZE;
  const br = Math.floor(b / SIZE);
  const bc = b % SIZE;
  return Math.abs(ar - br) + Math.abs(ac - bc);
}

interface Candidate {
  slot: number;
  rotation: Rotation;
  board: ReturnType<typeof previewShift>['board'];
  handTile: ReturnType<typeof previewShift>['handTile'];
  pawns: number[];
  bestDestination: number;
  // Score de proximité à la cible : 0 = victoire immédiate, plus petit =
  // meilleur. Jamais Infinity — voir `evaluateCandidates`.
  score: number;
}

function targetIdFor(state: MazeState, playerIndex: number): number | null {
  if (!state.progress) return null;
  const queue = state.progress.kind === 'perPlayer' ? state.progress.queues[playerIndex] : state.progress.queue;
  return queue.length > 0 ? queue[0] : null;
}

// Note de conception (voir NOTES.md pour le détail des mesures) :
//
// La distance de couloir « pure » (BFS depuis la case atteignable la plus
// proche jusqu'à la cible) s'est révélée presque toujours infinie : un seul
// décalage ne relie quasiment jamais la cible à la zone du pion. Utilisée
// seule, cette distance ne discrimine donc rien.
//
// `weak` (œuf) retombe sur la distance à vol d'oiseau (Manhattan) quand la
// cible n'est pas connectée — un signal toujours fini, mais qui pousse un
// glouton vers des impasses (mesuré : ~30 % de parties solo non terminées en
// 300 tours, un vrai blocage, pas une hypothèse).
//
// `strong` (poussin et niveaux au-dessus) retombe à la place sur la taille
// de la zone atteignable cette fois-ci (plus grande = meilleure) : garder de
// la mobilité plutôt que viser une case précise évite ces impasses — mesuré
// à 100 % de parties solo terminées, largement sous le PAR, sans ce
// blocage.
function evaluateCandidates(state: MazeState, playerIndex: number, weak: boolean): Candidate[] {
  const targetId = targetIdFor(state, playerIndex);
  const homeCell = state.homeCells[playerIndex];
  const candidates: Candidate[] = [];

  for (const slot of legalSlots(state.forbiddenSlot)) {
    for (let rotation = 0; rotation < 4; rotation++) {
      const { board, handTile, pawns } = previewShift(state, slot, rotation as Rotation);
      const moverCell = pawns[playerIndex];
      const targetCell = targetId === null ? homeCell : board.findIndex((tile) => tile.treasure === targetId);
      const reachable = reachableFrom(board, moverCell);
      const regionSize = reachable.reduce((n, r) => n + (r ? 1 : 0), 0);
      const distances = targetCell === -1 ? null : bfsDistances(board, targetCell);

      let bestScore = Infinity;
      let bestDestination = moverCell;
      for (let cell = 0; cell < reachable.length; cell++) {
        if (!reachable[cell]) continue;
        const graphDistance = distances ? distances[cell] : Infinity;
        const score =
          graphDistance !== Infinity
            ? graphDistance
            : weak
              ? targetCell === -1
                ? 2000
                : 1000 + manhattan(cell, targetCell)
              : 10000 - regionSize;
        if (score < bestScore) {
          bestScore = score;
          bestDestination = cell;
        }
      }

      candidates.push({ slot, rotation: rotation as Rotation, board, handTile, pawns, bestDestination, score: bestScore });
    }
  }
  return candidates;
}

function toMove(candidate: Candidate): MazeMove {
  return { type: 'turn', slot: candidate.slot, rotation: candidate.rotation, destination: candidate.bestDestination };
}

// Un plateau hypothétique (après le coup candidat, avant le tour suivant) —
// pour évaluer sa propre position au tour d'après (poule, coq) ou la
// réponse d'un adversaire (coq). Seuls les champs lus par
// evaluateCandidates/legalSlots sont renseignés.
function hypotheticalState(state: MazeState, candidate: Candidate, playerIndex: number): MazeState {
  const pawns = candidate.pawns.slice();
  pawns[playerIndex] = candidate.bestDestination;
  return {
    ...state,
    board: candidate.board,
    handTile: candidate.handTile,
    pawns,
    forbiddenSlot: OPPOSITE_SLOT[candidate.slot],
  };
}

function canWinImmediately(candidates: Candidate[]): boolean {
  return candidates.some((c) => c.score === 0);
}

// Départage par tirage seedé (pickAmong) plutôt qu'un simple premier trouvé,
// même pour les niveaux les plus forts : plusieurs fentes produisent souvent
// des plateaux indiscernables (mêmes tuiles, même rotation), au point qu'un
// tie-break toujours identique peut rejouer la même fente indéfiniment sans
// jamais progresser — boucle réelle observée en jeu solo avant ce correctif,
// pas une précaution théorique (voir NOTES.md). `poolSize` retient les
// meilleurs candidats plutôt qu'un seul : un bassin trop étroit (y compris
// « toujours le meilleur ») s'est mesuré moins bon qu'un bassin large, y
// compris pour les niveaux forts — voir NOTES.md, c'est la correction la
// plus contre-intuitive de cette spec.
function pickFromPool(state: MazeState, ranked: { candidate: Candidate; combined: number }[], poolSize: number): Candidate {
  const sorted = [...ranked].sort((a, b) => a.combined - b.combined);
  return pickAmong(state, sorted.slice(0, Math.min(poolSize, sorted.length)).map((r) => r.candidate));
}

const POOL_SIZE = 24;
// Poids du bonus « meilleur coup accessible au tour suivant » (poule, coq) —
// additif, jamais un filtre qui exclurait le meilleur coup immédiat.
const LOOKAHEAD_WEIGHT = 0.5;

export function chooseMove(state: MazeState, level: number): MazeMove {
  const playerIndex = state.turnIndex;
  const weak = level === 1;
  const candidates = evaluateCandidates(state, playerIndex, weak);

  // Tous les niveaux prennent un trésor (ou rentrent) offert par un coup
  // immédiat — la différence entre niveaux ne joue que quand ce n'est pas
  // possible (spec : « prend son trésor si un coup le lui donne », identique
  // aux quatre niveaux).
  const winning = candidates.filter((c) => c.score === 0);
  if (winning.length > 0) return toMove(pickAmong(state, winning));

  // Niveaux 1 et 2 — l'œuf et le poussin : un coup au hasard parmi les
  // meilleurs de leur bassin, sans anticipation. Le niveau 1 vise plus
  // grossièrement (retombe sur la distance à vol d'oiseau, cf.
  // evaluateCandidates) là où le niveau 2 vise mieux (retombe sur la
  // mobilité) — même largeur de bassin, la différence est la qualité de la
  // visée, pas le hasard.
  if (level === 1 || level === 2) {
    return toMove(pickFromPool(state, candidates.map((c) => ({ candidate: c, combined: c.score })), POOL_SIZE));
  }

  // Niveaux 3 et 4 — la poule et le coq : en plus de viser juste, un bonus
  // additif préfère les coups qui laissent une bonne case accessible dès le
  // tour suivant (jamais un filtre exclusif — voir NOTES.md, un filtre à 2
  // coups de vue s'est révélé pire qu'un simple glouton).
  const withLookahead = candidates.map((c) => {
    const next = hypotheticalState(state, c, playerIndex);
    const future = evaluateCandidates(next, playerIndex, false);
    const bestFuture = future.reduce((m, f) => Math.min(m, f.score), Infinity);
    return { candidate: c, combined: c.score + LOOKAHEAD_WEIGHT * Math.min(bestFuture, 20) };
  });

  if (level === 3) {
    return toMove(pickFromPool(state, withLookahead, POOL_SIZE));
  }

  // Niveau 4 — le coq : la même visée que la poule, mais écarte d'abord les
  // coups qui laisseraient un adversaire gagner dès son prochain tour, s'il
  // existe une alternative qui l'en empêche — la seule différence mesurée
  // comme franchement décisive (test de force en mode partage, voir
  // bot.test.ts et NOTES.md).
  const opponents = state.players.map((_, i) => i).filter((i) => i !== playerIndex);
  const safe = withLookahead.filter(({ candidate }) => {
    const next = hypotheticalState(state, candidate, playerIndex);
    return opponents.every((opponentIndex) => !canWinImmediately(evaluateCandidates(next, opponentIndex, false)));
  });

  return toMove(pickFromPool(state, safe.length > 0 ? safe : withLookahead, POOL_SIZE));
}
