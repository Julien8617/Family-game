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
// Profondeur épinglée, pas le niveau 3 tel quel (dépend d'une constante
// interne à bot.ts) — même logique que chess-race/bot.test.ts : les tests de
// force s'appuient sur searchBestMove() directement, déterministe et rapide
// à profondeur fixée, jamais sur le budget de temps du niveau 4.
const search = (depth: number): Policy => (state) => searchBestMove(state, depth);

describe('connect4 bot — déterminisme', () => {
  it('produit exactement la même partie deux fois de suite, à seed égal, pour chaque niveau', () => {
    for (const policy of [easy, medium, search(3)]) {
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
  it('une recherche profonde gagne plus souvent que le niveau facile, sur 20 parties', () => {
    let deepWins = 0;
    let easyWins = 0;
    for (let i = 0; i < 20; i++) {
      const deepIsP1 = i % 2 === 0;
      const { winner } = playGame(i, deepIsP1 ? search(4) : easy, deepIsP1 ? easy : search(4));
      const deepWon = (deepIsP1 && winner === 'p1') || (!deepIsP1 && winner === 'p2');
      const easyWon = (deepIsP1 && winner === 'p2') || (!deepIsP1 && winner === 'p1');
      if (deepWon) deepWins++;
      if (easyWon) easyWins++;
    }
    expect(deepWins).toBeGreaterThan(easyWins);
  });

  it('une recherche profonde gagne plus souvent que le niveau moyen, sur 20 parties', () => {
    let deepWins = 0;
    let mediumWins = 0;
    for (let i = 0; i < 20; i++) {
      const deepIsP1 = i % 2 === 0;
      const { winner } = playGame(i, deepIsP1 ? search(4) : medium, deepIsP1 ? medium : search(4));
      const deepWon = (deepIsP1 && winner === 'p1') || (!deepIsP1 && winner === 'p2');
      const mediumWon = (deepIsP1 && winner === 'p2') || (!deepIsP1 && winner === 'p1');
      if (deepWon) deepWins++;
      if (mediumWon) mediumWins++;
    }
    expect(deepWins).toBeGreaterThan(mediumWins);
  });

  it('le niveau moyen gagne plus souvent que le niveau facile, sur 20 parties', () => {
    let mediumWins = 0;
    let easyWins = 0;
    for (let i = 0; i < 20; i++) {
      const mediumIsP1 = i % 2 === 0;
      const { winner } = playGame(i, mediumIsP1 ? medium : easy, mediumIsP1 ? easy : medium);
      const mediumWon = (mediumIsP1 && winner === 'p1') || (!mediumIsP1 && winner === 'p2');
      const easyWon = (mediumIsP1 && winner === 'p2') || (!mediumIsP1 && winner === 'p1');
      if (mediumWon) mediumWins++;
      if (easyWon) easyWins++;
    }
    expect(mediumWins).toBeGreaterThan(easyWins);
  });

  // Pas de garantie absolue « ne perd jamais » : une recherche à profondeur
  // fixée avec une heuristique simple reste exacte *dans son horizon*, mais
  // peut être menée dans une position déjà perdue par un piège construit
  // plus tôt, hors de portée de sa profondeur — un vrai angle mort
  // heuristique, pas un bug (vérifié en tracant une partie perdue : le coup
  // « fautif » ouvrait bien une case gagnante immédiate pour l'adversaire,
  // et toutes les autres colonnes menaient au même score de défaite forcée).
  it('une recherche plus profonde gagne plus souvent qu\'elle ne perd contre une recherche moins profonde, sur 20 parties', () => {
    let deepWins = 0;
    let deepLosses = 0;
    for (let i = 0; i < 20; i++) {
      const deepIsP1 = i % 2 === 0;
      const { winner } = playGame(i, deepIsP1 ? search(5) : search(2), deepIsP1 ? search(2) : search(5));
      const deepWon = (deepIsP1 && winner === 'p1') || (!deepIsP1 && winner === 'p2');
      const deepLost = (deepIsP1 && winner === 'p2') || (!deepIsP1 && winner === 'p1');
      if (deepWon) deepWins++;
      if (deepLost) deepLosses++;
    }
    expect(deepWins).toBeGreaterThan(deepLosses);
  });
});

describe('connect4 bot — chooseMove', () => {
  it("joue toujours une colonne légale, à chaque niveau", () => {
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
