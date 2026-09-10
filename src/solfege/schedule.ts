// Calcul pur des instants d'une mélodie, et ordonnanceur générique à
// lookahead — pas de React, pas de DOM, pas d'AudioContext ici (CLAUDE.md,
// règle 2 étendue au socle musical). Le moteur réel (`solfege/audio.ts`)
// branche ces deux briques sur `getAudioContext()` ; les tests les exercent
// avec une horloge simulée (un simple nombre), sans navigateur.
import type { Melody } from './music';
import { noteToFrequency } from './music';

export interface ScheduledNote {
  // Instant absolu, dans la même base que l'horloge fournie — pour le
  // moteur réel, `AudioContext.currentTime` ; pour un test, un nombre de
  // secondes simulé.
  time: number;
  freq: number | null; // null = silence (la note occupe son temps, sans son)
  durationSec: number;
}

// Convertit une mélodie (notes en temps) en instants absolus, à partir d'un
// tempo et d'un instant de départ — pure, testable sans navigateur (critère
// 6 : « instants programmés d'une mélodie... à partir d'une horloge
// simulée »). La conversion temps → secondes n'a lieu qu'ici, jamais stockée
// ailleurs (music.ts ne connaît que des temps).
export function scheduleMelody(melody: Melody, tempoBpm: number, startTime: number): ScheduledNote[] {
  const secPerBeat = 60 / tempoBpm;
  let cursor = startTime;
  const events: ScheduledNote[] = [];
  for (const note of melody) {
    const durationSec = note.beats * secPerBeat;
    events.push({
      time: cursor,
      freq: note.pitch === null ? null : noteToFrequency(note.pitch),
      durationSec,
    });
    cursor += durationSec;
  }
  return events;
}

// Grille de pulsation nue (un instant par temps, sans hauteur) — utilisée par
// la calibration (le clic régulier) et par le repère visuel du jeu de rythme,
// indépendamment des notes réelles d'une mélodie.
export function scheduleBeats(beatCount: number, tempoBpm: number, startTime: number): number[] {
  const secPerBeat = 60 / tempoBpm;
  return Array.from({ length: beatCount }, (_, i) => startTime + i * secPerBeat);
}

export interface Clock {
  now(): number;
}

export interface LookaheadSchedulerOptions {
  clock: Clock;
  // Fenêtre de programmation à l'avance, en secondes (spec 05 : 100 ms).
  scheduleAheadSec: number;
  onEvent(event: ScheduledNote, index: number): void;
  onDone?(): void;
}

// Ordonnanceur générique à lookahead : un `tick()` léger, réveillé par un
// timer (25 ms dans le moteur réel), programme en absolu tout événement qui
// tombe dans les `scheduleAheadSec` à venir — jamais un son déclenché
// directement par le timer lui-même (critère 4). Générique sur `clock` et
// `onEvent` pour rester testable sans AudioContext : le moteur réel
// (`solfege/audio.ts`) y branche `getAudioContext().currentTime` et de vrais
// oscillateurs, un test y branche un compteur et une liste.
export class LookaheadScheduler {
  private cursor = 0;
  private done = false;

  constructor(
    private readonly events: ScheduledNote[],
    private readonly options: LookaheadSchedulerOptions,
  ) {}

  tick(): void {
    if (this.done) return;
    const horizon = this.options.clock.now() + this.options.scheduleAheadSec;
    while (this.cursor < this.events.length && this.events[this.cursor].time < horizon) {
      this.options.onEvent(this.events[this.cursor], this.cursor);
      this.cursor++;
    }
    if (this.cursor >= this.events.length) {
      const last = this.events[this.events.length - 1];
      const endTime = last ? last.time + last.durationSec : this.options.clock.now();
      if (this.options.clock.now() >= endTime) {
        this.done = true;
        this.options.onDone?.();
      }
    }
  }

  isDone(): boolean {
    return this.done;
  }
}
