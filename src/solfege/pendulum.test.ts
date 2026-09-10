import { describe, expect, it } from 'vitest';
import { pendulumAngle } from './pendulum';

describe('pendulumAngle', () => {
  it('is at the positive extreme exactly on the reference beat', () => {
    expect(pendulumAngle(10, 10, 1, 30)).toBeCloseTo(30, 5);
  });

  it('is at the negative extreme exactly one beat later', () => {
    expect(pendulumAngle(11, 10, 1, 30)).toBeCloseTo(-30, 5);
  });

  it('is back at the positive extreme two beats later', () => {
    expect(pendulumAngle(12, 10, 1, 30)).toBeCloseTo(30, 5);
  });

  it('crosses zero halfway between two beats', () => {
    expect(pendulumAngle(10.5, 10, 1, 30)).toBeCloseTo(0, 5);
  });

  it('scales with tempo (secPerBeat)', () => {
    // À un tempo deux fois plus rapide (secPerBeat divisé par deux), le
    // pendule atteint l'extrémité négative deux fois plus vite : ici après
    // 0,5 s au lieu d'1 s.
    expect(pendulumAngle(10.5, 10, 0.5, 30)).toBeCloseTo(-30, 5);
  });
});
