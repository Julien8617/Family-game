import { describe, expect, it } from 'vitest';
import { LookaheadScheduler, scheduleBeats, scheduleMelody } from './schedule';
import type { Melody } from './music';
import { noteToFrequency } from './music';

describe('scheduleMelody', () => {
  it('computes absolute instants from a simulated clock (no AudioContext involved)', () => {
    const melody: Melody = [
      { pitch: 'do', beats: 1 },
      { pitch: null, beats: 1 }, // rest
      { pitch: 'mi', beats: 2 },
    ];
    // 60 BPM => 1 beat = 1 second, easy to verify by hand.
    const events = scheduleMelody(melody, 60, 10);

    expect(events).toEqual([
      { time: 10, freq: noteToFrequency('do'), durationSec: 1 },
      { time: 11, freq: null, durationSec: 1 },
      { time: 12, freq: noteToFrequency('mi'), durationSec: 2 },
    ]);
  });

  it('scales durations with tempo', () => {
    const melody: Melody = [{ pitch: 'do', beats: 1 }];
    const slow = scheduleMelody(melody, 60, 0);
    const fast = scheduleMelody(melody, 120, 0);
    expect(slow[0].durationSec).toBeCloseTo(1);
    expect(fast[0].durationSec).toBeCloseTo(0.5);
  });

  it('returns an empty schedule for an empty melody', () => {
    expect(scheduleMelody([], 90, 5)).toEqual([]);
  });
});

describe('scheduleBeats', () => {
  it('produces one evenly-spaced instant per beat', () => {
    expect(scheduleBeats(4, 60, 0)).toEqual([0, 1, 2, 3]);
    expect(scheduleBeats(3, 120, 10)).toEqual([10, 10.5, 11]);
  });
});

// Horloge simulée : un simple compteur avancé à la main par le test, aucun
// AudioContext ni navigateur requis (critère 6).
class FakeClock {
  constructor(public t = 0) {}
  now() {
    return this.t;
  }
}

describe('LookaheadScheduler', () => {
  it('never emits an event before it enters the lookahead window', () => {
    const events = [
      { time: 0, freq: 100, durationSec: 0.5 },
      { time: 1, freq: 200, durationSec: 0.5 },
      { time: 2, freq: 300, durationSec: 0.5 },
    ];
    const clock = new FakeClock(0);
    const emitted: number[] = [];
    const scheduler = new LookaheadScheduler(events, {
      clock,
      scheduleAheadSec: 0.1,
      onEvent: (_event, index) => emitted.push(index),
    });

    scheduler.tick();
    // Only the event at t=0 is within [0, 0.1) — the rest are still ahead.
    expect(emitted).toEqual([0]);

    clock.t = 0.95; // event 1 (t=1) enters the 100ms window once now + 0.1 >= 1
    scheduler.tick();
    expect(emitted).toEqual([0, 1]);
  });

  it('emits every event exactly once, in order, none skipped', () => {
    const events = [
      { time: 0, freq: 100, durationSec: 0.2 },
      { time: 0.3, freq: 200, durationSec: 0.2 },
      { time: 0.6, freq: 300, durationSec: 0.2 },
    ];
    const clock = new FakeClock(0);
    const emitted: number[] = [];
    const scheduler = new LookaheadScheduler(events, {
      clock,
      scheduleAheadSec: 0.1,
      onEvent: (_event, index) => emitted.push(index),
    });

    // Simulate ticks every 25 ms, as the real 25 ms wake-up loop would.
    for (let t = 0; t <= 1; t += 0.025) {
      clock.t = t;
      scheduler.tick();
    }

    expect(emitted).toEqual([0, 1, 2]);
  });

  it('calls onDone once, only after the last event has finished playing', () => {
    const events = [{ time: 0, freq: 100, durationSec: 0.5 }];
    const clock = new FakeClock(0);
    let doneCount = 0;
    const scheduler = new LookaheadScheduler(events, {
      clock,
      scheduleAheadSec: 0.1,
      onEvent: () => {},
      onDone: () => doneCount++,
    });

    scheduler.tick();
    expect(scheduler.isDone()).toBe(false);

    clock.t = 0.4; // event started but not finished (0 + 0.5 = 0.5)
    scheduler.tick();
    expect(scheduler.isDone()).toBe(false);

    clock.t = 0.5;
    scheduler.tick();
    expect(scheduler.isDone()).toBe(true);
    expect(doneCount).toBe(1);

    clock.t = 0.6;
    scheduler.tick(); // no-op once done
    expect(doneCount).toBe(1);
  });

  it('handles an empty event list by finishing immediately', () => {
    const clock = new FakeClock(0);
    let done = false;
    const scheduler = new LookaheadScheduler([], {
      clock,
      scheduleAheadSec: 0.1,
      onEvent: () => {},
      onDone: () => (done = true),
    });
    scheduler.tick();
    expect(done).toBe(true);
  });
});
