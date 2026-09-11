import type { PitchName } from '../../solfege/music';
import { PITCH_ORDER } from '../../solfege/music';
import type { PlayerId, Result } from '../types';

// 6 paires (12 cartes), pas les 7 hauteurs disponibles : sur iPhone, le
// plateau de jeu est contraint dans un carré (shell/GameScreen.tsx) — 12
// cartes tiennent en 4×3 à une taille de cible confortable (~80 px), 14
// tomberait sous la cible tactile minimale sur cet écran. Les 6 hauteurs du
// tour sont tirées parmi les 7 (voir pickPitches), pas toujours les mêmes :
// sur plusieurs parties, un enfant croise quand même les sept noms.
export const PAIR_COUNT = 6;

export type Phase = 'playing' | 'gameover';

export interface NoteMemoryState {
  seed: number;
  // De 1 (solo, à score) à 4 (en famille, à tour de rôle) — voir
  // GameMeta.minPlayers/maxPlayers dans index.ts.
  players: PlayerId[];
  turnIndex: number;
  // Niveau choisi via GameMeta.soloLevels (createState, 3ᵉ paramètre) :
  // quelle aide est affichée par Board.tsx, jamais lu par logic.ts lui-même
  // (la difficulté ne change aucune règle, seulement ce qui est montré).
  level: number;
  cards: PitchName[];
  matched: boolean[];
  // 0, 1 ou 2 index de cartes actuellement retournées et non encore
  // appariées — 2 seulement le temps que Board.tsx laisse voir un
  // dépareillage avant d'envoyer 'resolveMismatch' (délai de présentation,
  // jamais dans logic.ts, CLAUDE.md règle 2).
  revealed: number[];
  scores: Record<PlayerId, number>;
  // Nombre de fois où deux cartes ont été comparées (paire trouvée ou non) —
  // sert au score d'efficacité en solo (getResult).
  attempts: number;
  phase: Phase;
}

export type NoteMemoryMove = { type: 'flip'; card: number } | { type: 'resolveMismatch' };

const DEFAULT_LEVEL = 1;

// mulberry32 : PRNG seedé (CLAUDE.md, règle 3), même générateur que
// connect4/tictactoe/sound-memory (chacun sa copie, patron établi).
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function createState(players: PlayerId[], seed: number, options?: { level?: number }): NoteMemoryState {
  const random = mulberry32(seed);
  const pitches = shuffle(PITCH_ORDER, random).slice(0, PAIR_COUNT);
  const cards = shuffle(pitches.flatMap((pitch) => [pitch, pitch]), random);
  const scores = Object.fromEntries(players.map((p) => [p, 0]));
  return {
    seed,
    players,
    turnIndex: 0,
    level: options?.level ?? DEFAULT_LEVEL,
    cards,
    matched: cards.map(() => false),
    revealed: [],
    scores,
    attempts: 0,
    phase: 'playing',
  };
}

export function isValidMove(state: NoteMemoryState, move: NoteMemoryMove): boolean {
  if (state.phase !== 'playing') return false;
  switch (move.type) {
    case 'flip':
      return (
        move.card >= 0 &&
        move.card < state.cards.length &&
        !state.matched[move.card] &&
        !state.revealed.includes(move.card) &&
        state.revealed.length < 2
      );
    case 'resolveMismatch':
      // revealed n'atteint jamais 2 pour une paire trouvée (le 2ᵉ flip la
      // vide aussitôt, voir applyMove) : ce move n'est donc valide que pour
      // un vrai dépareillage en attente.
      return state.revealed.length === 2;
  }
}

export function applyMove(state: NoteMemoryState, move: NoteMemoryMove): NoteMemoryState {
  switch (move.type) {
    case 'flip': {
      const revealed = [...state.revealed, move.card];
      if (revealed.length < 2) return { ...state, revealed };

      const [a, b] = revealed;
      const attempts = state.attempts + 1;
      if (state.cards[a] !== state.cards[b]) {
        return { ...state, revealed, attempts };
      }
      const matched = state.matched.slice();
      matched[a] = true;
      matched[b] = true;
      const current = state.players[state.turnIndex];
      const scores = { ...state.scores, [current]: state.scores[current] + 1 };
      const allMatched = matched.every(Boolean);
      // Paire trouvée : le même joueur rejoue (règle classique du memory),
      // turnIndex inchangé.
      return { ...state, matched, revealed: [], scores, attempts, phase: allMatched ? 'gameover' : 'playing' };
    }
    case 'resolveMismatch': {
      const turnIndex = (state.turnIndex + 1) % state.players.length;
      return { ...state, revealed: [], turnIndex };
    }
  }
}

export function currentPlayer(state: NoteMemoryState): PlayerId | null {
  return state.phase === 'gameover' ? null : state.players[state.turnIndex];
}

export function getResult(state: NoteMemoryState): Result | null {
  if (state.phase !== 'gameover') return null;

  if (state.players.length === 1) {
    // Solo : score d'efficacité (paires trouvées pour le nombre de tentatives
    // faites), pas un décompte brut de tentatives — value doit augmenter
    // avec une meilleure partie pour que storage/index.ts (recordScore,
    // comparaison sur value) retienne le bon record. maxValue fixé à 100
    // (comme rhythm-tap) : le pourcentage est déjà calculé ici, ResultScreen
    // n'a plus qu'à l'afficher.
    const efficiency = Math.round((PAIR_COUNT / state.attempts) * 100);
    return {
      kind: 'win',
      winner: state.players[0],
      score: { value: Math.min(100, efficiency), variant: `level-${state.level}`, maxValue: 100 },
    };
  }

  const best = Math.max(...state.players.map((p) => state.scores[p]));
  const leaders = state.players.filter((p) => state.scores[p] === best);
  if (leaders.length > 1) return { kind: 'draw' };
  return { kind: 'win', winner: leaders[0] };
}
