import { describe, expect, it } from 'vitest';
import { chooseMove, searchBestMove } from './bot';
import { applyMove, createState, getResult } from './logic';
import type { Connect4Move, Connect4State } from './logic';

const P1 = 'player-1';
const P2 = 'player-2';

type Policy = (state: Connect4State) => Connect4Move;

function playGame(seed: number, p1Policy: Policy, p2Policy: Policy): { winner: 'p1' | 'p2' | 'draw' } {
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
const hard: Policy = (state) => chooseMove(state, 3);
const strongest: Policy = (state) => chooseMove(state, 4);

function winRate(policyA: Policy, policyB: Policy, games: number): { aWins: number; bWins: number } {
  let aWins = 0;
  let bWins = 0;
  for (let i = 0; i < games; i++) {
    const aIsP1 = i % 2 === 0;
    const { winner } = playGame(i, aIsP1 ? policyA : policyB, aIsP1 ? policyB : policyA);
    if ((aIsP1 && winner === 'p1') || (!aIsP1 && winner === 'p2')) aWins++;
    else if (winner !== 'draw') bWins++;
  }
  return { aWins, bWins };
}

describe('connect4 bot — déterminisme', () => {
  it('produit exactement la même partie deux fois de suite, à seed égal, pour chaque niveau', () => {
    for (const policy of [easy, medium, hard, strongest]) {
      const first = playGame(42, policy, policy);
      const second = playGame(42, policy, policy);
      expect(second).toEqual(first);
    }
  });

  it('searchBestMove est une fonction pure de state (même state, même coup)', () => {
    const state = createState([P1, P2], 7);
    expect(searchBestMove(state, 3)).toEqual(searchBestMove(state, 3));
  });
});

describe('connect4 bot — force des niveaux', () => {
  // Échelle de force, pas d'exhaustivité (contrairement au morpion : l'espace
  // d'états est bien trop grand ici pour un minimax exhaustif) — un petit
  // nombre de parties suffit à distinguer des niveaux nettement différents.
  //
  // Pas de comparaison niveau 3 / niveau 4 ici : les deux jouent la même
  // recherche à profondeur fixe (voir bot.ts) sauf tout en fin de partie, où
  // le niveau 4 résout exactement — la différence entre eux est donc rare et
  // petite par construction, pas quelque chose qu'un échantillon de parties
  // suffit à mettre en évidence de façon fiable. Ce que la conception
  // garantit (jamais pire, occasionnellement meilleur) n'a pas besoin d'un
  // test statistique pour être vrai — voir NOTES.md pour la démonstration.
  it('le niveau moyen gagne plus souvent que le niveau facile, sur 20 parties', () => {
    const { aWins, bWins } = winRate(medium, easy, 20);
    expect(aWins).toBeGreaterThan(bWins);
  });

  it('le niveau difficile gagne largement contre le niveau facile, sur 20 parties', () => {
    const { aWins, bWins } = winRate(hard, easy, 20);
    expect(aWins).toBeGreaterThan(bWins);
  });

  it('le niveau difficile gagne largement contre le niveau moyen, sur 20 parties', () => {
    const { aWins, bWins } = winRate(hard, medium, 20);
    expect(aWins).toBeGreaterThan(bWins);
  });

  it('le niveau le plus fort gagne largement contre le niveau facile, sur 20 parties', () => {
    const { aWins, bWins } = winRate(strongest, easy, 20);
    expect(aWins).toBeGreaterThan(bWins);
  });

  it('le niveau le plus fort gagne largement contre le niveau moyen, sur 20 parties', () => {
    const { aWins, bWins } = winRate(strongest, medium, 20);
    expect(aWins).toBeGreaterThan(bWins);
  });
});

describe('connect4 bot — chooseMove', () => {
  it('joue toujours une colonne légale, à chaque niveau', () => {
    for (const level of [1, 2, 3, 4]) {
      let state = createState([P1, P2], level);
      for (let i = 0; i < 8 && !getResult(state); i++) {
        const move = chooseMove(state, level);
        expect(move.col).toBeGreaterThanOrEqual(0);
        expect(move.col).toBeLessThan(7);
        state = applyMove(state, move);
      }
    }
  });
});
