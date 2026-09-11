import { describe, expect, it } from 'vitest';
import { PAIR_COUNT, applyMove, createState, currentPlayer, getResult, isValidMove } from './logic';
import type { NoteMemoryState } from './logic';

function flip(state: NoteMemoryState, card: number): NoteMemoryState {
  return applyMove(state, { type: 'flip', card });
}

// Rejoue une partie en trouvant systématiquement chaque paire du premier coup
// (« joueur parfait ») — utilitaire de test uniquement, jamais dans logic.ts.
// Ne suppose rien de l'agencement des cartes (elles ne sont pas appariées à
// des index voisins) : cherche à chaque étape la première carte non encore
// appariée, puis sa partenaire.
function playPerfectGame(state: NoteMemoryState): NoteMemoryState {
  let current = state;
  while (!current.matched.every(Boolean)) {
    const first = current.matched.findIndex((m) => !m);
    const pitch = current.cards[first];
    const second = current.cards.findIndex((c, i) => c === pitch && i !== first && !current.matched[i]);
    current = flip(flip(current, first), second);
  }
  return current;
}

// La première paire de hauteurs différentes rencontrée dans state.cards —
// utilitaire de test uniquement, pour provoquer un dépareillage délibéré.
function findMismatch(state: NoteMemoryState): [number, number] {
  for (let i = 0; i < state.cards.length; i++) {
    for (let j = i + 1; j < state.cards.length; j++) {
      if (state.cards[i] !== state.cards[j]) return [i, j];
    }
  }
  throw new Error('no mismatch found in test fixture');
}

describe('note-memory — création', () => {
  it('crée 2 × PAIR_COUNT cartes, toutes non appariées, tour du premier joueur', () => {
    const state = createState(['a', 'b'], 1);
    expect(state.cards).toHaveLength(PAIR_COUNT * 2);
    expect(state.matched).toEqual(state.cards.map(() => false));
    expect(state.revealed).toEqual([]);
    expect(state.phase).toBe('playing');
    expect(currentPlayer(state)).toBe('a');
  });

  it('chaque hauteur choisie apparaît exactement deux fois', () => {
    const state = createState(['a'], 42);
    const counts = new Map<string, number>();
    for (const pitch of state.cards) counts.set(pitch, (counts.get(pitch) ?? 0) + 1);
    expect(counts.size).toBe(PAIR_COUNT);
    for (const count of counts.values()) expect(count).toBe(2);
  });

  it('est déterministe : même seed, même donne', () => {
    const a = createState(['a'], 777);
    const b = createState(['a'], 777);
    expect(a.cards).toEqual(b.cards);
  });

  it('varie selon le seed (des cartes différentes au moins une fois sur plusieurs essais)', () => {
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
    const layouts = seeds.map((seed) => createState(['a'], seed).cards.join(','));
    expect(new Set(layouts).size).toBeGreaterThan(1);
  });

  it('démarre au niveau par défaut (1) si options est omis', () => {
    expect(createState(['a'], 1).level).toBe(1);
    expect(createState(['a'], 1, { level: 3 }).level).toBe(3);
  });
});

describe('note-memory — isValidMove', () => {
  it('accepte un premier flip sur une carte non retournée, non appariée', () => {
    const state = createState(['a'], 1);
    expect(isValidMove(state, { type: 'flip', card: 0 })).toBe(true);
  });

  it('refuse un flip hors bornes, déjà retourné, ou une 3ᵉ carte', () => {
    const state = createState(['a'], 1);
    expect(isValidMove(state, { type: 'flip', card: -1 })).toBe(false);
    expect(isValidMove(state, { type: 'flip', card: state.cards.length })).toBe(false);

    const oneFlipped = flip(state, 0);
    expect(isValidMove(oneFlipped, { type: 'flip', card: 0 })).toBe(false);
    expect(isValidMove(oneFlipped, { type: 'flip', card: 1 })).toBe(true);
  });

  it('refuse resolveMismatch tant que deux cartes ne sont pas en attente', () => {
    const state = createState(['a'], 1);
    expect(isValidMove(state, { type: 'resolveMismatch' })).toBe(false);
    expect(isValidMove(flip(state, 0), { type: 'resolveMismatch' })).toBe(false);
  });

  it('refuse tout coup une fois la partie terminée', () => {
    const state = playPerfectGame(createState(['a'], 1));
    expect(state.phase).toBe('gameover');
    expect(isValidMove(state, { type: 'flip', card: 0 })).toBe(false);
  });
});

describe('note-memory — paire trouvée', () => {
  it('marque les deux cartes appariées, incrémente le score et les tentatives, laisse le même joueur', () => {
    const state = createState(['a', 'b'], 1);
    const pitch = state.cards[0];
    const match = state.cards.findIndex((c, i) => c === pitch && i !== 0);
    const next = flip(flip(state, 0), match);

    expect(next.matched[0]).toBe(true);
    expect(next.matched[match]).toBe(true);
    expect(next.revealed).toEqual([]);
    expect(next.scores.a).toBe(1);
    expect(next.attempts).toBe(1);
    expect(currentPlayer(next)).toBe('a');
  });

  it('termine la partie (phase gameover) une fois toutes les paires trouvées', () => {
    const state = playPerfectGame(createState(['a'], 1));
    expect(state.phase).toBe('gameover');
    expect(state.matched.every(Boolean)).toBe(true);
    expect(state.attempts).toBe(PAIR_COUNT);
  });
});

describe('note-memory — dépareillage', () => {
  it('laisse les deux cartes visibles (revealed) sans les apparier, incrémente les tentatives', () => {
    const state = createState(['a', 'b'], 1);
    const [i, j] = findMismatch(state);
    const next = flip(flip(state, i), j);

    expect(next.matched[i]).toBe(false);
    expect(next.matched[j]).toBe(false);
    expect(next.revealed).toEqual([i, j]);
    expect(next.attempts).toBe(1);
    // Le tour ne passe qu'à resolveMismatch, pas au 2ᵉ flip lui-même — le
    // temps que Board.tsx laisse voir le dépareillage.
    expect(currentPlayer(next)).toBe('a');
  });

  it('resolveMismatch retourne les deux cartes et passe au joueur suivant', () => {
    const state = createState(['a', 'b'], 1);
    const [i, j] = findMismatch(state);
    const revealed = flip(flip(state, i), j);
    const resolved = applyMove(revealed, { type: 'resolveMismatch' });

    expect(resolved.revealed).toEqual([]);
    expect(currentPlayer(resolved)).toBe('b');
  });
});

describe('note-memory — getResult', () => {
  it('retourne null tant que la partie continue', () => {
    expect(getResult(createState(['a'], 1))).toBeNull();
  });

  it("solo : 100 % d'efficacité quand chaque paire est trouvée du premier coup", () => {
    const state = playPerfectGame(createState(['a'], 5, { level: 2 }));
    expect(getResult(state)).toEqual({
      kind: 'win',
      winner: 'a',
      score: { value: 100, variant: 'level-2', maxValue: 100 },
    });
  });

  it("solo : l'efficacité baisse avec une tentative ratée avant de finir la partie", () => {
    const state = createState(['a'], 5);
    const [i, j] = findMismatch(state);
    const afterMiss = applyMove(flip(flip(state, i), j), { type: 'resolveMismatch' });
    const finished = playPerfectGame(afterMiss);

    expect(finished.phase).toBe('gameover');
    const result = getResult(finished);
    expect(result?.kind).toBe('win');
    if (result?.kind === 'win') {
      expect(result.score?.value).toBeLessThan(100);
    }
  });

  it('famille à 2 : gagnant = plus de paires trouvées (un seul joueur actif)', () => {
    const state = playPerfectGame(createState(['a', 'b'], 1));
    // playPerfectGame ne fait jouer que le joueur au trait à chaque étape :
    // trouver une paire fait rejouer le même joueur (règle du memory), donc
    // 'a' (premier joueur) trouve tout, 'b' ne joue jamais.
    expect(getResult(state)).toEqual({ kind: 'win', winner: 'a' });
  });

  it('famille à 3/4 : égalité de paires trouvées donne un match nul', () => {
    // État gameover construit directement (pas via applyMove) : ne teste que
    // la comparaison des scores dans getResult, pas le déroulé des tours.
    const base = createState(['a', 'b', 'c'], 1);
    const tied: NoteMemoryState = {
      ...base,
      matched: base.matched.map(() => true),
      scores: { a: 2, b: 2, c: 2 },
      phase: 'gameover',
    };
    expect(getResult(tied)).toEqual({ kind: 'draw' });

    const notTied: NoteMemoryState = {
      ...base,
      matched: base.matched.map(() => true),
      scores: { a: 3, b: 2, c: 1 },
      phase: 'gameover',
    };
    expect(getResult(notTied)).toEqual({ kind: 'win', winner: 'a' });
  });
});
