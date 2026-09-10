import { describe, expect, it } from 'vitest';
import { beatXPercent } from './scrollPosition';

describe('beatXPercent', () => {
  it('sits at the far right edge when it just enters the lookahead window', () => {
    expect(beatXPercent(0, 4, 14, 4)).toBeCloseTo(100, 5);
  });

  it('sits exactly on the hit line at its scheduled instant', () => {
    expect(beatXPercent(4, 4, 14, 4)).toBeCloseTo(14, 5);
  });

  it('is halfway across at the midpoint of the window', () => {
    expect(beatXPercent(2, 4, 14, 4)).toBeCloseTo(57, 5); // 14 + 0.5 * (100-14)
  });

  it('keeps moving left past the hit line once its instant has passed', () => {
    const atHitLine = beatXPercent(4, 4, 14, 4);
    const afterHitLine = beatXPercent(5, 4, 14, 4);
    expect(afterHitLine).toBeLessThan(atHitLine);
  });
});
