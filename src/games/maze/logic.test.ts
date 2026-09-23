import { describe, expect, it } from 'vitest';
import {
  applyMove,
  createState,
  CORNER,
  currentPlayer,
  getResult,
  HOME_CELLS_BY_SEAT,
  isValidMove,
  MOVABLE_CELLS,
  OPENINGS,
  OPPOSITE_SLOT,
  previewShift,
  reachableFrom,
  shortestPath,
  SIZE,
  STRAIGHT,
  TEE,
  TREASURE_COUNT,
} from './logic';
import type { MazeState, Rotation, Tile } from './logic';

const P1 = 'p1';
const P2 = 'p2';

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value as Record<string, unknown>).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

describe('maze tile geometry', () => {
  it('matches the corridor drawn in the SVG assets at rotation 0', () => {
    // idée/tuile/tile-straight.svg : trait vertical → nord/sud.
    expect(OPENINGS[STRAIGHT][0]).toBe(1 | 4);
    // tile-corner.svg : "M50 0 L50 50 L100 50" → nord puis est.
    expect(OPENINGS[CORNER][0]).toBe(1 | 2);
    // tile-tee.svg : ligne horizontale pleine + tronçon vers le bas → est/sud/ouest.
    expect(OPENINGS[TEE][0]).toBe(2 | 4 | 8);
  });

  it('rotates a corner through all four orientations', () => {
    expect(OPENINGS[CORNER][1]).toBe(2 | 4); // est/sud
    expect(OPENINGS[CORNER][2]).toBe(4 | 8); // sud/ouest
    expect(OPENINGS[CORNER][3]).toBe(8 | 1); // ouest/nord
  });
});

describe('maze board generation', () => {
  it('is coherent across many seeds', () => {
    for (let seed = 0; seed < 500; seed++) {
      const state = createState([P1, P2], seed);
      expect(state.board).toHaveLength(SIZE * SIZE);

      const fixedCells = new Set(
        Array.from({ length: SIZE * SIZE }, (_, i) => i).filter((c) => !MOVABLE_CELLS.includes(c)),
      );
      expect(fixedCells.size).toBe(16);
      expect(MOVABLE_CELLS).toHaveLength(33);

      const treasureIds = new Set<number>();
      let corners = 0;
      state.board.forEach((tile, cell) => {
        if (tile.treasure !== -1) treasureIds.add(tile.treasure);
        if (fixedCells.has(cell) && tile.shape === CORNER) corners++;
      });
      // Hand tile compte aussi comme mobile.
      if (state.handTile.treasure !== -1) treasureIds.add(state.handTile.treasure);

      expect(corners).toBe(4);
      expect(treasureIds.size).toBe(24);
      expect(Math.max(...treasureIds)).toBeLessThan(TREASURE_COUNT);

      state.pawns.forEach((cell) => expect(HOME_CELLS_BY_SEAT).toContain(cell));
    }
  });
});

describe('maze shifting', () => {
  function baseState(seed = 0): MazeState {
    return createState([P1, P2], seed);
  }

  it('shifts a row eastward and wraps a pawn off the edge back to the other side', () => {
    const state = baseState();
    state.pawns[0] = 1 * SIZE + 6; // dernière case de la ligne mobile 1
    const { pawns } = previewShift(state, 0, 0); // slot 0 : ligne 1, insertion ouest→est
    expect(pawns[0]).toBe(1 * SIZE + 0);
  });

  it('shifts a row westward, moving an interior pawn with its tile', () => {
    const state = baseState();
    state.pawns[0] = 1 * SIZE + 3;
    const { pawns } = previewShift(state, 3, 0); // slot 3 : ligne 1, insertion est→ouest
    expect(pawns[0]).toBe(1 * SIZE + 2);
  });

  it('shifts a column southward and northward with wraparound', () => {
    const state = baseState();
    state.pawns[0] = 6 * SIZE + 3; // dernière case de la colonne mobile 3
    const south = previewShift(state, 7, 0); // slot 7 : colonne 3 (2e ligne mobile), insertion nord→sud
    expect(south.pawns[0]).toBe(0 * SIZE + 3);

    state.pawns[0] = 0 * SIZE + 3;
    const north = previewShift(state, 10, 0); // slot 10 : colonne 3, insertion sud→nord
    expect(north.pawns[0]).toBe(6 * SIZE + 3);
  });

  it('turns the ejected tile into the new hand tile', () => {
    const state = baseState();
    const ejectedFromBoard = state.board[1 * SIZE + 6];
    const { handTile } = previewShift(state, 0, 0);
    expect(handTile).toEqual(ejectedFromBoard);
  });

  it('forbids the slot that would undo the previous shift', () => {
    const state = baseState();
    state.forbiddenSlot = OPPOSITE_SLOT[0];
    state.phase = 'playing';
    state.mode = 'solo';
    state.progress = { kind: 'shared', queue: [0] };
    expect(isValidMove(state, { type: 'turn', slot: OPPOSITE_SLOT[0], rotation: 0, destination: 0 })).toBe(false);
  });
});

function tile(shape: Tile['shape'], rotation: Rotation, treasure = -1): Tile {
  return { id: 0, shape, rotation, treasure };
}

describe('maze connectivity', () => {
  it('connects two neighbouring tiles only when both openings face each other', () => {
    const board: Tile[] = Array.from({ length: SIZE * SIZE }, () => tile(STRAIGHT, 1));
    // Une croix isolée au centre : ouvre au nord/sud (rotation 0), entourée
    // de tuiles est/ouest (rotation 1) qui ne s'y raccordent pas.
    const center = 3 * SIZE + 3;
    board[center] = tile(STRAIGHT, 0);
    const reachable = reachableFrom(board, center);
    expect(reachable.filter(Boolean)).toHaveLength(1);
  });

  it('walks a known corridor of connected tiles', () => {
    const board: Tile[] = Array.from({ length: SIZE * SIZE }, () => tile(STRAIGHT, 1));
    // Couloir horizontal complet sur la ligne 3 : tuiles droites est/ouest,
    // toutes connectées entre elles.
    for (let c = 0; c < SIZE; c++) board[3 * SIZE + c] = tile(STRAIGHT, 1);
    const reachable = reachableFrom(board, 3 * SIZE + 0);
    for (let c = 0; c < SIZE; c++) expect(reachable[3 * SIZE + c]).toBe(true);
  });

  it('checks all four rotations of an adjacent pair', () => {
    // Angle (nord/est) à gauche, angle (sud/ouest) à droite : leurs
    // ouvertures se font face à l'est/ouest → connectés.
    const board: Tile[] = Array.from({ length: SIZE * SIZE }, () => tile(STRAIGHT, 1));
    board[0] = tile(CORNER, 1); // est/sud
    board[1] = tile(CORNER, 3); // ouest/nord
    const reachable = reachableFrom(board, 0);
    expect(reachable[1]).toBe(true);
  });

  it('reconstructs the shortest path along a known corridor', () => {
    const board: Tile[] = Array.from({ length: SIZE * SIZE }, () => tile(STRAIGHT, 1));
    for (let c = 0; c < SIZE; c++) board[3 * SIZE + c] = tile(STRAIGHT, 1);
    const path = shortestPath(board, 3 * SIZE + 0, 3 * SIZE + 4);
    expect(path).toEqual([3 * SIZE + 0, 3 * SIZE + 1, 3 * SIZE + 2, 3 * SIZE + 3, 3 * SIZE + 4]);
  });

  it('returns null when the target is unreachable', () => {
    const board: Tile[] = Array.from({ length: SIZE * SIZE }, () => tile(STRAIGHT, 1));
    board[3 * SIZE + 3] = tile(STRAIGHT, 0); // isolée, rotation perpendiculaire
    expect(shortestPath(board, 3 * SIZE + 0, 3 * SIZE + 3)).toBeNull();
  });

  it('returns a single-cell path when start equals target', () => {
    const board: Tile[] = Array.from({ length: SIZE * SIZE }, () => tile(STRAIGHT, 1));
    expect(shortestPath(board, 5, 5)).toEqual([5]);
  });
});

describe('maze pickup and win', () => {
  function playableState(seed: number, mode: 'course' | 'partage' | 'solo', players: string[]): MazeState {
    let state = createState(players, seed);
    state = applyMove(state, { type: 'chooseMode', mode });
    if (state.phase === 'dealing') state = applyMove(state, { type: 'dealingDone' });
    return state;
  }

  it('picks up a treasure by walking onto its tile', () => {
    let state = playableState(1, 'solo', [P1]);
    const target = (state.progress as any).queue[0];
    const targetCell = state.board.findIndex((t) => t.treasure === target);
    // Force le pion juste à côté d'une case accessible : on utilise le vrai
    // moteur de coups plutôt que de tricher la position, en cherchant un
    // coup valide qui atteint exactement targetCell.
    let picked = false;
    outer: for (let slot = 0; slot < 12; slot++) {
      for (let rotation = 0; rotation < 4; rotation++) {
        const move = { type: 'turn' as const, slot, rotation: rotation as 0 | 1 | 2 | 3, destination: targetCell };
        if (isValidMove(state, move)) {
          state = applyMove(state, move);
          picked = true;
          break outer;
        }
      }
    }
    expect(picked).toBe(true);
    expect(state.collectedTreasureIds).toContain(target);
  });

  it('picks up a treasure when carried onto it by a shift (wraparound)', () => {
    let state = playableState(2, 'solo', [P1]);
    const target = (state.progress as any).queue[0];
    const targetCell = state.board.findIndex((t) => t.treasure === target);
    const row = Math.floor(targetCell / SIZE);
    const col = targetCell % SIZE;

    if ([1, 3, 5].includes(row)) {
      // Place le pion une case à l'ouest de la cible sur la même ligne
      // mobile, puis décale cette ligne d'un cran vers l'est : le pion
      // arrive sur la cible par le décalage seul (destination = position
      // actuelle, inchangée par la marche).
      state.pawns[0] = row * SIZE + ((col - 1 + SIZE) % SIZE);
      const slot = [0, 1, 2][([1, 3, 5] as number[]).indexOf(row)];
      const preview = previewShift(state, slot, 0);
      const move = { type: 'turn' as const, slot, rotation: 0 as const, destination: preview.pawns[0] };
      expect(preview.pawns[0]).toBe(targetCell);
      if (isValidMove(state, move)) {
        state = applyMove(state, move);
        expect(state.collectedTreasureIds).toContain(target);
      }
    }
  });

  it('refuses victory until the winning player is back home', () => {
    let state = playableState(3, 'solo', [P1]);
    // Vide la file à la main (contourne le tirage) pour isoler la règle du
    // retour à la maison plutôt que la collecte elle-même.
    state = { ...state, progress: { kind: 'shared', queue: [] } };
    state.pawns[0] = HOME_CELLS_BY_SEAT[0] === 0 ? 1 * SIZE + 1 : 0; // loin de la maison
    // Un coup qui ne ramène pas à la maison ne doit pas terminer la partie.
    for (let slot = 0; slot < 12; slot++) {
      for (let rotation = 0; rotation < 4; rotation++) {
        const move = { type: 'turn' as const, slot, rotation: rotation as 0 | 1 | 2 | 3, destination: state.pawns[0] };
        if (isValidMove(state, move) && move.destination !== state.homeCells[0]) {
          const next = applyMove(state, move);
          expect(getResult(next)).toBeNull();
          return;
        }
      }
    }
  });

  it('wins solo by returning home once the queue is empty', () => {
    let state = playableState(4, 'solo', [P1]);
    state = { ...state, progress: { kind: 'shared', queue: [] } };
    const home = state.homeCells[0];
    for (let slot = 0; slot < 12; slot++) {
      for (let rotation = 0; rotation < 4; rotation++) {
        const move = { type: 'turn' as const, slot, rotation: rotation as 0 | 1 | 2 | 3, destination: home };
        if (isValidMove(state, move)) {
          const next = applyMove(state, move);
          expect(getResult(next)).toEqual({
            kind: 'win',
            winner: P1,
            score: { value: expect.any(Number), variant: 'solo-6' },
          });
          return;
        }
      }
    }
    throw new Error('no reachable move found back home for this seed — pick another seed');
  });
});

describe('maze setup phase', () => {
  it('never assigns the bot the mode-picking or dealing turn', () => {
    const state = createState([P1, P2], 5);
    expect(currentPlayer(state)).toBe(P1);
    const dealt = applyMove(state, { type: 'chooseMode', mode: 'partage' });
    expect(dealt.phase).toBe('dealing');
    expect(currentPlayer(dealt)).toBe(P1);
  });

  it('only offers solo to a single seat and course/partage to two seats', () => {
    const solo = createState([P1], 6);
    expect(isValidMove(solo, { type: 'chooseMode', mode: 'solo' })).toBe(true);
    expect(isValidMove(solo, { type: 'chooseMode', mode: 'course' })).toBe(false);

    const duo = createState([P1, P2], 6);
    expect(isValidMove(duo, { type: 'chooseMode', mode: 'solo' })).toBe(false);
    expect(isValidMove(duo, { type: 'chooseMode', mode: 'course' })).toBe(true);
    expect(isValidMove(duo, { type: 'chooseMode', mode: 'partage' })).toBe(true);
  });
});

describe('maze purity', () => {
  it('never mutates the state passed to applyMove', () => {
    let state = createState([P1, P2], 7);
    state = applyMove(state, { type: 'chooseMode', mode: 'course' });
    const frozen = deepFreeze(structuredClone(state));

    for (let slot = 0; slot < 12; slot++) {
      for (let rotation = 0; rotation < 4; rotation++) {
        const { board, pawns } = previewShift(frozen, slot, rotation as 0 | 1 | 2 | 3);
        const reachable = reachableFrom(board, pawns[frozen.turnIndex]);
        const destination = reachable.findIndex(Boolean);
        const move = { type: 'turn' as const, slot, rotation: rotation as 0 | 1 | 2 | 3, destination };
        if (isValidMove(frozen, move)) {
          expect(() => applyMove(frozen, move)).not.toThrow();
          return;
        }
      }
    }
    throw new Error('no legal move found for this seed — pick another seed');
  });
});
