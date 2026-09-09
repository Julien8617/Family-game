import type { PlayerId, Result } from '../types';

export type PadCount = 2 | 4 | 6 | 8;
export const PAD_COUNTS: PadCount[] = [2, 4, 6, 8];

export type Phase = 'setup' | 'showing' | 'input' | 'gameover';

export interface SoundMemoryState {
  seed: number;
  player: PlayerId;
  // Durée d'un pad pendant la lecture de la séquence, dérivée du niveau
  // choisi via GameMeta.soloLevels (createState, 3ᵉ paramètre) — fixée pour
  // toute la partie, comme le seed.
  rhythmMs: number;
  phase: Phase;
  padCount: PadCount | null;
  sequence: number[];
  // Nombre de taps corrects déjà reçus pour la manche en cours (repart à 0 à
  // chaque nouvelle manche, jamais réinitialisé au sein d'une manche).
  progress: number;
  // Manches réussies — c'est aussi la valeur du score final rapportée par
  // getResult, indépendamment de la manche ratée qui termine la partie.
  score: number;
  // Dernier pad tapé (correct ou non), pour que Board.tsx puisse surligner
  // le pad fautif en phase 'gameover' — même patron que Connect4State.lastMove.
  lastTap: number | null;
}

export type SoundMemoryMove =
  | { type: 'setPadCount'; count: PadCount }
  | { type: 'sequenceShown' }
  | { type: 'tap'; pad: number };

// mulberry32 : PRNG seedé (CLAUDE.md, règle 3), même générateur que
// connect4/tictactoe. Jamais Math.random().
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Niveaux de rythme (GameMeta.soloLevels) : durée d'un pad pendant la lecture
// de la séquence, en ms — plus le niveau est élevé, plus c'est court. Id 2
// (« Normal ») par défaut si createState est appelé sans options (ex. tests).
const RHYTHM_MS: Record<number, number> = { 1: 900, 2: 650, 3: 480, 4: 340 };
const DEFAULT_LEVEL = 2;

// Un pad de plus, tiré à partir du seed de la partie et du numéro de la
// manche qui commence (state.sequence.length *avant* l'ajout) — déterministe,
// comme l'exige applyMove.
function nextPad(seed: number, round: number, padCount: number): number {
  const random = mulberry32((seed ^ (round * 0x9e3779b9)) >>> 0);
  return Math.floor(random() * padCount);
}

export function createState(players: PlayerId[], seed: number, options?: { level?: number }): SoundMemoryState {
  const level = options?.level ?? DEFAULT_LEVEL;
  return {
    seed,
    player: players[0],
    rhythmMs: RHYTHM_MS[level] ?? RHYTHM_MS[DEFAULT_LEVEL],
    phase: 'setup',
    padCount: null,
    sequence: [],
    progress: 0,
    score: 0,
    lastTap: null,
  };
}

export function isValidMove(state: SoundMemoryState, move: SoundMemoryMove): boolean {
  switch (move.type) {
    case 'setPadCount':
      return state.phase === 'setup' && PAD_COUNTS.includes(move.count);
    case 'sequenceShown':
      return state.phase === 'showing';
    case 'tap':
      return state.phase === 'input' && move.pad >= 0 && move.pad < (state.padCount ?? 0);
  }
}

export function applyMove(state: SoundMemoryState, move: SoundMemoryMove): SoundMemoryState {
  switch (move.type) {
    case 'setPadCount': {
      const sequence = [nextPad(state.seed, 0, move.count)];
      return { ...state, padCount: move.count, phase: 'showing', sequence, progress: 0, score: 0 };
    }
    case 'sequenceShown':
      return { ...state, phase: 'input', progress: 0 };
    case 'tap': {
      const expected = state.sequence[state.progress];
      if (move.pad !== expected) {
        return { ...state, phase: 'gameover', lastTap: move.pad };
      }
      if (state.progress + 1 < state.sequence.length) {
        return { ...state, progress: state.progress + 1, lastTap: move.pad };
      }
      // Manche réussie : une case de plus, tirée pour la manche qui commence
      // (state.sequence.length avant l'ajout, même convention que le premier
      // pad posé par setPadCount).
      const grownSequence = [...state.sequence, nextPad(state.seed, state.sequence.length, state.padCount!)];
      return {
        ...state,
        score: state.score + 1,
        progress: 0,
        phase: 'showing',
        sequence: grownSequence,
        lastTap: move.pad,
      };
    }
  }
}

export function currentPlayer(state: SoundMemoryState): PlayerId | null {
  return state.phase === 'gameover' ? null : state.player;
}

export function getResult(state: SoundMemoryState): Result | null {
  if (state.phase !== 'gameover') return null;
  return { kind: 'win', winner: state.player, score: { value: state.score, variant: `pads-${state.padCount}` } };
}
