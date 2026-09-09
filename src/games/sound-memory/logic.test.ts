import { describe, expect, it } from 'vitest';
import { applyMove, createState, currentPlayer, getResult, isValidMove } from './logic';
import type { SoundMemoryState } from './logic';

const PLAYER = 'p1';

describe('sound-memory logic', () => {
  it('starts in setup, with no pad count chosen yet', () => {
    const state = createState([PLAYER], 0);
    expect(state.phase).toBe('setup');
    expect(state.padCount).toBeNull();
    expect(state.sequence).toEqual([]);
  });

  it('derives rhythmMs from the chosen level, defaulting when absent', () => {
    const fast = createState([PLAYER], 0, { level: 4 });
    const noOptions = createState([PLAYER], 0);
    expect(fast.rhythmMs).toBeLessThan(noOptions.rhythmMs);
  });

  it('rejects setPadCount outside setup', () => {
    const state = createState([PLAYER], 0);
    const started = applyMove(state, { type: 'setPadCount', count: 4 });
    expect(isValidMove(started, { type: 'setPadCount', count: 2 })).toBe(false);
  });

  it('rejects an unknown pad count', () => {
    const state = createState([PLAYER], 0);
    // @ts-expect-error 3 n'est pas un PadCount valide
    expect(isValidMove(state, { type: 'setPadCount', count: 3 })).toBe(false);
  });

  it('starts a one-pad sequence and moves to showing on setPadCount', () => {
    const state = createState([PLAYER], 42);
    const next = applyMove(state, { type: 'setPadCount', count: 4 });
    expect(next.phase).toBe('showing');
    expect(next.padCount).toBe(4);
    expect(next.sequence).toHaveLength(1);
    expect(next.sequence[0]).toBeGreaterThanOrEqual(0);
    expect(next.sequence[0]).toBeLessThan(4);
  });

  it('does not mutate the input state', () => {
    const state = createState([PLAYER], 0);
    const sequenceBefore = state.sequence.slice();
    applyMove(state, { type: 'setPadCount', count: 2 });
    expect(state.sequence).toEqual(sequenceBefore);
    expect(state.phase).toBe('setup');
  });

  it('rejects a tap while showing the sequence', () => {
    const state = applyMove(createState([PLAYER], 0), { type: 'setPadCount', count: 2 });
    expect(isValidMove(state, { type: 'tap', pad: 0 })).toBe(false);
  });

  it('accepts sequenceShown only while showing', () => {
    const setup = createState([PLAYER], 0);
    expect(isValidMove(setup, { type: 'sequenceShown' })).toBe(false);
    const showing = applyMove(setup, { type: 'setPadCount', count: 2 });
    expect(isValidMove(showing, { type: 'sequenceShown' })).toBe(true);
  });

  function reachInput(seed: number, count: 2 | 4 | 6 | 8): SoundMemoryState {
    const showing = applyMove(createState([PLAYER], seed), { type: 'setPadCount', count });
    return applyMove(showing, { type: 'sequenceShown' });
  }

  it('advances progress on a correct tap that does not finish the round', () => {
    // Séquence à 1 pad seulement (round 0) : un seul tap suffit à la finir,
    // donc on force artificiellement une manche plus longue en la rejouant.
    let state = reachInput(1, 8);
    // Termine la première manche (1 pad) pour atteindre une manche à 2 pads.
    const firstPad = state.sequence[0];
    state = applyMove(state, { type: 'tap', pad: firstPad });
    expect(state.phase).toBe('showing');
    expect(state.score).toBe(1);
    expect(state.sequence).toHaveLength(2);
    // La séquence grandit en gardant le préfixe précédent intact.
    expect(state.sequence[0]).toBe(firstPad);

    state = applyMove(state, { type: 'sequenceShown' });
    state = applyMove(state, { type: 'tap', pad: state.sequence[0] });
    expect(state.phase).toBe('input');
    expect(state.progress).toBe(1);
    expect(getResult(state)).toBeNull();
  });

  it('ends the game on a wrong tap, scoring the rounds completed before it', () => {
    let state = reachInput(1, 2);
    const correctPad = state.sequence[0];
    const wrongPad = correctPad === 0 ? 1 : 0;
    state = applyMove(state, { type: 'tap', pad: wrongPad });
    expect(state.phase).toBe('gameover');
    expect(state.lastTap).toBe(wrongPad);
    expect(currentPlayer(state)).toBeNull();
    expect(getResult(state)).toEqual({ kind: 'win', winner: PLAYER, score: { value: 0, variant: 'pads-2' } });
  });

  it('reports null while the game continues', () => {
    const state = reachInput(0, 4);
    expect(getResult(state)).toBeNull();
  });

  it('rejects a tap once the game is over', () => {
    let state = reachInput(1, 2);
    const correctPad = state.sequence[0];
    const wrongPad = correctPad === 0 ? 1 : 0;
    state = applyMove(state, { type: 'tap', pad: wrongPad });
    expect(isValidMove(state, { type: 'tap', pad: correctPad })).toBe(false);
  });

  it('rejects a tap outside the pad range', () => {
    const state = reachInput(0, 4);
    expect(isValidMove(state, { type: 'tap', pad: -1 })).toBe(false);
    expect(isValidMove(state, { type: 'tap', pad: 4 })).toBe(false);
  });
});
