import type { Result } from '../games/types';
import type { Player } from '../players/types';

interface ResultScreenProps {
  result: Result;
  players: Player[];
  onReplay(): void;
  onMenu(): void;
}

export function ResultScreen({ result, players, onReplay, onMenu }: ResultScreenProps) {
  const winner = result.kind === 'win' ? players.find((p) => p.id === result.winner) : undefined;

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-12 bg-board px-12">
      <div className="flex flex-col items-center gap-4">
        {winner && (
          <img
            src={winner.photo}
            alt=""
            className="h-28 w-28 rounded-full object-cover"
            style={{ boxShadow: `0 0 0 5px ${winner.color}` }}
          />
        )}
        <h1 className="text-5xl text-piece">
          {result.kind === 'win' ? `${winner?.name} gagne !` : 'Match nul !'}
        </h1>
      </div>
      <div className="flex gap-6">
        <button
          type="button"
          onClick={onReplay}
          className="h-24 rounded-3xl bg-victory px-10 text-2xl text-board shadow-[0_6px_0_0_rgba(0,0,0,0.25)] transition-transform active:translate-y-1 active:shadow-[0_2px_0_0_rgba(0,0,0,0.25)]"
        >
          Rejouer
        </button>
        <button
          type="button"
          onClick={onMenu}
          className="h-24 rounded-3xl bg-piece px-10 text-2xl text-board shadow-[0_6px_0_0_rgba(0,0,0,0.25)] transition-transform active:translate-y-1 active:shadow-[0_2px_0_0_rgba(0,0,0,0.25)]"
        >
          Retour au menu
        </button>
      </div>
    </div>
  );
}
