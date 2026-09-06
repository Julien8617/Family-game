import type { BoardProps } from '../types';
import { getWinningLine } from './logic';
import type { TicTacToeMove, TicTacToeState } from './logic';

const colOf = (index: number) => index % 3;
const rowOf = (index: number) => Math.floor(index / 3);

export function Board({ state, players, onMove }: BoardProps<TicTacToeState, TicTacToeMove>) {
  const winningLine = getWinningLine(state);
  const colorOf = (playerId: string) => players.find((p) => p.id === playerId)?.color;

  return (
    <div className="relative grid aspect-square h-full grid-cols-3 grid-rows-3 gap-4 p-4">
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

      {winningLine && (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full animate-win-line"
          viewBox="0 0 3 3"
          aria-hidden
        >
          <line
            x1={colOf(winningLine[0]) + 0.5}
            y1={rowOf(winningLine[0]) + 0.5}
            x2={colOf(winningLine[2]) + 0.5}
            y2={rowOf(winningLine[2]) + 0.5}
            stroke="#F5A623"
            strokeWidth={0.12}
            strokeLinecap="round"
          />
        </svg>
      )}
    </div>
  );
}
