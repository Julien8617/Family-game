import { describe, expect, it } from 'vitest';
import { chooseMove } from './bot';
import { applyMove, createState, getResult, SOLO_PAR } from './logic';
import type { MazeMove, MazeState } from './logic';

const A = 'a';
const B = 'b';

const MAX_TURNS = 300;

function playSolo(seed: number, level: number): { finished: boolean; shiftsUsed: number; score: number } {
  let state: MazeState = createState([A], seed);
  state = applyMove(state, { type: 'chooseMode', mode: 'solo' });

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const result = getResult(state);
    if (result) {
      if (result.kind !== 'win') return { finished: false, shiftsUsed: state.shiftsUsed, score: 0 };
      return { finished: true, shiftsUsed: state.shiftsUsed, score: result.score?.value ?? 0 };
    }
    state = applyMove(state, chooseMove(state, level));
  }
  return { finished: false, shiftsUsed: state.shiftsUsed, score: 0 };
}

// Combien de fois, sur les mêmes plateaux de départ (mêmes seeds), le niveau
// `stronger` termine sa partie solo en moins de décalages que `weaker` — une
// comparaison appariée plutôt qu'un duel direct. Les deux bots jouent des
// parties SÉPARÉES, jamais l'un contre l'autre : voir la note au-dessus de
// « la course » dans bot.test.ts, plus bas, pour ce que mesure un duel réel.
function pairedSoloWins(stronger: number, weaker: number, seeds: number): { strongerWins: number; weakerWins: number; ties: number } {
  let strongerWins = 0;
  let weakerWins = 0;
  let ties = 0;
  for (let seed = 0; seed < seeds; seed++) {
    const a = playSolo(seed, stronger);
    const b = playSolo(seed, weaker);
    const aShifts = a.finished ? a.shiftsUsed : Infinity;
    const bShifts = b.finished ? b.shiftsUsed : Infinity;
    if (aShifts < bShifts) strongerWins++;
    else if (bShifts < aShifts) weakerWins++;
    else ties++;
  }
  return { strongerWins, weakerWins, ties };
}

type Outcome = 'a' | 'b' | 'cap';

function playPartageDuel(seed: number, levelA: number, levelB: number): Outcome {
  let state: MazeState = createState([A, B], seed);
  state = applyMove(state, { type: 'chooseMode', mode: 'partage' });
  if (state.phase === 'dealing') state = applyMove(state, { type: 'dealingDone' });

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const result = getResult(state);
    if (result) {
      if (result.kind !== 'win') return 'cap';
      return result.winner === A ? 'a' : 'b';
    }
    const level = state.turnIndex === 0 ? levelA : levelB;
    const move: MazeMove = chooseMove(state, level);
    state = applyMove(state, move);
  }
  return 'cap';
}

function partageWinRate(levelA: number, levelB: number, games: number): { aWins: number; bWins: number; capped: number } {
  let aWins = 0;
  let bWins = 0;
  let capped = 0;
  for (let i = 0; i < games; i++) {
    const aGoesFirst = i % 2 === 0;
    const outcome = aGoesFirst ? playPartageDuel(i, levelA, levelB) : playPartageDuel(i, levelB, levelA);
    if (outcome === 'cap') {
      capped++;
      continue;
    }
    const aWon = aGoesFirst ? outcome === 'a' : outcome === 'b';
    if (aWon) aWins++;
    else bWins++;
  }
  return { aWins, bWins, capped };
}

describe('maze bot — déterminisme', () => {
  it('produit exactement la même partie deux fois de suite, à seed égal, pour chaque niveau', () => {
    for (const level of [1, 2, 3, 4]) {
      const first = playPartageDuel(123, level, level);
      const second = playPartageDuel(123, level, level);
      expect(second).toEqual(first);
    }
  });

  it('chooseMove est une fonction pure de state (même state, même coup)', () => {
    let state: MazeState = createState([A, B], 9);
    state = applyMove(state, { type: 'chooseMode', mode: 'course' });
    for (const level of [1, 2, 3, 4]) {
      expect(chooseMove(state, level)).toEqual(chooseMove(state, level));
    }
  });
});

// Note sur la méthode : un vrai duel (les deux bots jouent la MÊME partie,
// à tour de rôle, sur un plateau qu'ils modifient à deux) a été le premier
// essai pour ce test de force. Résultat mesuré sur ce jeu précis : en mode
// « course » (les deux joueurs visent le même trésor), gagner tient bien
// plus au tirage du plateau qu'à la qualité du coup — élargir ou resserrer
// la façon dont un niveau vise n'a quasiment aucun effet sur qui gagne la
// course, alors que la même différence se voit très nettement en solo (où
// chaque bot joue sa propre partie, sans interférence). D'où la comparaison
// appariée ci-dessous pour les niveaux 1 à 3 : sur un même plateau de
// départ, quel niveau finit sa quête solo en moins de décalages. Le niveau 4
// reste comparé par un vrai duel, en mode « partage » cette fois (chaque
// joueur a sa propre quête plutôt qu'une cible partagée) : c'est le seul
// endroit où une différence de niveau s'est révélée franchement décisive au
// duel — bloquer un adversaire qui allait gagner ne coûte rien à sa propre
// quête, contrairement au mode « course » où gêner l'adversaire gêne
// souvent tout autant sa propre route. Détail des mesures dans NOTES.md.
describe('maze bot — force des niveaux', () => {
  it('le poussin (2) termine sa quête solo en moins de décalages que l’œuf (1), sur 200 plateaux', () => {
    const { strongerWins, weakerWins } = pairedSoloWins(2, 1, 200);
    expect(strongerWins).toBeGreaterThan(weakerWins);
  });

  it('la poule (3) termine sa quête solo en moins de décalages que le poussin (2), sur 200 plateaux', () => {
    const { strongerWins, weakerWins } = pairedSoloWins(3, 2, 200);
    expect(strongerWins).toBeGreaterThan(weakerWins);
  });

  it('le coq (4) gagne plus souvent que la poule (3) en duel réel (mode partage), sur 200 parties', () => {
    const { aWins, bWins } = partageWinRate(4, 3, 200);
    expect(aWins).toBeGreaterThan(bWins);
  });
});

describe('maze bot — faisabilité solo', () => {
  it('le niveau le plus fort termine les 6 trésors et atteint le PAR sur 100 seeds', () => {
    let finished = 0;
    let withinPar = 0;
    for (let seed = 0; seed < 100; seed++) {
      const { finished: done, score } = playSolo(seed, 4);
      if (done) finished++;
      if (score > 0) withinPar++;
    }
    expect(finished).toBe(100);
    // Le PAR doit rester atteignable pour l'immense majorité des plateaux —
    // sinon (spec) c'est lui qu'il faut desserrer, pas le bot qu'il faut
    // forcer à jouer un labyrinthe résolu à la perfection.
    expect(withinPar).toBeGreaterThanOrEqual(90);
    void SOLO_PAR;
  });
});
