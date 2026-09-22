import { describe, expect, it } from 'vitest';
import { applyMove, createState, getResult, LEVEL_BUDGET } from './logic';
import type { KingHuntState } from './logic';
import { chooseMove, forcedCaptureDistance } from './bot';

const ROOKS = 'rooksPlayer';
const KING = 'kingPlayer';

// Simule une partie complète, camp par camp, sous un horizon généreux
// (jamais le budget réel d'un niveau) — sert à la fois au test de
// faisabilité et au test de force : seul le nombre de coups DE TOUR joués
// avant capture nous intéresse, pas la règle de budget elle-même (testée à
// part dans logic.test.ts).
const HORIZON = 60;

function simulate(seed: number, rooksLevel: number, kingLevel: number): { rookMoves: number; winner: 'rooks' | 'king' | null } {
  let state: KingHuntState = { ...createState([ROOKS, KING], seed, { level: 4 }), budgetTotal: HORIZON, budgetLeft: HORIZON };
  let rookMoves = 0;

  for (let i = 0; i < 300; i++) {
    const result = getResult(state);
    if (result) {
      const winner = result.kind === 'win' ? (result.winner === ROOKS ? 'rooks' : 'king') : null;
      return { rookMoves, winner };
    }
    const level = state.turn === 'rooks' ? rooksLevel : kingLevel;
    const move = chooseMove(state, level);
    state = applyMove(state, move);
    if (state.turn === 'king') rookMoves++; // le coup qui vient d'être joué était celui des tours
  }
  throw new Error('partie non terminée après 300 coups — horizon insuffisant ou bug de résolution');
}

describe('déterminisme', () => {
  it('même seed et même suite de coups produisent exactement la même partie, deux fois', () => {
    function play(seed: number): KingHuntState {
      let state = createState([ROOKS, KING], seed, { level: 3 });
      for (let i = 0; i < 20 && !getResult(state); i++) {
        const level = state.turn === 'rooks' ? 3 : 4;
        state = applyMove(state, chooseMove(state, level));
      }
      return state;
    }
    const a = play(2024);
    const b = play(2024);
    expect(a).toEqual(b);
  });

  it('chooseMove est pure : même state et même niveau, toujours le même coup', () => {
    const state = createState([ROOKS, KING], 55, { level: 4 });
    const m1 = chooseMove(state, 4);
    const m2 = chooseMove(state, 4);
    expect(m1).toEqual(m2);
  });
});

describe('table résolue (niveau 4)', () => {
  it('faisabilité : depuis cent positions de départ tirées au sort, un joueur de tours parfait attrape le roi du niveau 4 dans son budget', () => {
    const budget = LEVEL_BUDGET[4];
    for (let seed = 0; seed < 100; seed++) {
      const state = createState([ROOKS, KING], seed * 1013 + 7, { level: 4 });
      const distance = forcedCaptureDistance(state);
      expect(distance).not.toBeNull();
      expect(distance as number).toBeLessThanOrEqual(budget);
    }
  });
});

describe('force des niveaux du roi', () => {
  it('le roi de niveau 4 survit strictement plus longtemps en moyenne que le niveau 3, lui-même plus que le niveau 2 (200 parties, tours parfaites)', () => {
    const GAMES = 200;
    const means: Record<number, number> = {};

    for (const kingLevel of [2, 3, 4]) {
      let total = 0;
      for (let seed = 0; seed < GAMES; seed++) {
        const { rookMoves, winner } = simulate(100_000 + seed * 7919 + 13, 4, kingLevel);
        expect(winner).toBe('rooks'); // tours parfaites : toujours une capture forcée, jamais une fuite
        total += rookMoves;
      }
      means[kingLevel] = total / GAMES;
    }

    expect(means[3]).toBeGreaterThan(means[2]);
    expect(means[4]).toBeGreaterThan(means[3]);
  });
});

describe('niveau 1 — battable sans stratégie', () => {
  it('un roi qui joue au hasard se fait rattraper très largement dans son propre budget (partie jouable en tâtonnant)', () => {
    // Isole la faiblesse du roi niveau 1 (coup légal au hasard, sans même
    // chercher à fuir, spec 07) en jouant contre des tours PARFAITES : sert
    // à vérifier que ce niveau est bien le plus facile de l'échelle, pas à
    // mesurer la qualité des tours elles-mêmes (voir note plus bas — un roi
    // aléatoire peut accidentellement croquer une tour mal défendue par une
    // IA de tours imparfaite, ce qui n'a rien à voir avec la difficulté du
    // roi choisie ici).
    const GAMES = 100;
    let total = 0;
    for (let seed = 0; seed < GAMES; seed++) {
      const { rookMoves, winner } = simulate(seed * 31 + 1, 4, 1);
      expect(winner).toBe('rooks');
      total += rookMoves;
    }
    expect(total / GAMES).toBeLessThan(LEVEL_BUDGET[1] / 2);
  });
});
