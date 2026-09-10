import { describe, expect, it } from 'vitest';
import { MELODIES, frequencyToNote, melodyLengthInBeats, noteToFrequency } from './music';
import type { PitchName } from './music';

const PITCHES: PitchName[] = ['do', 're', 'mi', 'fa', 'sol', 'la', 'si'];

describe('noteToFrequency', () => {
  it('returns the known frequency for each pitch of the octave', () => {
    expect(noteToFrequency('do')).toBeCloseTo(261.63, 1);
    expect(noteToFrequency('la')).toBeCloseTo(440.0, 1);
    expect(noteToFrequency('si')).toBeCloseTo(493.88, 1);
  });
});

describe('frequencyToNote', () => {
  it('round-trips every pitch through its frequency', () => {
    for (const pitch of PITCHES) {
      expect(frequencyToNote(noteToFrequency(pitch))).toBe(pitch);
    }
  });

  it('returns null for a frequency far from any pitch', () => {
    expect(frequencyToNote(999)).toBeNull();
    expect(frequencyToNote(1)).toBeNull();
  });

  it('is tolerant to a tiny amount of drift', () => {
    expect(frequencyToNote(noteToFrequency('mi') * 1.001)).toBe('mi');
  });
});

describe('melodyLengthInBeats', () => {
  it('sums note durations, rests included', () => {
    const melody = [
      { pitch: 'do' as const, beats: 1 },
      { pitch: null, beats: 2 },
      { pitch: 'mi' as const, beats: 0.5 },
    ];
    expect(melodyLengthInBeats(melody)).toBe(3.5);
  });

  it('is zero for an empty melody', () => {
    expect(melodyLengthInBeats([])).toBe(0);
  });
});

describe('melody library', () => {
  it('has four traditional melodies, each with a positive beat count', () => {
    expect(MELODIES).toHaveLength(4);
    for (const entry of MELODIES) {
      expect(entry.melody.length).toBeGreaterThan(0);
      expect(melodyLengthInBeats(entry.melody)).toBeGreaterThan(0);
    }
  });

  it('only uses pitches within the single available octave', () => {
    for (const entry of MELODIES) {
      for (const note of entry.melody) {
        if (note.pitch !== null) expect(PITCHES).toContain(note.pitch);
      }
    }
  });
});
