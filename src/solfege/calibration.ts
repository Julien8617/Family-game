// Calibration du décalage tactile de l'appareil — pure logique de calcul ici
// (testable sans navigateur), persistance via storage/index.ts uniquement
// (CLAUDE.md, conventions de code : aucun accès direct à localStorage depuis
// solfege/). C'est une propriété de l'appareil, pas du joueur.
import { getSettings, updateSettings } from '../storage';

export interface CalibrationSample {
  // Même base de temps que l'horloge audio (secondes, AudioContext.currentTime
  // dans le vrai moteur) pour les deux : l'instant où le clic était prévu, et
  // l'instant où le tap a été lu — synchrone, dans le même geste (voir
  // solfege/CalibrationScreen.tsx et rhythm-tap/Board.tsx : le biais constant
  // du gestionnaire tactile est justement ce que la calibration absorbe).
  expectedTime: number;
  actualTime: number;
}

export type CalibrationResult = { ok: true; offsetMs: number } | { ok: false };

// « Un clic régulier, huit taps. Les deux premiers sont ignorés — le temps
// de se caler. » (spec 05)
const REQUIRED_SAMPLES = 8;
const IGNORED_LEAD_IN = 2;

// Dispersion maximale tolérée (MAD des écarts, en ms) pour qu'un offset ait
// un sens exploitable — au-delà, on ne stocke rien et on repropose, sans
// jamais parler d'échec (CLAUDE.md : « pas d'échec sec »).
const MAX_DISPERSION_MS = 120;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// Médiane, pas moyenne (spec 05) : un enfant produit des valeurs
// aberrantes, une seule suffit à ruiner une moyenne.
export function computeCalibration(samples: CalibrationSample[]): CalibrationResult {
  if (samples.length < REQUIRED_SAMPLES) return { ok: false };
  const kept = samples.slice(IGNORED_LEAD_IN);
  const diffsMs = kept.map((s) => (s.actualTime - s.expectedTime) * 1000);
  const offsetMs = median(diffsMs);
  const dispersion = median(diffsMs.map((d) => Math.abs(d - offsetMs)));
  if (dispersion > MAX_DISPERSION_MS) return { ok: false };
  return { ok: true, offsetMs };
}

export function getCalibrationOffsetMs(): number | undefined {
  return getSettings().calibrationOffsetMs;
}

export function setCalibrationOffsetMs(offsetMs: number): void {
  updateSettings({ calibrationOffsetMs: offsetMs });
}

export function isCalibrated(): boolean {
  return getCalibrationOffsetMs() !== undefined;
}
