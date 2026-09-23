import type { PlayerId, Result } from '../types';

// ---- géométrie du plateau --------------------------------------------------

export const SIZE = 7;
export const TREASURE_COUNT = 24;

// Lignes/colonnes fixes (0-indexé) : 0, 2, 4, 6 — les 16 intersections.
// Lignes/colonnes mobiles : 1, 3, 5 — les fentes d'insertion s'y ouvrent.
export const MOVABLE_LINES = [1, 3, 5] as const;

export type Shape = 0 | 1 | 2;
export const STRAIGHT: Shape = 0;
export const CORNER: Shape = 1;
export const TEE: Shape = 2;

export type Rotation = 0 | 1 | 2 | 3;

export interface Tile {
  // Identité stable de la tuile physique, inchangée quand elle se déplace
  // (décalage) ou tourne — sert uniquement à Board.tsx pour animer un
  // glissement (React ne peut réconcilier deux rendus en un déplacement visuel
  // fluide que si la même tuile porte la même clé avant/après). Aucune règle
  // de jeu n'en dépend : deux tuiles au même id ne se produit jamais, mais
  // rien dans logic.ts ne le vérifie ni ne s'en sert.
  id: number;
  shape: Shape;
  rotation: Rotation;
  // -1 : pas de trésor sur cette tuile.
  treasure: number;
}

// Directions en bits, pour un masque d'ouvertures par tuile — c1, c2, c3, c4
// d'une tuile ouverte au nord/est/sud/ouest ont chacun leur bit.
const N = 1;
const E = 2;
const S = 4;
const W = 8;
const DIRS = [N, E, S, W];
const OPPOSITE: Record<number, number> = { [N]: S, [S]: N, [E]: W, [W]: E };
const DELTA: Record<number, { dr: number; dc: number }> = {
  [N]: { dr: -1, dc: 0 },
  [E]: { dr: 0, dc: 1 },
  [S]: { dr: 1, dc: 0 },
  [W]: { dr: 0, dc: -1 },
};

// Rotation de 90° (sens horaire) d'un masque d'ouvertures : N→E→S→W→N — same
// convention que les trois SVG fournis (idée/tuile/), vérifiée sur leur tracé
// de couloir (voir NOTES.md).
function rotateMask(mask: number, steps: number): number {
  let m = mask;
  const count = ((steps % 4) + 4) % 4;
  for (let i = 0; i < count; i++) {
    let next = 0;
    if (m & N) next |= E;
    if (m & E) next |= S;
    if (m & S) next |= W;
    if (m & W) next |= N;
    m = next;
  }
  return m;
}

// Masques de base (rotation 0), un par forme : droite (N/S), angle (N/E),
// T (E/S/W, mur au nord) — table précalculée une seule fois au chargement du
// module, jamais recalculée en boucle chaude (BFS du bot).
const BASE_MASK = [N | S, N | E, E | S | W];
export const OPENINGS: number[][] = BASE_MASK.map((base) => [0, 1, 2, 3].map((r) => rotateMask(base, r)));

function neighborCell(cell: number, dir: number): number {
  const row = Math.floor(cell / SIZE);
  const col = cell % SIZE;
  const d = DELTA[dir];
  const nr = row + d.dr;
  const nc = col + d.dc;
  if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) return -1;
  return nr * SIZE + nc;
}

// Distances (en cases) depuis `start` vers toutes les cases de `board` —
// Infinity pour une case hors d'atteinte. `reachableFrom` en dérive ;
// bot.ts s'en sert directement pour évaluer à quel point un coup candidat
// rapproche d'une cible.
export function bfsDistances(board: Tile[], start: number): number[] {
  const dist = new Array<number>(SIZE * SIZE).fill(Infinity);
  dist[start] = 0;
  const queue = [start];
  let qi = 0;
  while (qi < queue.length) {
    const cell = queue[qi++];
    const mask = OPENINGS[board[cell].shape][board[cell].rotation];
    for (const dir of DIRS) {
      if (!(mask & dir)) continue;
      const neighbor = neighborCell(cell, dir);
      if (neighbor < 0 || dist[neighbor] !== Infinity) continue;
      const neighborMask = OPENINGS[board[neighbor].shape][board[neighbor].rotation];
      if (neighborMask & OPPOSITE[dir]) {
        dist[neighbor] = dist[cell] + 1;
        queue.push(neighbor);
      }
    }
  }
  return dist;
}

// Cases accessibles depuis `start` sur `board` tel quel — deux tuiles
// voisines communiquent seulement si leurs deux ouvertures se font face
// (CLAUDE.md, règle 2 : pure, pas de DOM).
export function reachableFrom(board: Tile[], start: number): boolean[] {
  const dist = bfsDistances(board, start);
  return dist.map((d) => d !== Infinity);
}

// Un plus court chemin (en cases) de `start` à `target`, `start` inclus —
// null si `target` n'est pas atteignable. Ne sert à aucune règle de jeu :
// c'est Board.tsx qui s'en sert pour animer le pion case par case le long du
// chemin, jamais logic.ts ni bot.ts (qui n'ont besoin que de la distance ou
// de l'accessibilité, voir bfsDistances/reachableFrom ci-dessus).
export function shortestPath(board: Tile[], start: number, target: number): number[] | null {
  if (start === target) return [start];
  const prev = new Array<number>(SIZE * SIZE).fill(-1);
  const visited = new Array<boolean>(SIZE * SIZE).fill(false);
  visited[start] = true;
  const queue = [start];
  let qi = 0;
  while (qi < queue.length) {
    const cell = queue[qi++];
    if (cell === target) break;
    const mask = OPENINGS[board[cell].shape][board[cell].rotation];
    for (const dir of DIRS) {
      if (!(mask & dir)) continue;
      const neighbor = neighborCell(cell, dir);
      if (neighbor < 0 || visited[neighbor]) continue;
      const neighborMask = OPENINGS[board[neighbor].shape][board[neighbor].rotation];
      if (neighborMask & OPPOSITE[dir]) {
        visited[neighbor] = true;
        prev[neighbor] = cell;
        queue.push(neighbor);
      }
    }
  }
  if (!visited[target]) return null;
  const path = [target];
  let cur = target;
  while (cur !== start) {
    cur = prev[cur];
    path.push(cur);
  }
  path.reverse();
  return path;
}

// ---- tuiles fixes -----------------------------------------------------------

// Les 4 maisons : angles ouverts vers l'intérieur (rotation d'un angle de
// base N/E). Ordre = ordre des sièges, pense à quatre dès maintenant (spec
// 08 n'en remplit que deux) : sens horaire depuis le coin haut-gauche.
const CORNERS: { cell: number; rotation: Rotation }[] = [
  { cell: 0, rotation: 1 }, // (0,0) haut-gauche : ouvre sud+est
  { cell: 6, rotation: 2 }, // (0,6) haut-droite : ouvre sud+ouest
  { cell: 48, rotation: 3 }, // (6,6) bas-droite : ouvre nord+ouest
  { cell: 42, rotation: 0 }, // (6,0) bas-gauche : ouvre nord+est
];

export const HOME_CELLS_BY_SEAT: number[] = CORNERS.map((c) => c.cell);

// Les 12 T fixes, mur tourné vers le bord le plus proche (les 4 tuiles
// intérieures n'ayant pas de bord unique, départage par la ligne — choix de
// modélisation, purement cosmétique, voir rapport de fin de spec).
const FIXED_TEES: { cell: number; rotation: Rotation }[] = [
  { cell: 2, rotation: 0 },
  { cell: 4, rotation: 0 },
  { cell: 44, rotation: 2 },
  { cell: 46, rotation: 2 },
  { cell: 14, rotation: 3 },
  { cell: 28, rotation: 3 },
  { cell: 20, rotation: 1 },
  { cell: 34, rotation: 1 },
  { cell: 16, rotation: 0 },
  { cell: 18, rotation: 0 },
  { cell: 30, rotation: 2 },
  { cell: 32, rotation: 2 },
];

const FIXED_CELL_SET = new Set<number>([...CORNERS.map((c) => c.cell), ...FIXED_TEES.map((t) => t.cell)]);
export const MOVABLE_CELLS: number[] = Array.from({ length: SIZE * SIZE }, (_, i) => i).filter(
  (c) => !FIXED_CELL_SET.has(c),
);

// ---- PRNG seedé -------------------------------------------------------------

// mulberry32 : même générateur que les autres jeux (CLAUDE.md, règle 3).
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace<T>(arr: T[], random: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
}

// Génération du plateau : déterministe à partir du seed (CLAUDE.md, règle 3)
// — 16 fixes (12 T + 4 maisons, sans trésor pour les maisons), 33 mobiles sur
// le plateau + 1 en main, 12 trésors sur les T fixes, 12 sur des tuiles
// mobiles (6 angles, 6 T — les 6 T mobiles portent donc TOUJOURS un trésor).
function generateBoard(seed: number): { board: Tile[]; handTile: Tile } {
  const random = mulberry32(seed);

  const treasureIds = Array.from({ length: TREASURE_COUNT }, (_, i) => i);
  shuffleInPlace(treasureIds, random);
  const fixedTreasureIds = treasureIds.slice(0, 12);
  const movableTreasureIds = treasureIds.slice(12, 24);

  // Un id unique par tuile physique (voir Tile.id) — simple compteur, l'ordre
  // n'a aucune signification.
  let nextId = 0;

  const board = new Array<Tile>(SIZE * SIZE);
  CORNERS.forEach((c) => {
    board[c.cell] = { id: nextId++, shape: CORNER, rotation: c.rotation, treasure: -1 };
  });
  FIXED_TEES.forEach((t, i) => {
    board[t.cell] = { id: nextId++, shape: TEE, rotation: t.rotation, treasure: fixedTreasureIds[i] };
  });

  const pool: Tile[] = [];
  for (let i = 0; i < 12; i++) {
    pool.push({ id: nextId++, shape: STRAIGHT, rotation: Math.floor(random() * 4) as Rotation, treasure: -1 });
  }
  for (let i = 0; i < 16; i++) {
    pool.push({
      id: nextId++,
      shape: CORNER,
      rotation: Math.floor(random() * 4) as Rotation,
      treasure: i < 6 ? movableTreasureIds[i] : -1,
    });
  }
  for (let i = 0; i < 6; i++) {
    pool.push({
      id: nextId++,
      shape: TEE,
      rotation: Math.floor(random() * 4) as Rotation,
      treasure: movableTreasureIds[6 + i],
    });
  }
  shuffleInPlace(pool, random);

  MOVABLE_CELLS.forEach((cell, i) => {
    board[cell] = pool[i];
  });
  const handTile = pool[MOVABLE_CELLS.length];

  return { board, handTile };
}

// Ordre des trésors « en jeu » cette partie — flux de hasard séparé de celui
// du plateau (salt différent), pour ne dépendre d'aucun détail d'ordre de
// tirage de generateBoard.
function shuffledTreasureIds(seed: number): number[] {
  const random = mulberry32((seed ^ 0x2545f491) >>> 0);
  const ids = Array.from({ length: TREASURE_COUNT }, (_, i) => i);
  shuffleInPlace(ids, random);
  return ids;
}

// ---- fentes d'insertion -----------------------------------------------------

type Axis = 'row' | 'col';
interface SlotDef {
  axis: Axis;
  line: number; // index de ligne/colonne (1, 3 ou 5)
  dir: 1 | -1; // sens du décalage : +1 = vers l'est/le sud
}

// 12 fentes : 0-2 insertion côté ouest (décalage vers l'est), 3-5 côté est
// (vers l'ouest), 6-8 côté nord (vers le sud), 9-11 côté sud (vers le nord).
export const SLOTS: SlotDef[] = [
  ...MOVABLE_LINES.map((line): SlotDef => ({ axis: 'row', line, dir: 1 })),
  ...MOVABLE_LINES.map((line): SlotDef => ({ axis: 'row', line, dir: -1 })),
  ...MOVABLE_LINES.map((line): SlotDef => ({ axis: 'col', line, dir: 1 })),
  ...MOVABLE_LINES.map((line): SlotDef => ({ axis: 'col', line, dir: -1 })),
];
export const SLOT_COUNT = SLOTS.length; // 12

// Fente opposée : même ligne/colonne, sens inverse — c'est elle qui annule
// le décalage qu'on vient de faire (retour immédiat interdit).
export const OPPOSITE_SLOT: number[] = [3, 4, 5, 0, 1, 2, 9, 10, 11, 6, 7, 8];

export function legalSlots(forbiddenSlot: number | null): number[] {
  const all = Array.from({ length: SLOT_COUNT }, (_, i) => i);
  return forbiddenSlot === null ? all : all.filter((s) => s !== forbiddenSlot);
}

// ---- état du jeu -------------------------------------------------------------

export type MazeMode = 'course' | 'partage' | 'solo';
export type MazePhase = 'setup' | 'dealing' | 'playing' | 'gameover';

// Progression des trésors visés : `shared` pour la course et le solo (une
// seule file, tout le monde vise la même case en tête) ; `perPlayer` pour le
// partage (une file par joueur).
export type MazeProgress = { kind: 'shared'; queue: number[] } | { kind: 'perPlayer'; queues: number[][] };

export interface MazeState {
  seed: number;
  players: PlayerId[]; // sièges ordonnés — index 0 = l'humain quand un bot est présent
  phase: MazePhase;
  mode: MazeMode | null;
  board: Tile[]; // 49 cases
  handTile: Tile;
  forbiddenSlot: number | null;
  pawns: number[]; // pawns[i] = case du joueur players[i]
  homeCells: number[]; // homeCells[i] = case-maison du joueur players[i]
  progress: MazeProgress | null; // null tant que le mode n'est pas choisi
  activeTreasureIds: number[]; // trésors distribués cette partie (jamais réduit)
  collectedTreasureIds: number[]; // trésors déjà ramassés, toutes files confondues
  // Trésors personnellement ramassés par chaque joueur dans une file
  // PARTAGÉE (course, solo) — sert de score en mode course (voir applyMove) ;
  // sans objet en partage, où la file de chacun suffit déjà.
  sharedTreasuresWon: number[];
  shiftsUsed: number; // décalages joués cette partie (score du mode solo)
  turnIndex: number; // index dans `players` du joueur au trait
  lastTurn: { slot: number; rotation: Rotation; destination: number; playerId: PlayerId } | null;
  result: Result | null;
}

export const SOLO_PAR = 40;

export function createState(players: PlayerId[], seed: number): MazeState {
  const { board, handTile } = generateBoard(seed);
  const homeCells = players.map((_, i) => HOME_CELLS_BY_SEAT[i]);
  return {
    seed,
    players,
    phase: 'setup',
    mode: null,
    board,
    handTile,
    forbiddenSlot: null,
    pawns: homeCells.slice(),
    homeCells,
    progress: null,
    activeTreasureIds: [],
    collectedTreasureIds: [],
    sharedTreasuresWon: players.map(() => 0),
    shiftsUsed: 0,
    turnIndex: 0,
    lastTurn: null,
    result: null,
  };
}

export type MazeMove =
  | { type: 'chooseMode'; mode: MazeMode }
  | { type: 'dealingDone' }
  | { type: 'turn'; slot: number; rotation: Rotation; destination: number };

// Aperçu pur du décalage seul (sans trésor ni changement de trait) : Board
// s'en sert pour prévisualiser la fente choisie et calculer les cases
// accessibles avant que le coup ne soit émis (invariant : Board n'appelle
// jamais applyMove) ; le bot et les tests s'en servent pour évaluer des
// coups candidats sans muter l'état réel.
export function previewShift(
  state: Pick<MazeState, 'board' | 'handTile' | 'pawns'>,
  slot: number,
  rotation: Rotation,
): { board: Tile[]; handTile: Tile; pawns: number[] } {
  const { axis, line, dir } = SLOTS[slot];
  const insertedTile: Tile = { ...state.handTile, rotation };
  const board = state.board.slice();
  const pawns = state.pawns.slice();
  let ejected: Tile;

  if (axis === 'row') {
    const r = line;
    const old = Array.from({ length: SIZE }, (_, c) => board[r * SIZE + c]);
    const next = new Array<Tile>(SIZE);
    if (dir === 1) {
      next[0] = insertedTile;
      for (let c = 1; c < SIZE; c++) next[c] = old[c - 1];
      ejected = old[SIZE - 1];
    } else {
      next[SIZE - 1] = insertedTile;
      for (let c = 0; c < SIZE - 1; c++) next[c] = old[c + 1];
      ejected = old[0];
    }
    for (let c = 0; c < SIZE; c++) board[r * SIZE + c] = next[c];
    for (let i = 0; i < pawns.length; i++) {
      const row = Math.floor(pawns[i] / SIZE);
      const col = pawns[i] % SIZE;
      if (row === r) {
        const newCol = ((col + dir) % SIZE + SIZE) % SIZE;
        pawns[i] = row * SIZE + newCol;
      }
    }
  } else {
    const c = line;
    const old = Array.from({ length: SIZE }, (_, r) => board[r * SIZE + c]);
    const next = new Array<Tile>(SIZE);
    if (dir === 1) {
      next[0] = insertedTile;
      for (let r = 1; r < SIZE; r++) next[r] = old[r - 1];
      ejected = old[SIZE - 1];
    } else {
      next[SIZE - 1] = insertedTile;
      for (let r = 0; r < SIZE - 1; r++) next[r] = old[r + 1];
      ejected = old[0];
    }
    for (let r = 0; r < SIZE; r++) board[r * SIZE + c] = next[r];
    for (let i = 0; i < pawns.length; i++) {
      const row = Math.floor(pawns[i] / SIZE);
      const col = pawns[i] % SIZE;
      if (col === c) {
        const newRow = ((row + dir) % SIZE + SIZE) % SIZE;
        pawns[i] = newRow * SIZE + col;
      }
    }
  }

  return { board, handTile: ejected, pawns };
}

export function isValidMove(state: MazeState, move: MazeMove): boolean {
  switch (move.type) {
    case 'chooseMode':
      if (state.phase !== 'setup') return false;
      if (move.mode === 'solo') return state.players.length === 1;
      return state.players.length === 2 && (move.mode === 'course' || move.mode === 'partage');
    case 'dealingDone':
      return state.phase === 'dealing';
    case 'turn': {
      if (state.phase !== 'playing') return false;
      if (move.slot < 0 || move.slot >= SLOT_COUNT) return false;
      if (move.slot === state.forbiddenSlot) return false;
      if (move.rotation < 0 || move.rotation > 3) return false;
      const { board, pawns } = previewShift(state, move.slot, move.rotation);
      const reachable = reachableFrom(board, pawns[state.turnIndex]);
      return reachable[move.destination] === true;
    }
  }
}

export function applyMove(state: MazeState, move: MazeMove): MazeState {
  switch (move.type) {
    case 'chooseMode': {
      const ids = shuffledTreasureIds(state.seed);
      if (move.mode === 'course') {
        const queue = ids.slice(0, 3);
        return {
          ...state,
          mode: 'course',
          phase: 'playing',
          progress: { kind: 'shared', queue },
          activeTreasureIds: queue.slice(),
        };
      }
      if (move.mode === 'solo') {
        const queue = ids.slice(0, 6);
        return {
          ...state,
          mode: 'solo',
          phase: 'playing',
          progress: { kind: 'shared', queue },
          activeTreasureIds: queue.slice(),
        };
      }
      const seatCount = state.players.length;
      const queues: number[][] = [];
      for (let p = 0; p < seatCount; p++) queues.push(ids.slice(p * 3, p * 3 + 3));
      return {
        ...state,
        mode: 'partage',
        phase: 'dealing',
        progress: { kind: 'perPlayer', queues },
        activeTreasureIds: queues.flat(),
      };
    }

    case 'dealingDone':
      return { ...state, phase: 'playing' };

    case 'turn': {
      const moverIndex = state.turnIndex;
      const mover = state.players[moverIndex];
      const { board, handTile, pawns } = previewShift(state, move.slot, move.rotation);
      pawns[moverIndex] = move.destination;

      let progress = state.progress!;
      let collectedTreasureIds = state.collectedTreasureIds;
      let sharedTreasuresWon = state.sharedTreasuresWon;
      const treasureHere = board[move.destination].treasure;

      if (treasureHere !== -1) {
        if (progress.kind === 'perPlayer') {
          const myQueue = progress.queues[moverIndex];
          if (myQueue[0] === treasureHere) {
            const queues = progress.queues.map((q, i) => (i === moverIndex ? q.slice(1) : q));
            progress = { kind: 'perPlayer', queues };
            collectedTreasureIds = [...collectedTreasureIds, treasureHere];
          }
        } else if (progress.queue[0] === treasureHere) {
          progress = { kind: 'shared', queue: progress.queue.slice(1) };
          collectedTreasureIds = [...collectedTreasureIds, treasureHere];
          sharedTreasuresWon = sharedTreasuresWon.map((n, i) => (i === moverIndex ? n + 1 : n));
        }
      }

      const shiftsUsed = state.shiftsUsed + 1;
      let won = false;
      let result: Result | null = null;

      if (state.mode === 'course') {
        // Retour utilisateur (spec 08, revu) : plus de course au retour à la
        // maison en mode course — la partie s'arrête dès que les 3 trésors
        // sont distribués, et c'est celui qui en a ramassé le plus qui
        // gagne, pas forcément celui qui vient de prendre le dernier.
        if (progress.kind === 'shared' && progress.queue.length === 0) {
          won = true;
          const maxWon = Math.max(...sharedTreasuresWon);
          const leaders = state.players.filter((_, i) => sharedTreasuresWon[i] === maxWon);
          result = leaders.length === 1 ? { kind: 'win', winner: leaders[0] } : { kind: 'draw' };
        }
      } else {
        const questDone =
          progress.kind === 'perPlayer' ? progress.queues[moverIndex].length === 0 : progress.queue.length === 0;
        const atHome = move.destination === state.homeCells[moverIndex];
        won = questDone && atHome;
        if (won) {
          result =
            state.mode === 'solo'
              ? { kind: 'win', winner: mover, score: { value: Math.max(0, SOLO_PAR - shiftsUsed), variant: 'solo-6' } }
              : { kind: 'win', winner: mover };
        }
      }

      return {
        ...state,
        board,
        handTile,
        pawns,
        forbiddenSlot: OPPOSITE_SLOT[move.slot],
        progress,
        collectedTreasureIds,
        sharedTreasuresWon,
        shiftsUsed,
        turnIndex: won ? state.turnIndex : (state.turnIndex + 1) % state.players.length,
        phase: won ? 'gameover' : state.phase,
        result,
        lastTurn: { slot: move.slot, rotation: move.rotation, destination: move.destination, playerId: mover },
      };
    }
  }
}

export function currentPlayer(state: MazeState): PlayerId | null {
  if (state.phase === 'gameover') return null;
  // Choix du mode et animation de distribution : toujours l'humain qui tient
  // l'appareil (players[0], voir GameScreen/PlayerPickScreen — un bot n'est
  // jamais index 0), jamais le bot.
  if (state.phase === 'setup' || state.phase === 'dealing') return state.players[0];
  return state.players[state.turnIndex];
}

export function getResult(state: MazeState): Result | null {
  return state.result;
}
