import { describe, expect, it } from 'vitest';
import { adjustLevel, chooseMove } from './bot';
import { applyMove, createState, getResult } from './logic';
import type { TicTacToeMove, TicTacToeState } from './logic';

const P1 = 'player-1';
const P2 = 'player-2';

type Policy = (state: TicTacToeState) => TicTacToeMove;

function playGame(
  seed: number,
  p1Policy: Policy,
  p2Policy: Policy,
): { winner: 'p1' | 'p2' | 'draw' } {
  let state = createState([P1, P2], seed);
  for (;;) {
    const result = getResult(state);
    if (result) {
      if (result.kind === 'draw') return { winner: 'draw' };
      return { winner: result.winner === P1 ? 'p1' : 'p2' };
    }
    const move = state.turn === P1 ? p1Policy(state) : p2Policy(state);
    state = applyMove(state, move);
  }
}

const easy: Policy = (state) => chooseMove(state, 1);
const medium: Policy = (state) => chooseMove(state, 2);
const unbeatable: Policy = (state) => chooseMove(state, 3);

describe('tictactoe bot — déterminisme', () => {
  it('produit exactement la même partie deux fois de suite, à seed égal, pour chaque niveau', () => {
    for (const policy of [easy, medium, unbeatable]) {
      const first = playGame(42, policy, policy);
      const second = playGame(42, policy, policy);
      expect(second).toEqual(first);
    }
  });

  it('chooseMove(niveau imbattable) est une fonction pure de state (même state, même coup)', () => {
    const state = createState([P1, P2], 7);
    expect(chooseMove(state, 3)).toEqual(chooseMove(state, 3));
  });
});

describe('tictactoe bot — force des niveaux', () => {
  // 30 parties : invariant prouvé par le minimax exhaustif, pas une mesure
  // statistique — pas besoin de plus pour l'exercer (alternance premier
  // joueur + seeds variés), et chaque partie relance une recherche complète
  // depuis (quasi) plateau vide à chaque coup de l'imbattable, sans mémoïsation.
  it('le niveau imbattable ne perd jamais contre le niveau facile, sur 30 parties', () => {
    let losses = 0;
    for (let i = 0; i < 30; i++) {
      const unbeatableIsP1 = i % 2 === 0;
      const { winner } = playGame(i, unbeatableIsP1 ? unbeatable : easy, unbeatableIsP1 ? easy : unbeatable);
      const unbeatableLost =
        (unbeatableIsP1 && winner === 'p2') || (!unbeatableIsP1 && winner === 'p1');
      if (unbeatableLost) losses++;
    }
    expect(losses).toBe(0);
  });

  it('le niveau imbattable ne perd jamais contre le niveau moyen, sur 30 parties', () => {
    let losses = 0;
    for (let i = 0; i < 30; i++) {
      const unbeatableIsP1 = i % 2 === 0;
      const { winner } = playGame(i, unbeatableIsP1 ? unbeatable : medium, unbeatableIsP1 ? medium : unbeatable);
      const unbeatableLost =
        (unbeatableIsP1 && winner === 'p2') || (!unbeatableIsP1 && winner === 'p1');
      if (unbeatableLost) losses++;
    }
    expect(losses).toBe(0);
  });

  it('deux niveaux imbattables l\'un contre l\'autre font toujours match nul', () => {
    for (let i = 0; i < 20; i++) {
      const { winner } = playGame(i, unbeatable, unbeatable);
      expect(winner).toBe('draw');
    }
  });

  it('le niveau moyen gagne plus souvent que le niveau facile, sur 200 parties', () => {
    let mediumWins = 0;
    let easyWins = 0;
    for (let i = 0; i < 200; i++) {
      const mediumIsP1 = i % 2 === 0;
      const { winner } = playGame(i, mediumIsP1 ? medium : easy, mediumIsP1 ? easy : medium);
      const mediumWon = (mediumIsP1 && winner === 'p1') || (!mediumIsP1 && winner === 'p2');
      const easyWon = (mediumIsP1 && winner === 'p2') || (!mediumIsP1 && winner === 'p1');
      if (mediumWon) mediumWins++;
      if (easyWon) easyWins++;
    }
    expect(mediumWins).toBeGreaterThan(easyWins);
  });
});

describe('tictactoe bot — adjustLevel (adoucissement contre l\'Imbattable)', () => {
  it('joue Imbattable tant que la série de défaites est sous 3', () => {
    expect(adjustLevel(3, 0)).toBe(3);
    expect(adjustLevel(3, 1)).toBe(3);
    expect(adjustLevel(3, 2)).toBe(3);
  });

  it('passe à Moyen à partir de 3 défaites d\'affilée, jusqu\'à 4', () => {
    expect(adjustLevel(3, 3)).toBe(2);
    expect(adjustLevel(3, 4)).toBe(2);
  });

  it('passe à Facile à partir de 5 défaites d\'affilée', () => {
    expect(adjustLevel(3, 5)).toBe(1);
    expect(adjustLevel(3, 20)).toBe(1);
  });

  it('ne touche jamais un niveau explicitement choisi autre qu\'Imbattable', () => {
    expect(adjustLevel(1, 10)).toBe(1);
    expect(adjustLevel(2, 10)).toBe(2);
  });
});
