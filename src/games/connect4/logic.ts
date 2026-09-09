import type { PlayerId, Result } from '../types';

export const COLS = 7;
export const ROWS = 6;

export type Cell = PlayerId | null;

export interface Connect4State {
  // index = row * COLS + col, row 0 = bas du plateau (un pion tombe donc
  // vers l'index le plus petit de sa colonne).
  board: Cell[];
  turn: PlayerId;
  players: [PlayerId, PlayerId];
  seed: number;
  // Dernière case posée (joueur ou bot) — Board.tsx s'en sert pour surligner
  // le dernier coup, comme la case de départ/d'arrivée de chess-race.
  lastMove: number | null;
}

export interface Connect4Move {
  col: number;
}

export function colOf(cell: number): number {
  return cell % COLS;
}

export function rowOf(cell: number): number {
  return Math.floor(cell / COLS);
}

export function createState(players: PlayerId[], seed: number): Connect4State {
  const [p1, p2] = players as [PlayerId, PlayerId];
  return {
    board: Array(COLS * ROWS).fill(null),
    turn: p1,
    players: [p1, p2],
    seed,
    lastMove: null,
  };
}

// Nombre de pions déjà tombés dans `col` — aussi l'index de la prochaine
// rangée libre (row 0 = bas), tant que la colonne n'est pas pleine.
export function columnHeight(board: Cell[], col: number): number {
  let height = 0;
  while (height < ROWS && board[height * COLS + col] !== null) height++;
  return height;
}

export function isValidMove(state: Connect4State, move: Connect4Move): boolean {
  if (move.col < 0 || move.col >= COLS) return false;
  if (getResult(state) !== null) return false;
  return columnHeight(state.board, move.col) < ROWS;
}

export function applyMove(state: Connect4State, move: Connect4Move): Connect4State {
  const board = state.board.slice();
  const row = columnHeight(board, move.col);
  const cell = row * COLS + move.col;
  board[cell] = state.turn;
  const [p1, p2] = state.players;
  const turn = state.turn === p1 ? p2 : p1;
  return { ...state, board, turn, lastMove: cell };
}

export function currentPlayer(state: Connect4State): PlayerId | null {
  if (getResult(state) !== null) return null;
  return state.turn;
}

// Une seule direction par axe (l'opposée est incluse en balayant toutes les
// cases de départ) : horizontale, verticale, deux diagonales. Exporté pour
// bot.ts (vérification rapide d'un alignement autour d'un seul coup, sans
// rebalayer tout le plateau à chaque nœud de la recherche).
export const LINE_DIRECTIONS: Array<[number, number]> = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

// Les 4 cases alignées d'une partie gagnée, ou null. Board.tsx s'en sert pour
// surligner les jetons ; getResult() en dérive le gagnant, sans dupliquer la
// recherche (même contrat que tictactoe.getWinningLine).
export function getWinningLine(state: Connect4State): number[] | null {
  const { board } = state;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const mark = board[row * COLS + col];
      if (mark === null) continue;
      for (const [dr, dc] of LINE_DIRECTIONS) {
        const line: number[] = [];
        let ok = true;
        for (let i = 0; i < 4; i++) {
          const r = row + dr * i;
          const c = col + dc * i;
          if (r < 0 || r >= ROWS || c < 0 || c >= COLS || board[r * COLS + c] !== mark) {
            ok = false;
            break;
          }
          line.push(r * COLS + c);
        }
        if (ok) return line;
      }
    }
  }
  return null;
}

export function getResult(state: Connect4State): Result | null {
  const line = getWinningLine(state);
  if (line) {
    return { kind: 'win', winner: state.board[line[0]] as PlayerId };
  }
  if (state.board.every((cell) => cell !== null)) {
    return { kind: 'draw' };
  }
  return null;
}
