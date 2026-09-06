import { zzfx, zzfxUnlock } from '../vendor/zzfx';
import { getSettings, updateSettings } from '../storage';

export type SoundName = 'move' | 'invalid' | 'turn' | 'win' | 'draw' | 'tap';

// [volume, randomness, frequency, attack, sustain, release, shape, shapeCurve,
//  slide, deltaSlide, pitchJump, pitchJumpTime]
// Sons courts et ronds : ils vont être entendus des centaines de fois dans un
// salon. shape 0 = sinus, 1 = triangle, 2 = dent de scie.
const SOUNDS: Record<SoundName, Parameters<typeof zzfx>> = {
  tap: [0.35, 0.02, 340, 0, 0.02, 0.05],
  move: [0.5, 0.03, 220, 0.01, 0.03, 0.08, 1],
  invalid: [0.35, 0.03, 150, 0, 0.05, 0.08, 0, 1, -0.03],
  turn: [0.3, 0.02, 520, 0, 0.015, 0.04],
  win: [0.5, 0.02, 440, 0.02, 0.1, 0.15, 1, 1, 0.02, 0, 200, 0.05],
  draw: [0.4, 0.02, 300, 0.01, 0.08, 0.12, 2, 1, -0.01],
};

// Lu une seule fois au chargement, mis à jour uniquement par setSoundEnabled —
// évite de relire et reparser le stockage à chaque tap.
let soundEnabled = getSettings().soundEnabled;

export function isSoundEnabled(): boolean {
  return soundEnabled;
}

export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled;
  updateSettings({ soundEnabled: enabled });
}

// play() est le seul point d'entrée et débloque l'AudioContext au passage.
// Comme play() n'est jamais appelée hors d'un gestionnaire de tap, le premier
// appel réel est bien le premier tap du menu — pas besoin d'un déblocage à part.
export function play(name: SoundName): void {
  try {
    zzfxUnlock();
    if (!soundEnabled) return;
    zzfx(...SOUNDS[name]);
  } catch {
    // Un contexte audio indisponible rend l'app silencieuse, jamais cassée.
  }
}
