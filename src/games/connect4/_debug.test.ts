import { describe, it } from 'vitest';
import { searchBestMove } from './bot';
import { applyMove, createState, getResult } from './logic';
import type { Connect4Move, Connect4State } from './logic';

function playGame(
  seed: number,
  p1: (s: Connect4State) => Connect4Move,
  p2: (s: Connect4State) => Connect4Move,
): 'p1' | 'p2' | 'draw' {
  let state = createState(['P1', 'P2'], seed);
  for (;;) {
    const result = getResult(state);
    if (result) return result.kind === 'draw' ? 'draw' : result.winner === 'P1' ? 'p1' : 'p2';
    const move = state.turn === 'P1' ? p1(state) : p2(state);
    state = applyMove(state, move);
  }
}

function matchup(depthA: number, depthB: number, games: number) {
  let aWins = 0;
  let bWins = 0;
  let draws = 0;
  const a = (s: Connect4State) => searchBestMove(s, depthA);
  const b = (s: Connect4State) => searchBestMove(s, depthB);
  for (let i = 0; i < games; i++) {
    const aIsP1 = i % 2 === 0;
    const winner = playGame(i, aIsP1 ? a : b, aIsP1 ? b : a);
    if (winner === 'draw') draws++;
    else if ((aIsP1 && winner === 'p1') || (!aIsP1 && winner === 'p2')) aWins++;
    else bWins++;
  }
  // eslint-disable-next-line no-console
  console.log(`depth${depthA} vs depth${depthB}: ${aWins}-${bWins}-${draws} (W-L-D for depth${depthA})`);
}

describe('debug sweep', () => {
  it('sweeps same-parity matchups', () => {
    matchup(4, 2, 20); // even vs even
    matchup(6, 4, 20);
    matchup(6, 2, 20);
    matchup(3, 1, 20); // odd vs odd
    matchup(5, 3, 20);
    matchup(5, 1, 20);
  });
});
