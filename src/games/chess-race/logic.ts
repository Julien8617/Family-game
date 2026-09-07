import type { PlayerId, Result } from '../types';

// Échiquier 8x8. Index de case = row * 8 + col, row 0 = rangée 1 (bord des
// jaunes), row 7 = rangée 8 (bord des roux). Les jaunes (players[0]) avancent
// vers row croissant, les roux (players[1]) vers row décroissant — exactement
// comme les pions blancs/noirs aux échecs, pour que rien ne surprenne le jour
// où d'autres pièces s'ajoutent.

export const SIZE = 8;

export type Cell = PlayerId | null;

export interface ChessRaceState {
  board: Cell[]; // longueur 64
  turn: PlayerId;
  players: [PlayerId, PlayerId]; // [jaunes, roux]
  seed: number;
  moveCount: number;
}

export interface ChessRaceMove {
  from: number;
  to: number;
}

export function cellOf(row: number, col: number): number {
  return row * SIZE + col;
}

export function rowOf(cell: number): number {
  return Math.floor(cell / SIZE);
}

export function colOf(cell: number): number {
  return cell % SIZE;
}

export function algebraic(cell: number): string {
  return `${String.fromCharCode(97 + colOf(cell))}${rowOf(cell) + 1}`;
}

export function colorOf(state: ChessRaceState, player: PlayerId): 'yellow' | 'red' {
  return state.players[0] === player ? 'yellow' : 'red';
}

function directionOf(color: 'yellow' | 'red'): 1 | -1 {
  return color === 'yellow' ? 1 : -1;
}

export function createState(players: PlayerId[], seed: number): ChessRaceState {
  const [yellow, red] = players as [PlayerId, PlayerId];
  const board: Cell[] = Array(SIZE * SIZE).fill(null);
  for (let col = 0; col < SIZE; col++) {
    board[cellOf(1, col)] = yellow; // rangée 2
    board[cellOf(6, col)] = red; // rangée 7
  }
  return { board, turn: yellow, players: [yellow, red], seed, moveCount: 0 };
}

// Cases atteignables depuis `from` pour le joueur au trait — avance sur case
// vide, prise en diagonale sur adversaire. Ne dit rien sur la fin de partie :
// c'est le socle réutilisé par isValidMove, allLegalMoves et le bot.
export function legalMovesFrom(state: ChessRaceState, from: number): number[] {
  const piece = state.board[from];
  if (piece === null || piece !== state.turn) return [];
  const dir = directionOf(colorOf(state, piece));
  const row = rowOf(from);
  const col = colOf(from);
  const nextRow = row + dir;
  if (nextRow < 0 || nextRow >= SIZE) return [];

  const targets: number[] = [];
  const straight = cellOf(nextRow, col);
  if (state.board[straight] === null) targets.push(straight);

  for (const dc of [-1, 1]) {
    const c = col + dc;
    if (c < 0 || c >= SIZE) continue;
    const target = cellOf(nextRow, c);
    const occupant = state.board[target];
    if (occupant !== null && occupant !== piece) targets.push(target);
  }

  return targets;
}

// Coups du joueur au trait, sans regarder si la partie est déjà terminée.
// Sert de base à getResult() (blocage) — allLegalMoves() ne peut donc pas
// appeler getResult() sans provoquer une récursion infinie.
function rawLegalMoves(state: ChessRaceState): ChessRaceMove[] {
  const moves: ChessRaceMove[] = [];
  for (let from = 0; from < SIZE * SIZE; from++) {
    if (state.board[from] !== state.turn) continue;
    for (const to of legalMovesFrom(state, from)) {
      moves.push({ from, to });
    }
  }
  return moves;
}

export function allLegalMoves(state: ChessRaceState): ChessRaceMove[] {
  if (getResult(state)) return [];
  return rawLegalMoves(state);
}

export function isValidMove(state: ChessRaceState, move: ChessRaceMove): boolean {
  if (getResult(state)) return false;
  if (move.from < 0 || move.from >= SIZE * SIZE) return false;
  if (move.to < 0 || move.to >= SIZE * SIZE) return false;
  if (state.board[move.from] !== state.turn) return false;
  return legalMovesFrom(state, move.from).includes(move.to);
}

export function applyMove(state: ChessRaceState, move: ChessRaceMove): ChessRaceState {
  const board = state.board.slice();
  const piece = board[move.from];
  board[move.from] = null;
  board[move.to] = piece;
  const [yellow, red] = state.players;
  const turn = state.turn === yellow ? red : yellow;
  return { ...state, board, turn, moveCount: state.moveCount + 1 };
}

export function currentPlayer(state: ChessRaceState): PlayerId | null {
  if (getResult(state)) return null;
  return state.turn;
}

export function getResult(state: ChessRaceState): Result | null {
  const [yellow, red] = state.players;

  for (let col = 0; col < SIZE; col++) {
    if (state.board[cellOf(SIZE - 1, col)] === yellow) return { kind: 'win', winner: yellow };
    if (state.board[cellOf(0, col)] === red) return { kind: 'win', winner: red };
  }

  let yellowCount = 0;
  let redCount = 0;
  for (const cell of state.board) {
    if (cell === yellow) yellowCount++;
    else if (cell === red) redCount++;
  }
  if (yellowCount === 0) return { kind: 'win', winner: red };
  if (redCount === 0) return { kind: 'win', winner: yellow };

  if (rawLegalMoves(state).length === 0) return { kind: 'draw' };

  return null;
}
