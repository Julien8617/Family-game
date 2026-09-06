import { useState } from 'react';
import { listPlayers } from './storage';
import type { Player } from './types';

interface PlayerListScreenProps {
  onBack(): void;
  onEdit(player: Player): void;
  onCreate(): void;
}

export function PlayerListScreen({ onBack, onEdit, onCreate }: PlayerListScreenProps) {
  const [players] = useState(() => listPlayers());

  return (
    <div className="flex h-screen w-screen flex-col items-center gap-10 bg-board px-12 py-10">
      <div className="flex w-full items-center justify-between">
        <button type="button" onClick={onBack} className="h-16 rounded-2xl bg-piece/20 px-6 text-lg text-piece">
          ← Menu
        </button>
        <h1 className="text-4xl text-piece">Joueurs</h1>
        <span className="w-24" aria-hidden />
      </div>

      <div className="flex flex-1 flex-wrap items-center justify-center gap-8">
        {players.map((player) => (
          <button
            key={player.id}
            type="button"
            onClick={() => onEdit(player)}
            className="flex flex-col items-center gap-3"
          >
            <span
              className="block h-40 w-40 overflow-hidden rounded-full"
              style={{ boxShadow: `0 0 0 5px ${player.color}` }}
            >
              <img src={player.photo} alt="" className="h-full w-full object-cover" />
            </span>
            <span className="text-xl text-piece">{player.name}</span>
          </button>
        ))}

        <button
          type="button"
          onClick={onCreate}
          className="flex h-40 w-40 flex-col items-center justify-center rounded-full border-4 border-dashed border-piece/40 text-piece"
          aria-label="Ajouter un joueur"
        >
          <span className="text-5xl leading-none">+</span>
        </button>
      </div>
    </div>
  );
}
