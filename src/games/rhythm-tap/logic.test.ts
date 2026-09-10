import { describe, expect, it } from 'vitest';
import { applyMove, createState, currentPlayer, getResult, isValidMove } from './logic';
import type { RhythmTapState } from './logic';

const PLAYER = 'p1';

describe('rhythm-tap logic', () => {
  it('starts ready, with a tempo and a melody picked from the seed', () => {
    const state = createState([PLAYER], 0);
    expect(state.phase).toBe('ready');
    expect(state.player).toBe(PLAYER);
    expect(state.totalBeats).toBeGreaterThan(0);
    expect(state.claimedBeats).toHaveLength(state.totalBeats);
    expect(state.claimedBeats.every((c) => c === false)).toBe(true);
  });

  it('derives tempoBpm from the chosen level, defaulting when absent', () => {
    const slow = createState([PLAYER], 0, { level: 1 });
    const fast = createState([PLAYER], 0, { level: 4 });
    const noOptions = createState([PLAYER], 0);
    expect(slow.tempoBpm).toBeLessThan(noOptions.tempoBpm);
    expect(fast.tempoBpm).toBeGreaterThan(noOptions.tempoBpm);
  });

  it('picks the melody deterministically from the seed', () => {
    const a = createState([PLAYER], 42);
    const b = createState([PLAYER], 42);
    expect(a.melodyId).toBe(b.melodyId);
    expect(a.totalBeats).toBe(b.totalBeats);
  });

  it('does not mutate the input state', () => {
    const state = createState([PLAYER], 0);
    const before = state.claimedBeats.slice();
    applyMove(state, { type: 'start' });
    expect(state.phase).toBe('ready');
    expect(state.claimedBeats).toEqual(before);
  });

  it('rejects a tap before start', () => {
    const state = createState([PLAYER], 0);
    expect(isValidMove(state, { type: 'tap', atBeat: 0 })).toBe(false);
  });

  function reachPlaying(seed: number): RhythmTapState {
    return applyMove(createState([PLAYER], seed), { type: 'start' });
  }

  it('classifies a tap right on the beat as good, and scores it', () => {
    let state = reachPlaying(0);
    state = applyMove(state, { type: 'tap', atBeat: 2.0 });
    expect(state.lastTapResult).toBe('good');
    expect(state.claimedBeats[2]).toBe(true);
  });

  it('classifies an early tap as early, without scoring it', () => {
    let state = reachPlaying(0);
    // 0.22 de tolérance : 0.4 en avance est nettement hors fenêtre.
    state = applyMove(state, { type: 'tap', atBeat: 1.6 });
    expect(state.lastTapResult).toBe('early');
    expect(state.claimedBeats.some(Boolean)).toBe(false);
  });

  it('classifies a late tap as late, without scoring it', () => {
    let state = reachPlaying(0);
    state = applyMove(state, { type: 'tap', atBeat: 2.4 });
    expect(state.lastTapResult).toBe('late');
    expect(state.claimedBeats.some(Boolean)).toBe(false);
  });

  it('counts two taps on the same beat only once', () => {
    let state = reachPlaying(0);
    state = applyMove(state, { type: 'tap', atBeat: 3.05 });
    expect(state.claimedBeats[3]).toBe(true);
    const claimedCountAfterFirst = state.claimedBeats.filter(Boolean).length;

    state = applyMove(state, { type: 'tap', atBeat: 3.1 });
    expect(state.lastTapResult).toBe('good'); // timing was still good...
    const claimedCountAfterSecond = state.claimedBeats.filter(Boolean).length;
    expect(claimedCountAfterSecond).toBe(claimedCountAfterFirst); // ...but doesn't score twice
    expect(state.tapCount).toBe(2); // both taps are still counted as taps received
  });

  it('reports null while the round continues, and null currentPlayer only once done', () => {
    const state = reachPlaying(0);
    expect(getResult(state)).toBeNull();
    expect(currentPlayer(state)).toBe(PLAYER);
  });

  it('ends the round on melodyDone, scoring the beats hit', () => {
    let state = reachPlaying(1);
    state = applyMove(state, { type: 'tap', atBeat: 0 });
    state = applyMove(state, { type: 'tap', atBeat: 1 });
    state = applyMove(state, { type: 'melodyDone' });

    expect(state.phase).toBe('done');
    expect(currentPlayer(state)).toBeNull();
    const result = getResult(state);
    expect(result).toEqual({
      kind: 'win',
      winner: PLAYER,
      score: { value: 2, variant: `tempo${state.tempoLevel}-${state.melodyId}` },
    });
  });

  it('resets to a fresh attempt on restart, as the background-interrupt path does', () => {
    let state = reachPlaying(0);
    state = applyMove(state, { type: 'tap', atBeat: 0 });
    expect(state.claimedBeats.some(Boolean)).toBe(true);

    state = applyMove(state, { type: 'restart' });
    expect(state.phase).toBe('ready');
    expect(state.claimedBeats.every((c) => c === false)).toBe(true);
    expect(state.lastTapResult).toBeNull();
    expect(state.tapCount).toBe(0);
  });

  it('rejects restart and melodyDone outside the playing phase', () => {
    const ready = createState([PLAYER], 0);
    expect(isValidMove(ready, { type: 'restart' })).toBe(false);
    expect(isValidMove(ready, { type: 'melodyDone' })).toBe(false);
  });
});
