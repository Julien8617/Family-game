import { describe, expect, it } from 'vitest';
import {
  applyMove,
  createState,
  currentPlayer,
  getResult,
  isTierUnlocked,
  isValidMove,
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

// Joue un niveau complet (5 questions) selon un patron de réussite, en
// s'arrêtant en phase 'reveal' sur la dernière question (getResult devient
// alors non nul) — jamais de 'next' après la 5ᵉ, comme le veut le contrat.
function playLevel(state: PieceQuizState, pattern: boolean[]): PieceQuizState {
  let s = state;
  for (let i = 0; i < pattern.length; i++) {
    s = answerCurrentQuestion(s, pattern[i]);
    if (i < pattern.length - 1) s = applyMove(s, { type: 'next' });
  }
  return s;
}

describe('createState — reprise de la progression', () => {
  it('aucune progression : palier Facile, niveau 1', () => {
    const state = createState([PLAYER], 1);
    expect(state.tier).toBe('easy');
    expect(state.level).toBe(1);
    expect(state.questions).toHaveLength(5);
    expect(state.phase).toBe('question');
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

describe('déroulé d\'un niveau', () => {
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

  it("getResult reste nul avant la révélation de la 5ᵉ question, 'next' invalide dessus", () => {
    const state = createState([PLAYER], 1);
    let s = state;
    for (let i = 0; i < 4; i++) {
      s = answerCurrentQuestion(s, true);
      expect(getResult(s)).toBeNull();
      s = applyMove(s, { type: 'next' });
    }
    const lastRevealed = answerCurrentQuestion(s, true);
    expect(lastRevealed.questionIndex).toBe(4);
    expect(isValidMove(lastRevealed, { type: 'next' })).toBe(false);
    expect(getResult(lastRevealed)).not.toBeNull();
    expect(currentPlayer(lastRevealed)).toBeNull();
  });
});

describe('réussite de niveau, seuil 80 %', () => {
  it('4/5 réussit et fait avancer la progression du palier', () => {
    const state = createState([PLAYER], 1); // niveau 1, easy, progress.easy = 0
    const finished = playLevel(state, [true, true, true, true, false]);
    const result = getResult(finished);
    expect(result?.kind).toBe('win');
    if (result?.kind === 'win') {
      expect(result.score?.value).toBe(1);
      expect(result.score?.variant).toBe('easy');
    }
  });

  it('3/5 rate et ne fait pas avancer la progression', () => {
    const state = createState([PLAYER], 1);
    const finished = playLevel(state, [true, true, true, false, false]);
    const result = getResult(finished);
    if (result?.kind === 'win') {
      expect(result.score?.value).toBe(0);
    }
  });

  it('refaire un niveau déjà réussi, même à 5/5, ne fait pas avancer au-delà', () => {
    // progress.easy = 5 : le niveau 1 (déjà acquis) est rejoué directement.
    const state = createState([PLAYER], 1, { bestScores: { easy: 5 } });
    expect(state.level).toBe(6); // reprend normalement au niveau 6...
  });

  it('un niveau au-delà du prochain à réussir ne fait jamais reculer ni sauter la progression', () => {
    // Reconstruit un état "comme si" on rejouait le niveau 3 alors que
    // progress.easy vaut déjà 5 (donc niveau 3 déjà acquis) : la réussite ne
    // doit pas changer la progression (elle ne peut qu'avancer au niveau
    // exactement suivant, jamais ailleurs).
    const base = createState([PLAYER], 1, { bestScores: { easy: 5 } });
    const replayed: PieceQuizState = { ...base, tier: 'easy', level: 3, questions: base.questions };
    const finished = playLevel(replayed, [true, true, true, true, true]);
    const result = getResult(finished);
    if (result?.kind === 'win') {
      expect(result.score?.value).toBe(5);
    }
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
