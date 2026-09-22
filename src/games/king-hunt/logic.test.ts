import { describe, expect, it } from 'vitest';
import { createEmptyBoard } from '../../chess/pieces';
import {
  allLegalMoves,
  applyMove,
  createState,
  currentPlayer,
  DEFAULT_BUDGET,
  getResult,
  isValidMove,
  legalMovesFrom,
  LEVEL_BUDGET,
  SIZE,
} from './logic';
import type { KingHuntState } from './logic';

const ROOKS = 'rooksPlayer';
const KING = 'kingPlayer';

function stateWith(overrides: Partial<KingHuntState> = {}): KingHuntState {
  const board = createEmptyBoard(SIZE);
  board[0] = { type: 'rook', side: 'own' };
  board[4] = { type: 'rook', side: 'own' };
  board[24] = { type: 'king', side: 'enemy' };
  return {
    board,
    turn: 'rooks',
    players: [ROOKS, KING],
    seed: 1,
    level: 1,
    budgetTotal: DEFAULT_BUDGET,
    budgetLeft: DEFAULT_BUDGET,
    lastMove: null,
    moveCount: 0,
    ...overrides,
  };
}

describe('createState', () => {
  it('pose deux tours et un roi sur des cases distinctes', () => {
    const state = createState([ROOKS, KING], 42);
    let rooks = 0;
    let kings = 0;
    for (const piece of state.board) {
      if (piece?.type === 'rook') rooks++;
      if (piece?.type === 'king') kings++;
    }
    expect(rooks).toBe(2);
    expect(kings).toBe(1);
  });

  it('ne pose jamais le roi adjacent à une tour ni attaquable au premier coup', () => {
    for (let seed = 0; seed < 200; seed++) {
      const state = createState([ROOKS, KING], seed);
      const kingSquare = state.board.findIndex((p) => p?.type === 'king');
      const kingRow = Math.floor(kingSquare / SIZE);
      const kingCol = kingSquare % SIZE;

      for (let sq = 0; sq < state.board.length; sq++) {
        if (state.board[sq]?.type !== 'rook') continue;
        const row = Math.floor(sq / SIZE);
        const col = sq % SIZE;
        const adjacent = Math.abs(row - kingRow) <= 1 && Math.abs(col - kingCol) <= 1;
        expect(adjacent).toBe(false);
      }
      // Aucun coup des tours ne doit pouvoir prendre le roi immédiatement.
      const moves = allLegalMoves(state);
      expect(moves.every((m) => m.to !== kingSquare)).toBe(true);
    }
  });

  it('applique le budget du niveau demandé, ou le budget par défaut sans niveau', () => {
    expect(createState([ROOKS, KING], 1, { level: 3 }).budgetTotal).toBe(LEVEL_BUDGET[3]);
    expect(createState([ROOKS, KING], 1).budgetTotal).toBe(DEFAULT_BUDGET);
  });

  it('est déterministe : même seed, même position', () => {
    const a = createState([ROOKS, KING], 777);
    const b = createState([ROOKS, KING], 777);
    expect(a.board).toEqual(b.board);
  });
});

describe('isValidMove / applyMove', () => {
  it('refuse un coup qui ne part pas d’une pièce du camp au trait', () => {
    const state = stateWith(); // trait aux tours
    expect(isValidMove(state, { from: 24, to: 23 })).toBe(false); // le roi n'a pas la main
  });

  it('une tour se déplace en ligne et en colonne, bloquée par une pièce', () => {
    const board = createEmptyBoard(SIZE);
    board[0] = { type: 'rook', side: 'own' };
    board[2] = { type: 'rook', side: 'own' }; // bloque la tour en 0 sur sa ligne
    board[24] = { type: 'king', side: 'enemy' };
    const state = stateWith({ board });
    expect(isValidMove(state, { from: 0, to: 1 })).toBe(true);
    expect(isValidMove(state, { from: 0, to: 2 })).toBe(false); // case occupée par une pièce amie
    expect(isValidMove(state, { from: 0, to: 3 })).toBe(false); // au-delà d'une pièce qui bloque
  });

  it('le budget ne se décompte qu’aux coups des tours', () => {
    let state = stateWith();
    state = applyMove(state, { from: 0, to: 1 }); // tour
    expect(state.budgetLeft).toBe(DEFAULT_BUDGET - 1);
    expect(state.turn).toBe('king');
    state = applyMove(state, { from: 24, to: 23 }); // roi
    expect(state.budgetLeft).toBe(DEFAULT_BUDGET - 1);
    expect(state.turn).toBe('rooks');
  });

  it("n'applique jamais de mutation de l'état d'entrée", () => {
    const state = stateWith();
    const boardBefore = state.board.slice();
    applyMove(state, { from: 0, to: 1 });
    expect(state.board).toEqual(boardBefore);
  });
});

describe('getResult', () => {
  it('les tours gagnent en prenant le roi', () => {
    const board = createEmptyBoard(SIZE);
    board[0] = { type: 'rook', side: 'own' };
    board[4] = { type: 'rook', side: 'own' };
    board[20] = { type: 'king', side: 'enemy' }; // même colonne que la tour en 0
    const state = stateWith({ board, budgetLeft: 5 });
    const next = applyMove(state, { from: 0, to: 20 });
    const result = getResult(next);
    expect(result).toEqual({ kind: 'win', winner: ROOKS, score: { value: 4, variant: '1' } });
  });

  it('le roi gagne en prenant une tour, protégée ou non', () => {
    const board = createEmptyBoard(SIZE);
    board[0] = { type: 'rook', side: 'own' };
    board[4] = { type: 'rook', side: 'own' };
    board[1] = { type: 'king', side: 'enemy' }; // adjacent à la tour en 0
    const state = stateWith({ board, turn: 'king' });
    const next = applyMove(state, { from: 1, to: 0 });
    expect(getResult(next)).toEqual({ kind: 'win', winner: KING });
  });

  it('le roi gagne quand le budget des tours est épuisé sans capture', () => {
    const state = stateWith({ budgetLeft: 1 });
    const next = applyMove(state, { from: 0, to: 1 }); // ne capture pas le roi
    expect(getResult(next)).toEqual({ kind: 'win', winner: KING });
  });

  it('une capture du roi l’emporte même si elle épuise le budget le même coup', () => {
    const board = createEmptyBoard(SIZE);
    board[0] = { type: 'rook', side: 'own' };
    board[4] = { type: 'rook', side: 'own' };
    board[20] = { type: 'king', side: 'enemy' };
    const state = stateWith({ board, budgetLeft: 1 });
    const next = applyMove(state, { from: 0, to: 20 });
    const result = getResult(next);
    expect(result?.kind).toBe('win');
    expect(result && 'winner' in result ? result.winner : undefined).toBe(ROOKS);
  });

  it('currentPlayer renvoie null une fois la partie terminée', () => {
    const board = createEmptyBoard(SIZE);
    board[0] = { type: 'rook', side: 'own' };
    board[4] = { type: 'rook', side: 'own' };
    board[20] = { type: 'king', side: 'enemy' };
    const state = stateWith({ board });
    const next = applyMove(state, { from: 0, to: 20 });
    expect(getResult(next)).not.toBeNull();
    expect(currentPlayer(next)).toBeNull();
  });
});

describe('déplacements', () => {
  it('un roi en coin n’a que ses cases voisines sur le plateau', () => {
    const board = createEmptyBoard(SIZE);
    board[24] = { type: 'rook', side: 'own' }; // loin, ne bloque rien
    board[23] = { type: 'rook', side: 'own' };
    board[0] = { type: 'king', side: 'enemy' }; // coin (0,0)
    const state = stateWith({ board, turn: 'king' });
    const targets = legalMovesFrom(state, 0);
    // voisins d'un coin sur un plateau 5×5 : (0,1)=1, (1,0)=5, (1,1)=6
    expect(new Set(targets)).toEqual(new Set([1, 5, 6]));
  });
});
