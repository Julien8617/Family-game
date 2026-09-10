// Pur, testé, sans React ni DOM (CLAUDE.md, règle 2 ; ARCHITECTURE.md §4,
// invariant 5). Ne lit ni l'horloge ni Math.random() directement — le Board
// convertit chaque tap en une position musicale (`atBeat`) déjà corrigée de
// l'offset de calibration avant d'appeler onMove ; logic.ts ne fait que la
// classer contre la grille attendue.
import type { PlayerId, Result } from '../types';
import { MELODIES, melodyLengthInBeats } from '../../solfege/music';

export type Phase = 'ready' | 'playing' | 'done';

export interface RhythmTapState {
  seed: number;
  player: PlayerId;
  // Dérivés du niveau choisi via GameMeta.soloLevels (createState, 3ᵉ
  // paramètre) et du seed — fixés pour toute la partie.
  tempoBpm: number;
  tempoLevel: number;
  melodyId: string;
  totalBeats: number;
  // Un temps par élément : true une fois « bien » tapé (compte pour le
  // score). Un second tap sur un temps déjà réclamé ne le réclame pas deux
  // fois — voir applyMove, case 'tap'.
  claimedBeats: boolean[];
  // Retour visuel du tout dernier tap, pour que Board.tsx distingue « bien »
  // de « en avance »/« en retard » sans jamais afficher d'erreur — même
  // patron que SoundMemoryState.lastTap.
  lastTapResult: 'early' | 'good' | 'late' | null;
  // Incrémenté à chaque 'tap' reçu, quelle que soit sa classification — sert
  // de repère à Board.tsx pour rejouer le flash visuel même quand deux taps
  // de suite ont le même lastTapResult (une valeur inchangée ne redéclenche
  // pas un effet React).
  tapCount: number;
  phase: Phase;
}

export type RhythmTapMove =
  | { type: 'start' }
  | { type: 'tap'; atBeat: number }
  | { type: 'melodyDone' }
  // Passage en arrière-plan (spec 05, critère 8) : Board relance ce move
  // plutôt que de corriger l'état localement — reprendre au début de la
  // manche reste une transition pure de l'état du jeu, jamais un flag de
  // rendu qui pourrait diverger de state.phase.
  | { type: 'restart' };

// mulberry32 : même PRNG seedé que les autres jeux (CLAUDE.md, règle 3).
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Niveaux de tempo (GameMeta.soloLevels), du plus lent au plus rapide — même
// principe que sound-memory/logic.ts (RHYTHM_MS), en battements par minute
// plutôt qu'en durée de pad. Id 2 par défaut si createState est appelé sans
// options (ex. tests).
const TEMPO_BPM: Record<number, number> = { 1: 70, 2: 100, 3: 130, 4: 160 };
const DEFAULT_LEVEL = 2;

// Tolérance fixe, en fraction de temps — pas un paramètre par niveau : parce
// qu'elle est exprimée en temps (pas en millisecondes), elle devient
// mécaniquement plus stricte en temps réel à mesure que le tempo augmente
// (« généreuse, et resserrée avec le niveau », spec 05) sans qu'il soit
// nécessaire de la faire varier explicitement.
const GOOD_TOLERANCE_BEATS = 0.22;

export function createState(players: PlayerId[], seed: number, options?: { level?: number }): RhythmTapState {
  const level = options?.level ?? DEFAULT_LEVEL;
  const random = mulberry32(seed);
  const entry = MELODIES[Math.floor(random() * MELODIES.length)];
  const totalBeats = Math.max(1, Math.round(melodyLengthInBeats(entry.melody)));
  return {
    seed,
    player: players[0],
    tempoBpm: TEMPO_BPM[level] ?? TEMPO_BPM[DEFAULT_LEVEL],
    tempoLevel: level,
    melodyId: entry.id,
    totalBeats,
    claimedBeats: Array(totalBeats).fill(false),
    lastTapResult: null,
    tapCount: 0,
    phase: 'ready',
  };
}

export function isValidMove(state: RhythmTapState, move: RhythmTapMove): boolean {
  switch (move.type) {
    case 'start':
      return state.phase === 'ready';
    case 'tap':
      return state.phase === 'playing' && Number.isFinite(move.atBeat);
    case 'melodyDone':
      return state.phase === 'playing';
    case 'restart':
      return state.phase === 'playing';
  }
}

export function applyMove(state: RhythmTapState, move: RhythmTapMove): RhythmTapState {
  switch (move.type) {
    case 'start':
      return { ...state, phase: 'playing' };
    case 'tap': {
      const nearest = Math.min(state.totalBeats - 1, Math.max(0, Math.round(move.atBeat)));
      const deviation = move.atBeat - nearest;
      const isGood = Math.abs(deviation) <= GOOD_TOLERANCE_BEATS;
      const alreadyClaimed = state.claimedBeats[nearest];
      const claimedBeats =
        isGood && !alreadyClaimed
          ? state.claimedBeats.map((claimed, i) => (i === nearest ? true : claimed))
          : state.claimedBeats;
      const lastTapResult: RhythmTapState['lastTapResult'] = isGood ? 'good' : deviation < 0 ? 'early' : 'late';
      return { ...state, claimedBeats, lastTapResult, tapCount: state.tapCount + 1 };
    }
    case 'melodyDone':
      return { ...state, phase: 'done' };
    case 'restart':
      return {
        ...state,
        phase: 'ready',
        claimedBeats: state.claimedBeats.map(() => false),
        lastTapResult: null,
        tapCount: 0,
      };
  }
}

export function currentPlayer(state: RhythmTapState): PlayerId | null {
  return state.phase === 'done' ? null : state.player;
}

export function getResult(state: RhythmTapState): Result | null {
  if (state.phase !== 'done') return null;
  const score = state.claimedBeats.filter(Boolean).length;
  // variant inclut la mélodie, pas seulement le tempo : deux mélodies n'ont
  // pas le même nombre de temps, donc pas le même score maximal possible —
  // les mélanger sous un seul `tempo-N` aurait rendu le palmarès trompeur
  // (voir NOTES.md, « Mémoire sonore ajoutée » pour la même logique avec
  // pads-N).
  return {
    kind: 'win',
    winner: state.player,
    score: { value: score, variant: `tempo${state.tempoLevel}-${state.melodyId}` },
  };
}
