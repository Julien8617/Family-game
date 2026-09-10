// Moteur audio du socle solfège : ordonnancement par lookahead, synthèse pure
// (aucun échantillon), passage en arrière-plan géré proprement. Le calcul des
// instants (schedule.ts) et le modèle musical (music.ts) sont purs et testés
// sans navigateur ; ce fichier-ci branche ces briques sur le vrai
// AudioContext partagé (fx/audio-context.ts) — non testable sans navigateur,
// volontairement gardé aussi mince que possible pour cette raison.
import { getAudioContext, unlockAudioContext } from '../fx/audio-context';
import type { Melody } from './music';
import { LookaheadScheduler, scheduleBeats, scheduleMelody } from './schedule';
import type { ScheduledNote } from './schedule';

// Réveil de l'ordonnanceur toutes les 25 ms, qui programme tout ce qui tombe
// dans les 100 ms à venir — jamais un son déclenché par le timer lui-même
// (CLAUDE.md, spec 05 : aucun setTimeout ne joue directement un son).
const TICK_INTERVAL_MS = 25;
const SCHEDULE_AHEAD_SEC = 0.1;

// Battement d'avance avant le premier son, le temps que le contexte audio
// (tout juste débloqué) ait vraiment démarré — sans ça, le tout premier son
// peut être avalé (critère 7). Même intention que LEAD_IN_MS dans
// sound-memory/Board.tsx, en secondes ici (horloge audio, pas un timer DOM).
const LEAD_IN_SEC = 0.4;

const NOTE_ATTACK_SEC = 0.01;
const NOTE_RELEASE_TAIL_SEC = 0.05;

function playOscillatorNote(ctx: AudioContext, freq: number, time: number, durationSec: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  const peak = Math.min(0.5, durationSec * 2); // évite un clic sur une note très courte
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(peak || 0.3, time + NOTE_ATTACK_SEC);
  gain.gain.exponentialRampToValueAtTime(0.001, time + durationSec + NOTE_RELEASE_TAIL_SEC);
  osc.connect(gain).connect(ctx.destination);
  osc.start(time);
  osc.stop(time + durationSec + NOTE_RELEASE_TAIL_SEC + 0.02);
}

export interface PlaybackHandle {
  // Instant absolu (AudioContext.currentTime) du tout premier temps — pour
  // qu'un appelant (rhythm-tap/Board.tsx) puisse convertir un tap en position
  // musicale : (ctx.currentTime - startTime) / secPerBeat.
  startTime: number;
  secPerBeat: number;
  stop(): void;
}

// Joue une mélodie du début à la fin, en lookahead — jamais par setTimeout
// direct. `onDone` est appelé une fois la dernière note terminée ;
// `onInterrupted` si la lecture est coupée par un passage en arrière-plan
// (critère 8 : la manche en cours s'arrête proprement plutôt que de dériver).
// `startAt` optionnel : instant absolu (AudioContext.currentTime) auquel
// poser le premier temps — pour enchaîner sans coupure après un compte à
// rebours (voir rhythm-tap/Board.tsx), qui calcule la case suivante de sa
// propre grille plutôt que de laisser ce module reposer un LEAD_IN_SEC qui
// romprait le rythme. Omis (cas normal, premier son de l'écran) : calculé
// ici même, comme avant.
export function playMelody(
  melody: Melody,
  tempoBpm: number,
  onDone: () => void,
  onInterrupted: () => void,
  startAt?: number,
): PlaybackHandle {
  unlockAudioContext();
  const ctx = getAudioContext();
  const secPerBeat = 60 / tempoBpm;
  const startTime = startAt ?? ctx.currentTime + LEAD_IN_SEC;
  const events = scheduleMelody(melody, tempoBpm, startTime);

  const scheduler = new LookaheadScheduler(events, {
    clock: { now: () => ctx.currentTime },
    scheduleAheadSec: SCHEDULE_AHEAD_SEC,
    onEvent: (event: ScheduledNote) => {
      if (event.freq !== null) playOscillatorNote(ctx, event.freq, event.time, event.durationSec);
    },
    // Auto-arrêt à la fin naturelle de la lecture — sans ça, le timer de
    // l'ordonnanceur et l'écouteur visibilitychange restent posés
    // indéfiniment (inoffensif pour tick(), qui devient un no-op, mais une
    // fuite tant que rien n'appelle stop()). Le Board appelant les nettoie
    // aussi à son démontage/changement de phase, mais ce module ne doit pas
    // en dépendre pour rester correct par lui-même.
    onDone: () => {
      stop();
      onDone();
    },
  });

  const timer = setInterval(() => scheduler.tick(), TICK_INTERVAL_MS);
  scheduler.tick(); // premier passage immédiat, sans attendre le premier réveil du timer

  function handleVisibilityChange() {
    if (document.visibilityState === 'hidden') {
      stop();
      onInterrupted();
    }
  }
  document.addEventListener('visibilitychange', handleVisibilityChange);

  function stop() {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  }

  return { startTime, secPerBeat, stop };
}

// Grille de pulsation nue (sans notes), pour le clic de calibration et les
// comptes à rebours (« count-in ») — même moteur de lookahead, un simple bip
// court à chaque temps. `onInterrupted` optionnel (défaut : silencieux) pour
// les appelants qui n'ont rien de spécial à faire sur un passage en
// arrière-plan au-delà de l'arrêt déjà automatique. `startAt` optionnel :
// même rôle que dans playMelody — enchaîner sur la grille d'un compte à
// rebours précédent plutôt que de reposer un LEAD_IN_SEC (voir
// CalibrationScreen.tsx, compte à rebours → mesure).
export function playClickTrack(
  beatCount: number,
  tempoBpm: number,
  onBeat: (beatIndex: number, time: number) => void,
  onDone: () => void,
  onInterrupted: () => void = () => {},
  startAt?: number,
): PlaybackHandle {
  unlockAudioContext();
  const ctx = getAudioContext();
  const secPerBeat = 60 / tempoBpm;
  const startTime = startAt ?? ctx.currentTime + LEAD_IN_SEC;
  const beatTimes = scheduleBeats(beatCount, tempoBpm, startTime);
  const events: ScheduledNote[] = beatTimes.map((time) => ({ time, freq: 880, durationSec: 0.06 }));

  const scheduler = new LookaheadScheduler(events, {
    clock: { now: () => ctx.currentTime },
    scheduleAheadSec: SCHEDULE_AHEAD_SEC,
    onEvent: (event, index) => {
      playOscillatorNote(ctx, event.freq!, event.time, event.durationSec);
      onBeat(index, event.time);
    },
    onDone: () => {
      stop();
      onDone();
    },
  });

  const timer = setInterval(() => scheduler.tick(), TICK_INTERVAL_MS);
  scheduler.tick();

  function handleVisibilityChange() {
    if (document.visibilityState === 'hidden') {
      stop();
      onInterrupted();
    }
  }
  document.addEventListener('visibilitychange', handleVisibilityChange);

  function stop() {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  }

  return { startTime, secPerBeat, stop };
}

// Lecture synchrone de l'horloge audio partagée, au moment précis d'un tap —
// jamais performance.now() (voir solfege/calibration.ts : le biais constant
// du gestionnaire tactile est absorbé par la calibration, pas contourné).
export function audioNow(): number {
  return getAudioContext().currentTime;
}
