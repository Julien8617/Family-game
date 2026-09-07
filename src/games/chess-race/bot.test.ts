import { describe, expect, it } from 'vitest';
import { chooseMove, searchBestMove } from './bot';
import { applyMove, createState, getResult } from './logic';
import type { ChessRaceMove, ChessRaceState } from './logic';

const WHITE = 'white-player';
const BLACK = 'black-player';

type Policy = (state: ChessRaceState) => ChessRaceMove;

// Une partie complète est bornée : les poussins n'avancent jamais en arrière,
// donc le total de progression possible est fini. Le plafond n'est qu'un
// filet de sécurité de test, pas une règle du jeu (voir NOTES.md du bot).
const PLY_SAFETY_CAP = 200;

function playGame(
  seed: number,
  whitePolicy: Policy,
  blackPolicy: Policy,
): { winner: 'white' | 'black' | 'draw' } {
  let state = createState([WHITE, BLACK], seed);
  for (let ply = 0; ply < PLY_SAFETY_CAP; ply++) {
    const result = getResult(state);
    if (result) {
      if (result.kind === 'draw') return { winner: 'draw' };
      return { winner: result.winner === WHITE ? 'white' : 'black' };
    }
    const move = state.turn === WHITE ? whitePolicy(state) : blackPolicy(state);
    state = applyMove(state, move);
  }
  return { winner: 'draw' }; // ne devrait jamais être atteint sur ce jeu
}

// Politiques dérivées des vrais niveaux du jeu. Les niveaux 1 et 2 utilisent
// chooseMove() tel quel (aucune horloge lue, donc parfaitement rapide et
// déterministe). Pour les niveaux 3 et 4, les 200 parties par appariement
// passent par searchBestMove() à une profondeur fixe plutôt que par
// chooseMove(level: 3|4) : le niveau 4 réel s'approfondit jusqu'à un budget
// de 500 ms mesuré à l'horloge (voir bot.ts), ce qui rendrait 200 parties
// beaucoup trop lentes en CI et introduirait une variance de profondeur
// dépendante de la machine. searchBestMove(state, 5) est le même moteur que
// le niveau 4, juste plus profond que le niveau 3 (profondeur 4) — assez pour
// représenter fidèlement l'écart de force, sans dépendre du temps réel. Le
// budget de 500 ms lui-même (critère 8) se vérifie sur l'iPad et via le test
// de fumée ci-dessous.
const level1: Policy = (state) => chooseMove(state, 1);
const level2: Policy = (state) => chooseMove(state, 2);
const level3Depth: Policy = (state) => searchBestMove(state, 4);
const level4Depth: Policy = (state) => searchBestMove(state, 5);

describe('chess-race bot — déterminisme', () => {
  it('produit exactement la même partie deux fois de suite, à seed égal, pour chaque niveau', () => {
    for (const policy of [level1, level2, level3Depth, level4Depth]) {
      const first = playGame(42, policy, policy);
      const second = playGame(42, policy, policy);
      expect(second).toEqual(first);
    }
  });

  it('chooseMove(level 3) est une fonction pure de state (même state, même coup)', () => {
    const state = createState([WHITE, BLACK], 7);
    expect(chooseMove(state, 3)).toEqual(chooseMove(state, 3));
  });
});

describe('chess-race bot — force des niveaux', () => {
  it('le niveau 4 (profondeur 5) gagne plus de 95% contre le niveau 1, sur 200 parties', () => {
    const games = 200;
    let level4Wins = 0;
    for (let i = 0; i < games; i++) {
      // Alterne qui joue les jaunes (premier trait) pour ne pas biaiser le
      // test par l'avantage du premier coup.
      const level4IsWhite = i % 2 === 0;
      const { winner } = playGame(
        i,
        level4IsWhite ? level4Depth : level1,
        level4IsWhite ? level1 : level4Depth,
      );
      const level4Won =
        (level4IsWhite && winner === 'white') || (!level4IsWhite && winner === 'black');
      if (level4Won) level4Wins++;
    }
    expect(level4Wins / games).toBeGreaterThan(0.95);
  });

  it('le niveau 3 (profondeur 4) gagne plus de 75% contre le niveau 2, sur 200 parties', () => {
    const games = 200;
    let level3Wins = 0;
    for (let i = 0; i < games; i++) {
      const level3IsWhite = i % 2 === 0;
      const { winner } = playGame(
        i,
        level3IsWhite ? level3Depth : level2,
        level3IsWhite ? level2 : level3Depth,
      );
      const level3Won =
        (level3IsWhite && winner === 'white') || (!level3IsWhite && winner === 'black');
      if (level3Won) level3Wins++;
    }
    expect(level3Wins / games).toBeGreaterThan(0.75);
  });
});

describe('chess-race bot — budget de temps (niveau 4)', () => {
  it('reste dans une marge très large autour du budget de 500 ms sur la position de départ', () => {
    // Filet de sécurité, pas une mesure de performance iPad : une machine de
    // CI peut être plus lente ou plus rapide qu'un A8X. Le critère 8 se
    // vérifie pour de vrai sur l'appareil.
    const state = createState([WHITE, BLACK], 1);
    const start = performance.now();
    chooseMove(state, 4);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(2000);
  });
});
