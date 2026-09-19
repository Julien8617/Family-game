import { describe, expect, it } from 'vitest';
import { generateLevel, isValidQuestion, QUESTIONS_PER_LEVEL, tierOf } from './generate';
import type { PieceQuizQuestion } from './generate';

const SEEDS = [1, 2, 3, 42, 987654321];

function canonicalKey(question: PieceQuizQuestion): string {
  const piecesKey = [...question.pieces]
    .sort((a, b) => a.square - b.square)
    .map((p) => `${p.square}:${p.type}:${p.side}`)
    .join(',');
  return `${question.pieceType}|${question.queriedSquare}|${piecesKey}|${question.pawnDoubleStepEnabled}|${question.enPassantSquare}`;
}

describe('generateLevel — les 100 niveaux, plusieurs seeds', () => {
  for (const seed of SEEDS) {
    it(`seed ${seed} : chaque niveau produit une position valide`, () => {
      for (let level = 1; level <= 100; level++) {
        const questions = generateLevel(seed, level);
        expect(questions).toHaveLength(QUESTIONS_PER_LEVEL);

        const keys = new Set<string>();
        for (const question of questions) {
          expect(isValidQuestion(question, level)).toBe(true);
          expect(question.expectedSquares.length).toBeGreaterThanOrEqual(1);
          if (level > 10) {
            expect(question.expectedSquares.length).toBeGreaterThanOrEqual(2);
          }
          if (level < 71) {
            expect(question.pawnDoubleStepEnabled).toBe(false);
            expect(question.enPassantSquare).toBeNull();
          }
          // La pièce interrogée est bien présente sur le plateau, côté ami.
          const queried = question.pieces.find((p) => p.square === question.queriedSquare);
          expect(queried?.side).toBe('own');
          expect(queried?.type).toBe(question.pieceType);
          // Jamais de second roi sur le plateau.
          const kings = question.pieces.filter((p) => p.type === 'king');
          expect(kings.length).toBeLessThanOrEqual(1);

          keys.add(canonicalKey(question));
        }
        // Questions distinctes entre elles.
        expect(keys.size).toBe(QUESTIONS_PER_LEVEL);
      }
    });
  }
});

describe('generateLevel — déterminisme', () => {
  it('même seed, même niveau → mêmes positions, deux fois de suite', () => {
    for (const level of [1, 15, 25, 35, 55, 65, 85, 95]) {
      const first = generateLevel(777, level);
      const second = generateLevel(777, level);
      expect(second).toEqual(first);
    }
  });
});

describe('generateLevel — paliers 1 à 70, sans règles du palier Difficile', () => {
  it('aucune position ne dépend du double pas ni de la prise en passant', () => {
    for (const seed of SEEDS) {
      for (let level = 1; level <= 70; level++) {
        const questions = generateLevel(seed, level);
        for (const q of questions) {
          expect(q.pawnDoubleStepEnabled).toBe(false);
          expect(q.enPassantSquare).toBeNull();
        }
      }
    }
  });
});

describe('generateLevel — introduction de règle, majorité des questions', () => {
  // Majorité de QUESTIONS_PER_LEVEL (3) : au moins 2 — un seul indice « hors
  // règle » par niveau, voir generate.ts (offIndex).
  const MAJORITY = Math.ceil(QUESTIONS_PER_LEVEL / 2);

  function countRuleQuestions(level: number, predicate: (q: PieceQuizQuestion) => boolean): number {
    const questions = generateLevel(1, level);
    return questions.filter(predicate).length;
  }

  it('niveaux 11-20 : la majorité des questions exerce la prise en diagonale', () => {
    for (let level = 11; level <= 20; level++) {
      const count = countRuleQuestions(level, (q) =>
        q.pieces.some((p) => p.side === 'enemy' && p.square !== q.queriedSquare && q.expectedSquares.includes(p.square)),
      );
      expect(count).toBeGreaterThanOrEqual(MAJORITY);
    }
  });

  it('niveaux 21-30 : la majorité des questions a l\'avance bloquée', () => {
    for (let level = 21; level <= 30; level++) {
      const questions = generateLevel(1, level);
      const count = questions.filter((q) => {
        // La case juste devant (row+1, même colonne) absente des cases
        // attendues => avance bloquée pour cette question.
        const { boardSize, queriedSquare } = q;
        const row = Math.floor(queriedSquare / boardSize);
        const col = queriedSquare % boardSize;
        const forwardSquare = (row + 1) * boardSize + col;
        return !q.expectedSquares.includes(forwardSquare);
      }).length;
      expect(count).toBeGreaterThanOrEqual(MAJORITY);
    }
  });

  it('niveaux 81-90 : la majorité des questions active le double pas ou la prise en passant', () => {
    for (let level = 81; level <= 90; level++) {
      const questions = generateLevel(1, level);
      const count = questions.filter((q) => q.pawnDoubleStepEnabled || q.enPassantSquare !== null).length;
      expect(count).toBeGreaterThanOrEqual(MAJORITY);
    }
  });
});

describe('generateLevel — paliers, tailles de plateau', () => {
  it('5×5 partout, les cent niveaux (retour utilisateur : 8×8 était trop grand, spec 06 suite)', () => {
    for (let level = 1; level <= 100; level++) {
      expect(generateLevel(5, level)[0].boardSize).toBe(5);
    }
  });

  it('tierOf reflète les mêmes bornes', () => {
    expect(tierOf(1)).toBe('easy');
    expect(tierOf(30)).toBe('easy');
    expect(tierOf(31)).toBe('medium');
    expect(tierOf(70)).toBe('medium');
    expect(tierOf(71)).toBe('hard');
    expect(tierOf(100)).toBe('hard');
  });
});

describe('generateLevel — roi (51-60 et le roi en 91-100)', () => {
  it('le roi interrogé n\'est jamais à portée d\'une case attaquée', () => {
    for (const seed of SEEDS) {
      for (let level = 51; level <= 60; level++) {
        const questions = generateLevel(seed, level);
        for (const q of questions) {
          expect(q.pieceType).toBe('king');
          expect(isValidQuestion(q, level)).toBe(true);
        }
      }
    }
  });
});
