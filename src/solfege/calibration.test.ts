import { describe, expect, it } from 'vitest';
import { computeCalibration } from './calibration';
import type { CalibrationSample } from './calibration';

// Huit temps espacés d'une seconde (peu importe le tempo réel, seul l'écart
// actual - expected compte) ; la calibration ignore les deux premiers.
function samplesWithOffsets(offsetsMs: number[]): CalibrationSample[] {
  return offsetsMs.map((offsetMs, i) => ({ expectedTime: i, actualTime: i + offsetMs / 1000 }));
}

function expectOffsetCloseTo(offsetsMs: number[], expectedMs: number) {
  const result = computeCalibration(samplesWithOffsets(offsetsMs));
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.offsetMs).toBeCloseTo(expectedMs, 5);
}

describe('computeCalibration', () => {
  it('rejects fewer than eight taps', () => {
    const result = computeCalibration(samplesWithOffsets([0, 0, 30, 30, 30, 30, 30]));
    expect(result).toEqual({ ok: false });
  });

  it('ignores the first two taps entirely', () => {
    // Les deux premiers sont des valeurs aberrantes énormes (le temps de se
    // caler) ; si elles pesaient dans le calcul, l'offset serait faussé.
    expectOffsetCloseTo([500, -500, 40, 40, 40, 40, 40, 40], 40);
  });

  it('uses the median, robust to a single outlier among the kept taps', () => {
    // Six taps gardés (après les deux premiers ignorés) : cinq cohérents
    // autour de 50 ms, un aberrant à 400 ms. La moyenne serait tirée bien
    // au-dessus de 50 ; la médiane n'en bouge pas.
    const kept = [48, 51, 400, 49, 52, 50];
    const result = computeCalibration(samplesWithOffsets([0, 0, ...kept]));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.offsetMs).toBeGreaterThanOrEqual(48);
      expect(result.offsetMs).toBeLessThanOrEqual(52);
    }

    const mean = kept.reduce((a, b) => a + b, 0) / kept.length;
    expect(mean).toBeGreaterThan(90); // la moyenne, elle, serait ruinée par l'aberrant
  });

  it('accepts tightly consistent taps and reports their median offset', () => {
    expectOffsetCloseTo([0, 0, -20, -18, -21, -19, -20, -22], -20);
  });

  it('rejects taps too scattered to be exploitable, without ever throwing', () => {
    const result = computeCalibration(
      samplesWithOffsets([0, 0, -200, 300, -150, 250, -180, 280]),
    );
    expect(result).toEqual({ ok: false });
  });
});
