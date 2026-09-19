import { describe, expect, it } from 'vitest';
import {
  applyMove,
  createState,
  currentPlayer,
  getResult,
  isTierUnlocked,
  isValidMove,
  progressSignal,
  resumeLevelForTier,
} from './logic';
import type { PieceQuizMove, PieceQuizState } from './logic';
import type { PieceQuizQuestion } from './generate';

const PLAYER = 'p1';

function wrongSquare(q: PieceQuizQuestion): number {
  const total = q.boardSize * q.boardSize;
  for (let sq = 0; sq < total; sq++) {
    if (!q.expectedSquares.includes(sq)) return sq;
  }
  throw new Error('aucune case fausse disponible (position dégénérée)');
}

function answerCurrentQuestion(state: PieceQuizState, correct: boolean): PieceQuizState {
  const question = state.questions[state.questionIndex];
  const squares = correct ? question.expectedSquares : [wrongSquare(question)];
  let s = state;
  for (const sq of squares) {
    s = applyMove(s, { type: 'toggle', square: sq });
  }
  return applyMove(s, { type: 'validate' });
}

// Joue un niveau complet (5 questions) selon un patron de réussite, jusqu'à
// et y compris le 'next' qui suit la révélation de la 5ᵉ — c'est ce coup-là
// qui décide et transitionne (niveau suivant / redémarre / fin de partie),
// jeu continu oblige (spec 06, point 3).
function playLevel(state: PieceQuizState, pattern: boolean[]): PieceQuizState {
  let s = state;
  for (const correct of pattern) {
    s = answerCurrentQuestion(s, correct);
    s = applyMove(s, { type: 'next' });
  }
  return s;
}

// Comme playLevel, mais renvoie aussi le ProgressSignal de la transition de
// fin de niveau (le seul coup qui peut en produire un non nul).
function playLevelWithSignal(state: PieceQuizState, pattern: boolean[]) {
  let s = state;
  for (let i = 0; i < pattern.length; i++) {
    s = answerCurrentQuestion(s, pattern[i]);
    const prev = s;
    s = applyMove(s, { type: 'next' });
    if (i === pattern.length - 1) {
      return { state: s, signal: progressSignal(prev, s) };
    }
  }
  throw new Error('unreachable');
}

describe('createState — reprise de la progression', () => {
  it('aucune progression : palier Facile, niveau 1', () => {
    const state = createState([PLAYER], 1);
    expect(state.tier).toBe('easy');
    expect(state.level).toBe(1);
    expect(state.questions).toHaveLength(5);
    expect(state.phase).toBe('question');
    expect(state.finished).toBe(false);
  });

  it('Facile à 23/30 : Moyen encore verrouillé, reprend au niveau 24', () => {
    const state = createState([PLAYER], 1, { bestScores: { easy: 23 } });
    expect(state.tier).toBe('easy');
    expect(state.level).toBe(24);
  });

  it('Facile à 24/30 : Moyen débloqué, reprend au niveau 31', () => {
    const state = createState([PLAYER], 1, { bestScores: { easy: 24 } });
    expect(state.tier).toBe('medium');
    expect(state.level).toBe(31);
  });

  it('Facile terminé (30/30), Moyen entamé : reprend en Moyen', () => {
    const state = createState([PLAYER], 1, { bestScores: { easy: 30, medium: 5 } });
    expect(state.tier).toBe('medium');
    expect(state.level).toBe(36);
  });

  it('Moyen à 31/40 : Difficile encore verrouillé', () => {
    const state = createState([PLAYER], 1, { bestScores: { easy: 30, medium: 31 } });
    expect(state.tier).toBe('medium');
    expect(state.level).toBe(62);
  });

  it('Moyen à 32/40 : Difficile débloqué, reprend au niveau 71', () => {
    const state = createState([PLAYER], 1, { bestScores: { easy: 30, medium: 32 } });
    expect(state.tier).toBe('hard');
    expect(state.level).toBe(71);
  });

  it('tous les paliers débloqués terminés : reprend le dernier niveau du palier le plus avancé', () => {
    const state = createState([PLAYER], 1, { bestScores: { easy: 30, medium: 40, hard: 30 } });
    expect(state.tier).toBe('hard');
    expect(state.level).toBe(100);
  });
});

describe('isTierUnlocked / resumeLevelForTier', () => {
  it('Moyen verrouillé à 23, débloqué à 24', () => {
    expect(isTierUnlocked('medium', { easy: 23, medium: 0, hard: 0 })).toBe(false);
    expect(isTierUnlocked('medium', { easy: 24, medium: 0, hard: 0 })).toBe(true);
  });

  it('Difficile verrouillé à 31, débloqué à 32', () => {
    expect(isTierUnlocked('hard', { easy: 30, medium: 31, hard: 0 })).toBe(false);
    expect(isTierUnlocked('hard', { easy: 30, medium: 32, hard: 0 })).toBe(true);
  });

  it('un palier terminé propose de refaire son dernier niveau', () => {
    expect(resumeLevelForTier('easy', { easy: 30, medium: 0, hard: 0 })).toBe(30);
    expect(resumeLevelForTier('easy', { easy: 12, medium: 0, hard: 0 })).toBe(13);
  });
});

describe('déroulé d\'une question', () => {
  it('toggle marque et démarque, validate exige au moins une case', () => {
    const state = createState([PLAYER], 1);
    const sq = state.questions[0].expectedSquares[0];
    expect(isValidMove(state, { type: 'validate' })).toBe(false);

    const marked = applyMove(state, { type: 'toggle', square: sq });
    expect(marked.marked).toEqual([sq]);
    const unmarked = applyMove(marked, { type: 'toggle', square: sq });
    expect(unmarked.marked).toEqual([]);
  });

  it('validate exact -> réussi ; case en trop ou manquante -> raté', () => {
    const state = createState([PLAYER], 1);
    const question = state.questions[0];

    const exact = answerCurrentQuestion(state, true);
    expect(exact.answers).toEqual([true]);
    expect(exact.phase).toBe('reveal');

    const wrong = applyMove(state, { type: 'toggle', square: wrongSquare(question) });
    const revealedWrong = applyMove(wrong, { type: 'validate' });
    expect(revealedWrong.answers).toEqual([false]);
  });

  it('next fait avancer à la question suivante et vide les cases marquées', () => {
    const state = createState([PLAYER], 1);
    const revealed = answerCurrentQuestion(state, true);
    expect(isValidMove(revealed, { type: 'next' })).toBe(true);
    const next = applyMove(revealed, { type: 'next' });
    expect(next.questionIndex).toBe(1);
    expect(next.marked).toEqual([]);
    expect(next.phase).toBe('question');
  });
});

describe('jeu continu (spec 06, point 3)', () => {
  it("'next' reste valide sur la révélation de la 5ᵉ question, et getResult reste nul (sauf niveau 100)", () => {
    const state = createState([PLAYER], 1);
    let s = state;
    for (let i = 0; i < 4; i++) {
      s = answerCurrentQuestion(s, true);
      expect(getResult(s)).toBeNull();
      s = applyMove(s, { type: 'next' });
    }
    const lastRevealed = answerCurrentQuestion(s, true);
    expect(isValidMove(lastRevealed, { type: 'next' })).toBe(true);
    const after = applyMove(lastRevealed, { type: 'next' });
    // Niveau 1 réussi -> enchaîne directement sur le niveau 2, jamais de Result.
    expect(getResult(after)).toBeNull();
    expect(after.level).toBe(2);
    expect(after.phase).toBe('question');
    expect(currentPlayer(after)).toBe(PLAYER);
  });

  it('un niveau réussi (>= 4/5) enchaîne directement sur le suivant, sans écran intermédiaire', () => {
    const state = createState([PLAYER], 1);
    const after = playLevel(state, [true, true, true, true, false]);
    expect(after.level).toBe(2);
    expect(after.tier).toBe('easy');
    expect(after.questionIndex).toBe(0);
    expect(after.answers).toEqual([]);
    expect(after.progress.easy).toBe(1);
  });

  it('un niveau raté (< 4/5) recommence directement à sa première question, même niveau', () => {
    const state = createState([PLAYER], 1);
    const after = playLevel(state, [true, true, true, false, false]);
    expect(after.level).toBe(1);
    expect(after.questionIndex).toBe(0);
    expect(after.answers).toEqual([]);
    expect(after.marked).toEqual([]);
    expect(after.progress.easy).toBe(0);
  });

  it('franchir la frontière 30 -> 31 fait bien basculer de palier (5x5 pion -> 8x8 tour)', () => {
    // Construit directement un état "au niveau 30" plutôt que via
    // createState : à 29/30, la reprise automatique irait déjà en Moyen
    // (débloqué dès 24, plus avancé qu'Facile encore incomplet) — voir
    // "Facile terminé (30/30), Moyen entamé" plus haut. Ici on veut
    // spécifiquement observer la transition 30 -> 31 en interne.
    const base = createState([PLAYER], 1, { bestScores: { easy: 29 } });
    const state: PieceQuizState = { ...base, tier: 'easy', level: 30, progress: { ...base.progress, easy: 29 } };
    const after = playLevel(state, [true, true, true, true, true]);
    expect(after.level).toBe(31);
    expect(after.tier).toBe('medium');
    expect(after.progress.easy).toBe(30);
    expect(after.questions[0].boardSize).toBe(8);
  });

  it('rejouer un niveau déjà acquis ne fait pas reculer la progression, même en cas d\'échec', () => {
    // progress.easy = 5 : niveau 1 déjà acquis, rejoué directement.
    const base = createState([PLAYER], 1, { bestScores: { easy: 5 } });
    const replayed: PieceQuizState = { ...base, level: 1, tier: 'easy' };
    const failed = playLevel(replayed, [true, true, false, false, false]);
    expect(failed.progress.easy).toBe(5); // inchangé, pas de recul
  });

  it('niveau 100 réussi : finished devient vrai, getResult renvoie le score final', () => {
    const state = createState([PLAYER], 1, { bestScores: { easy: 30, medium: 40, hard: 29 } });
    expect(state.level).toBe(100);
    const after = playLevel(state, [true, true, true, true, true]);
    expect(after.finished).toBe(true);
    expect(after.progress.hard).toBe(30);
    const result = getResult(after);
    expect(result?.kind).toBe('win');
    if (result?.kind === 'win') {
      expect(result.score).toEqual({ value: 30, variant: 'hard', maxValue: 30 });
    }
    expect(currentPlayer(after)).toBeNull();
    expect(isValidMove(after, { type: 'next' })).toBe(false);
  });

  it('niveau 100 raté : ne termine pas la partie, recommence le niveau 100', () => {
    const state = createState([PLAYER], 1, { bestScores: { easy: 30, medium: 40, hard: 29 } });
    const after = playLevel(state, [true, true, false, false, false]);
    expect(after.finished).toBe(false);
    expect(after.level).toBe(100);
    expect(getResult(after)).toBeNull();
  });
});

describe('progressSignal (spec 06, points 3-5)', () => {
  it('reste nul sur les coups qui ne terminent pas un niveau', () => {
    const state = createState([PLAYER], 1);
    const marked = applyMove(state, { type: 'toggle', square: state.questions[0].expectedSquares[0] });
    expect(progressSignal(state, marked)).toBeNull();

    const revealed = answerCurrentQuestion(state, true);
    expect(progressSignal(state, revealed)).toBeNull(); // validate, pas encore 'next'

    const mid = applyMove(revealed, { type: 'next' }); // question 2, pas la fin du niveau
    expect(progressSignal(revealed, mid)).toBeNull();
  });

  it('niveau raté : fail: true, pas de scores', () => {
    const state = createState([PLAYER], 1);
    const { signal } = playLevelWithSignal(state, [true, true, false, false, false]);
    expect(signal).toEqual({ player: PLAYER, fail: true });
  });

  it('niveau réussi au prochain niveau à réussir : scores mis à jour', () => {
    const state = createState([PLAYER], 1);
    const { signal } = playLevelWithSignal(state, [true, true, true, true, false]);
    expect(signal?.scores).toEqual({ easy: 1 });
    expect(signal?.fail).toBeUndefined();
  });

  it('rejouer un niveau déjà acquis et le réussir : pas de scores (rien de nouveau)', () => {
    const base = createState([PLAYER], 1, { bestScores: { easy: 5 } });
    const replayed: PieceQuizState = { ...base, level: 1, tier: 'easy' };
    const { signal } = playLevelWithSignal(replayed, [true, true, true, true, true]);
    expect(signal).toBeNull();
  });

  it('dizaine réussie : celebrate avec le libellé du niveau', () => {
    const state = createState([PLAYER], 1, { bestScores: { easy: 9 } });
    expect(state.level).toBe(10);
    const { signal } = playLevelWithSignal(state, [true, true, true, true, true]);
    expect(signal?.celebrate).toEqual({ label: 'Niveau 10' });
    expect(signal?.scores).toEqual({ easy: 10 });
  });

  it('dizaine réussie même en rejouant un niveau déjà acquis (pas seulement la première fois)', () => {
    const base = createState([PLAYER], 1, { bestScores: { easy: 15 } });
    const replayed: PieceQuizState = { ...base, level: 10, tier: 'easy' };
    const { signal } = playLevelWithSignal(replayed, [true, true, true, true, true]);
    expect(signal?.celebrate).toEqual({ label: 'Niveau 10' });
    expect(signal?.scores).toBeUndefined(); // déjà acquis, rien de nouveau à écrire
  });

  it('niveau 100 réussi : pas de fête (chemin Result normal), scores tout de même présents', () => {
    const state = createState([PLAYER], 1, { bestScores: { easy: 30, medium: 40, hard: 29 } });
    const { signal } = playLevelWithSignal(state, [true, true, true, true, true]);
    expect(signal?.celebrate).toBeUndefined();
    expect(signal?.scores).toEqual({ hard: 30 });
  });

  it('le score rapporté ne recule jamais au fil d\'une série de niveaux', () => {
    let state = createState([PLAYER], 1);
    let lastValue = 0;
    for (let level = 1; level <= 12; level++) {
      const { state: after, signal } = playLevelWithSignal(state, [true, true, true, true, true]);
      if (signal?.scores) {
        expect(signal.scores.easy).toBeGreaterThanOrEqual(lastValue);
        lastValue = signal.scores.easy;
      }
      state = after;
    }
    expect(lastValue).toBe(12);
  });
});

describe('choix du palier', () => {
  it('openTierPicker seulement en phase question, startLevel seulement en phase tierPicker', () => {
    const state = createState([PLAYER], 1);
    expect(isValidMove(state, { type: 'openTierPicker' })).toBe(true);
    const picking = applyMove(state, { type: 'openTierPicker' });
    expect(picking.phase).toBe('tierPicker');
    expect(isValidMove(picking, { type: 'openTierPicker' })).toBe(false);

    const move: PieceQuizMove = { type: 'startLevel', level: 1 };
    expect(isValidMove(state, move)).toBe(false); // pas encore en tierPicker
    expect(isValidMove(picking, move)).toBe(true);
  });

  it('startLevel refuse un palier verrouillé', () => {
    const state = applyMove(createState([PLAYER], 1), { type: 'openTierPicker' });
    expect(isValidMove(state, { type: 'startLevel', level: 31 })).toBe(false); // Moyen verrouillé
  });

  it('startLevel accepte le prochain niveau à réussir du palier choisi', () => {
    const state = applyMove(
      createState([PLAYER], 1, { bestScores: { easy: 24 } }),
      { type: 'openTierPicker' },
    );
    // Moyen débloqué (24/30) : prochain niveau à réussir = 31.
    expect(isValidMove(state, { type: 'startLevel', level: 31 })).toBe(true);
    const started = applyMove(state, { type: 'startLevel', level: 31 });
    expect(started.tier).toBe('medium');
    expect(started.level).toBe(31);
    expect(started.phase).toBe('question');
    expect(started.questions).toHaveLength(5);
  });

  it('startLevel refuse un niveau au-delà du prochain à réussir', () => {
    const state = applyMove(createState([PLAYER], 1), { type: 'openTierPicker' });
    expect(isValidMove(state, { type: 'startLevel', level: 5 })).toBe(false); // seul le niveau 1 est atteignable
  });
});
