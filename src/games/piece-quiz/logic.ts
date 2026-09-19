import type { PlayerId, ProgressSignal, Result } from '../types';
import { generateLevel, tierOf, TIER_RANGES } from './generate';
import type { PieceQuizQuestion, Tier } from './generate';

export type Phase = 'question' | 'reveal' | 'tierPicker';

export interface PieceQuizState {
  seed: number;
  player: PlayerId;
  tier: Tier;
  level: number; // absolu, 1-100
  questionIndex: number; // 0-4
  // Les 5 questions du niveau en cours, générées une seule fois (au démarrage
  // du niveau) — jamais régénérées en cours de route, sinon une reprise après
  // fermeture de l'app changerait les questions déjà vues.
  questions: PieceQuizQuestion[];
  marked: number[];
  // Résultat (réussi/raté) de chaque question déjà validée dans ce niveau —
  // longueur = questionIndex + 1 une fois la question courante validée.
  answers: boolean[];
  phase: Phase;
  // Niveaux réussis par palier — c'est aussi ce qui détermine où reprendre
  // (les niveaux d'un palier se débloquent dans l'ordre) et ce qui est
  // persisté comme record par variant (storage/index.ts, un entier par
  // (jeu, joueur, variant), variant = 'easy' | 'medium' | 'hard').
  progress: Record<Tier, number>;
  // Vrai seulement quand le niveau 100 vient d'être réussi — la partie ne se
  // termine que là (ou par « Quitter », géré entièrement par le shell). Tous
  // les autres niveaux s'enchaînent en interne (voir applyMove, 'next') sans
  // jamais rendre getResult non nul.
  finished: boolean;
}

export type PieceQuizMove =
  | { type: 'toggle'; square: number }
  | { type: 'validate' }
  | { type: 'next' }
  | { type: 'openTierPicker' }
  | { type: 'startLevel'; level: number };

// Table unique des seuils et tailles de palier (spec 06 : « vivent dans une
// seule table de constantes de logic.ts, pour qu'on puisse les ajuster sans
// chercher »).
export const TIER_ORDER: Tier[] = ['easy', 'medium', 'hard'];
export const TIER_LEVELS: Record<Tier, number> = { easy: 30, medium: 40, hard: 30 };
export const UNLOCK_THRESHOLDS: Record<Exclude<Tier, 'easy'>, { requires: Tier; count: number }> = {
  medium: { requires: 'easy', count: 24 },
  hard: { requires: 'medium', count: 32 },
};
// Un niveau est réussi à 80 % ou plus, soit 4 questions sur 5.
export const REQUIRED_CORRECT = 4;
// Une petite fête tous les 10 niveaux réussis (spec 06, point 4) — jamais au
// niveau 100, qui suit le chemin de fin de partie normal (Result), pas la fête.
const CELEBRATION_INTERVAL = 10;

export function isTierUnlocked(tier: Tier, progress: Record<Tier, number>): boolean {
  if (tier === 'easy') return true;
  const rule = UNLOCK_THRESHOLDS[tier];
  return progress[rule.requires] >= rule.count;
}

// Prochain niveau à réussir dans `tier` — ou, si le palier est déjà terminé
// (tous ses niveaux réussis), son dernier niveau (permet de le refaire,
// spec : « Choisir un palier ... permet de refaire un niveau déjà réussi »).
export function resumeLevelForTier(tier: Tier, progress: Record<Tier, number>): number {
  const [start, end] = TIER_RANGES[tier];
  if (progress[tier] >= TIER_LEVELS[tier]) return end;
  return start + progress[tier];
}

// Palier et niveau de reprise à l'ouverture : le palier le plus avancé qui
// reste ouvert et inachevé parmi les paliers débloqués ; si tous les paliers
// débloqués sont terminés (cas non couvert littéralement par la spec, décidé
// ici), le dernier niveau du palier le plus avancé — permet de le rejouer
// plutôt que de bloquer sans écran.
function initialTierAndLevel(progress: Record<Tier, number>): { tier: Tier; level: number } {
  const unlocked = TIER_ORDER.filter((t) => isTierUnlocked(t, progress));
  const incomplete = unlocked.filter((t) => progress[t] < TIER_LEVELS[t]);
  const tier = incomplete.length > 0 ? incomplete[incomplete.length - 1] : unlocked[unlocked.length - 1];
  return { tier, level: resumeLevelForTier(tier, progress) };
}

function sameSet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((x) => setB.has(x));
}

function passedLevel(answers: boolean[]): boolean {
  return answers.filter(Boolean).length >= REQUIRED_CORRECT;
}

export function createState(
  players: PlayerId[],
  seed: number,
  options?: { level?: number; bestScores?: Record<string, number> },
): PieceQuizState {
  const progress: Record<Tier, number> = {
    easy: options?.bestScores?.easy ?? 0,
    medium: options?.bestScores?.medium ?? 0,
    hard: options?.bestScores?.hard ?? 0,
  };
  const { tier, level } = initialTierAndLevel(progress);
  return {
    seed,
    player: players[0],
    tier,
    level,
    questionIndex: 0,
    questions: generateLevel(seed, level),
    marked: [],
    answers: [],
    phase: 'question',
    progress,
    finished: false,
  };
}

export function isValidMove(state: PieceQuizState, move: PieceQuizMove): boolean {
  switch (move.type) {
    case 'toggle': {
      if (state.phase !== 'question') return false;
      const size = state.questions[state.questionIndex].boardSize;
      return move.square >= 0 && move.square < size * size;
    }
    case 'validate':
      return state.phase === 'question' && state.marked.length > 0;
    case 'next':
      return state.phase === 'reveal' && !state.finished;
    case 'openTierPicker':
      return state.phase === 'question';
    case 'startLevel': {
      if (state.phase !== 'tierPicker') return false;
      if (move.level < 1 || move.level > 100) return false;
      const tier = tierOf(move.level);
      if (!isTierUnlocked(tier, state.progress)) return false;
      return move.level <= resumeLevelForTier(tier, state.progress);
    }
  }
}

export function applyMove(state: PieceQuizState, move: PieceQuizMove): PieceQuizState {
  switch (move.type) {
    case 'toggle': {
      const marked = state.marked.includes(move.square)
        ? state.marked.filter((s) => s !== move.square)
        : [...state.marked, move.square];
      return { ...state, marked };
    }

    case 'validate': {
      const expected = state.questions[state.questionIndex].expectedSquares;
      const correct = sameSet(state.marked, expected);
      return { ...state, phase: 'reveal', answers: [...state.answers, correct] };
    }

    case 'next': {
      const lastIndex = state.questions.length - 1;
      if (state.questionIndex < lastIndex) {
        // Question suivante du même niveau — inchangé.
        return { ...state, questionIndex: state.questionIndex + 1, marked: [], phase: 'question' };
      }

      // Révélation de la 5ᵉ question acquittée : le niveau est décidé. Jeu
      // continu (spec 06, point 3) — jamais d'aller-retour par ResultScreen
      // ici, seul le niveau 100 réussi y mène (state.finished, voir getResult).
      const passed = passedLevel(state.answers);
      const levelWithinTier = state.level - TIER_RANGES[state.tier][0] + 1;
      const advances = passed && levelWithinTier === state.progress[state.tier] + 1;
      const progress = advances ? { ...state.progress, [state.tier]: state.progress[state.tier] + 1 } : state.progress;

      if (state.level === 100 && passed) {
        return { ...state, progress, finished: true };
      }

      const nextLevel = passed ? state.level + 1 : state.level;
      return {
        ...state,
        progress,
        tier: tierOf(nextLevel),
        level: nextLevel,
        questions: generateLevel(state.seed, nextLevel),
        questionIndex: 0,
        marked: [],
        answers: [],
        phase: 'question',
      };
    }

    case 'openTierPicker':
      return { ...state, phase: 'tierPicker' };

    case 'startLevel': {
      const tier = tierOf(move.level);
      return {
        ...state,
        tier,
        level: move.level,
        questions: generateLevel(state.seed, move.level),
        questionIndex: 0,
        marked: [],
        answers: [],
        phase: 'question',
      };
    }
  }
}

export function currentPlayer(state: PieceQuizState): PlayerId | null {
  return state.finished ? null : state.player;
}

// Résultat non nul seulement quand le niveau 100 vient d'être réussi — voir
// PieceQuizState.finished. Tous les autres niveaux s'enchaînent sans jamais
// passer par Result (jeu continu, spec 06).
export function getResult(state: PieceQuizState): Result | null {
  if (!state.finished) return null;
  return {
    kind: 'win',
    winner: state.player,
    score: { value: state.progress[state.tier], variant: state.tier, maxValue: TIER_LEVELS[state.tier] },
  };
}

// Signal de progression (spec 06, points 3-5) : appelé par le shell après
// chaque coup appliqué, avec l'état juste avant (`prev`) et juste après
// (`next`). Pure — un (prev, next) donné produit toujours le même signal.
// Ne regarde que la transition « révélation de la 5ᵉ question acquittée »
// (repérée structurellement sur `prev`, pas par un champ dédié) : c'est la
// seule sorte de coup qui peut faire avancer un score, fêter une dizaine, ou
// signaler un échec.
export function progressSignal(prev: PieceQuizState, next: PieceQuizState): ProgressSignal | null {
  const lastIndex = prev.questions.length - 1;
  if (prev.phase !== 'reveal' || prev.questionIndex !== lastIndex) return null;

  if (!passedLevel(prev.answers)) {
    return { player: prev.player, fail: true };
  }

  const signal: ProgressSignal = { player: prev.player };
  if (next.progress[prev.tier] !== prev.progress[prev.tier]) {
    signal.scores = { [prev.tier]: next.progress[prev.tier] };
  }
  // Fête à chaque dizaine réussie, y compris en rejouant un niveau déjà
  // acquis — pas seulement la première fois (décision utilisateur, voir
  // NOTES.md). Jamais au niveau 100 : il suit le chemin Result normal.
  if (prev.level % CELEBRATION_INTERVAL === 0 && prev.level !== 100) {
    signal.celebrate = { label: `Niveau ${prev.level}` };
  }

  return signal.scores || signal.celebrate ? signal : null;
}
