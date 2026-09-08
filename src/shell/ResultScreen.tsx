import { useEffect } from 'react';
import type { Result } from '../games/types';
import { celebrate } from '../fx/confetti';
import { play } from '../fx/sound';
import type { Player } from '../players/types';

interface ResultScreenProps {
  result: Result;
  players: Player[];
  onReplay(): void;
  onMenu(): void;
}

// Laisse la photo du gagnant s'afficher un instant avant les confettis —
// spec 03, critère 9 : ligne, puis photo, puis confettis.
const CONFETTI_DELAY_MS = 200;

export function ResultScreen({ result, players, onReplay, onMenu }: ResultScreenProps) {
  const winner = result.kind === 'win' ? players.find((p) => p.id === result.winner) : undefined;

  useEffect(() => {
    if (!winner) return; // pas de confettis pour un match nul
    const timer = setTimeout(() => celebrate(winner.color), CONFETTI_DELAY_MS);
    return () => clearTimeout(timer);
  }, [winner]);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-12 bg-board px-4 sm:px-12">
      <div className="flex flex-col items-center gap-6">
        {winner ? (
          <img
            src={winner.photo}
            alt=""
            className="h-32 w-32 rounded-full object-cover sm:h-48 sm:w-48"
            style={{ boxShadow: `0 0 0 6px ${winner.color}` }}
          />
        ) : (
          <div className="flex items-center gap-4 sm:gap-8">
            {players.map((player) => (
              <img
                key={player.id}
                src={player.photo}
                alt=""
                className="h-24 w-24 rounded-full object-cover sm:h-32 sm:w-32"
                style={{ boxShadow: `0 0 0 5px ${player.color}` }}
              />
            ))}
          </div>
        )}
        <h1 className="text-5xl text-piece">{winner ? `${winner.name} gagne !` : 'Match nul !'}</h1>
      </div>
      <div className="flex gap-6">
        <button
          type="button"
          onClick={() => {
            play('tap');
            onReplay();
          }}
          className="h-24 rounded-3xl bg-victory px-10 text-2xl text-board shadow-[0_6px_0_0_rgba(0,0,0,0.25)] transition-transform active:translate-y-1 active:shadow-[0_2px_0_0_rgba(0,0,0,0.25)]"
        >
          Rejouer
        </button>
        <button
          type="button"
          onClick={() => {
            play('tap');
            onMenu();
          }}
          className="h-24 rounded-3xl bg-piece px-10 text-2xl text-board shadow-[0_6px_0_0_rgba(0,0,0,0.25)] transition-transform active:translate-y-1 active:shadow-[0_2px_0_0_rgba(0,0,0,0.25)]"
        >
          Retour au menu
        </button>
      </div>
    </div>
  );
}
