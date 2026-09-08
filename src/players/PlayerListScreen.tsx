import { useState } from 'react';
import { isSoundEnabled, setSoundEnabled } from '../fx/sound';
import { listPlayers } from '../storage';
import type { Player } from './types';

interface PlayerListScreenProps {
  onBack(): void;
  onEdit(player: Player): void;
  onCreate(): void;
}

function SoundToggle() {
  const [enabled, setEnabled] = useState(() => isSoundEnabled());

  return (
    <button
      type="button"
      onClick={() => {
        const next = !enabled;
        setSoundEnabled(next);
        setEnabled(next);
      }}
      aria-label={enabled ? 'Couper le son' : 'Activer le son'}
      aria-pressed={enabled}
      className="flex h-16 w-28 items-center rounded-full p-2 transition-colors"
      style={{ backgroundColor: enabled ? '#4F8F6B' : 'rgba(242,228,201,0.2)' }}
    >
      <span
        className="flex h-12 w-12 items-center justify-center rounded-full bg-piece text-2xl leading-none transition-transform"
        style={{ transform: enabled ? 'translateX(48px)' : 'translateX(0)' }}
      >
        {enabled ? '🔊' : '🔇'}
      </span>
    </button>
  );
}

export function PlayerListScreen({ onBack, onEdit, onCreate }: PlayerListScreenProps) {
  const [players] = useState(() => listPlayers());

  return (
    <div className="flex h-full w-full flex-col items-center gap-10 bg-board px-4 py-10 sm:px-12">
      <div className="flex w-full items-center justify-between">
        <button type="button" onClick={onBack} className="h-16 rounded-2xl bg-piece/20 px-6 text-lg text-piece">
          ← Menu
        </button>
        <h1 className="text-4xl text-piece">Joueurs</h1>
        <SoundToggle />
      </div>

      <div className="flex flex-1 flex-wrap items-center justify-center gap-4 sm:gap-8">
        {players.map((player) => (
          <button
            key={player.id}
            type="button"
            onClick={() => onEdit(player)}
            className="flex flex-col items-center gap-3"
          >
            <span
              className="block h-24 w-24 overflow-hidden rounded-full sm:h-40 sm:w-40"
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
          className="flex h-24 w-24 flex-col items-center justify-center rounded-full border-4 border-dashed border-piece/40 text-piece sm:h-40 sm:w-40"
          aria-label="Ajouter un joueur"
        >
          <span className="text-5xl leading-none">+</span>
        </button>
      </div>

      {/* Repère de version pour vérifier qu'un déploiement est bien arrivé sur
          l'appareil — voir CHANGELOG.md. */}
      <p className="text-xs text-piece/40">
        {__APP_COMMIT__} · {__APP_BUILD_DATE__.slice(0, 16).replace('T', ' ')}
      </p>
    </div>
  );
}
