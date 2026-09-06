import { useState } from 'react';
import type { GameModule, PlayerId } from '../games/types';
import { listPlayers } from '../players/storage';
import type { Player } from '../players/types';

interface PlayerPickScreenProps {
  game: GameModule<any, any>;
  onConfirm(players: Player[]): void;
  onBack(): void;
}

export function PlayerPickScreen({ game, onConfirm, onBack }: PlayerPickScreenProps) {
  const [players] = useState(() => listPlayers());
  const [selected, setSelected] = useState<PlayerId[]>([]);

  function toggle(id: PlayerId) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= game.meta.maxPlayers) return prev;
      return [...prev, id];
    });
  }

  const canStart = selected.length >= game.meta.minPlayers && selected.length <= game.meta.maxPlayers;

  return (
    <div className="flex h-screen w-screen flex-col items-center gap-10 bg-board px-12 py-10">
      <h1 className="text-4xl text-piece">Qui joue ?</h1>

      <div className="flex flex-1 flex-wrap items-center justify-center gap-8">
        {players.map((player) => {
          const rank = selected.indexOf(player.id);
          const isSelected = rank !== -1;
          return (
            <button
              key={player.id}
              type="button"
              onClick={() => toggle(player.id)}
              className="relative flex flex-col items-center gap-3"
            >
              <span
                className="block h-40 w-40 overflow-hidden rounded-full"
                style={{
                  boxShadow: isSelected
                    ? `0 0 0 6px ${player.color}`
                    : '0 0 0 4px rgba(242,228,201,0.25)',
                }}
              >
                <img src={player.photo} alt="" className="h-full w-full object-cover" />
              </span>
              {isSelected && (
                <span
                  className="absolute -right-2 -top-2 flex h-12 w-12 items-center justify-center rounded-full text-2xl font-extrabold text-board"
                  style={{ backgroundColor: player.color }}
                >
                  {rank + 1}
                </span>
              )}
              <span className="text-xl text-piece">{player.name}</span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-6">
        <button type="button" onClick={onBack} className="h-20 rounded-3xl bg-piece/20 px-8 text-xl text-piece">
          Retour
        </button>
        <button
          type="button"
          disabled={!canStart}
          onClick={() => onConfirm(selected.map((id) => players.find((p) => p.id === id)!))}
          className="h-20 rounded-3xl bg-victory px-10 text-2xl text-board disabled:opacity-40"
        >
          Jouer
        </button>
      </div>
    </div>
  );
}
