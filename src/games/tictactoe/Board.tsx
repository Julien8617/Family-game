import type { BoardProps } from '../types';
import type { TicTacToeMove, TicTacToeState } from './logic';

const WINNING_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function findWinningLine(board: TicTacToeState['board']): number[] | null {
  for (const line of WINNING_LINES) {
    const [a, b, c] = line;
    if (board[a] !== null && board[a] === board[b] && board[a] === board[c]) {
      return line;
    }
  }
  return null;
}

export function Board({ state, players, onMove }: BoardProps<TicTacToeState, TicTacToeMove>) {
  const winningLine = findWinningLine(state.board);
  const colorOf = (playerId: string) => players.find((p) => p.id === playerId)?.color;

  return (
    <div className="grid aspect-square h-full grid-cols-3 grid-rows-3 gap-4 p-4">
      {state.board.map((cell, index) => {
        const isWinningCell = winningLine?.includes(index) ?? false;
        const cellColor = cell ? colorOf(cell) : undefined;
        return (
          <button
            key={index}
            type="button"
            disabled={cell !== null}
            onClick={() => onMove({ cell: index })}
            className={[
              'flex items-center justify-center rounded-3xl bg-piece transition-transform',
              'shadow-[0_6px_0_0_rgba(0,0,0,0.25)]',
              'active:translate-y-1 active:shadow-[0_2px_0_0_rgba(0,0,0,0.25)]',
              'disabled:active:translate-y-0',
              isWinningCell ? 'ring-4 ring-victory ring-inset' : '',
            ].join(' ')}
            aria-label={`Case ${index + 1}`}
          >
            {cell && (
              <span
                className="h-[55%] w-[55%] rounded-full shadow-inner"
                style={{ backgroundColor: cellColor }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
