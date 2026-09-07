import { useState } from 'react';
import { GAMES } from '../games/registry';
import type { GameModule } from '../games/types';
import { play } from '../fx/sound';
import { listPlayers } from '../storage';
import settingsIcon from './settings-icon.svg';

interface MenuScreenProps {
  onSelectGame(game: GameModule<any, any>): void;
  onManagePlayers(): void;
}

export function MenuScreen({ onSelectGame, onManagePlayers }: MenuScreenProps) {
  const [players] = useState(() => listPlayers());

  if (players.length === 0) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-8 bg-board px-12">
        <h1 className="text-4xl tracking-tight text-piece">Jeux de famille</h1>
        <p className="text-xl text-piece/80">Ajoute le premier joueur pour commencer.</p>
        <button
          type="button"
          onClick={() => {
            play('tap');
            onManagePlayers();
          }}
          className="h-24 rounded-3xl bg-victory px-10 text-2xl text-board shadow-[0_6px_0_0_rgba(0,0,0,0.25)] transition-transform active:translate-y-1 active:shadow-[0_2px_0_0_rgba(0,0,0,0.25)]"
        >
          Ajouter un joueur
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen w-screen flex-col items-center justify-center gap-8 bg-board px-12">
      <button
        type="button"
        onClick={() => {
          play('tap');
          onManagePlayers();
        }}
        aria-label="Gérer les joueurs"
        className="absolute right-6 top-6 flex h-20 w-20 items-center justify-center rounded-full opacity-60"
      >
        <img src={settingsIcon} alt="" className="h-10 w-10" />
      </button>

      <h1 className="text-4xl tracking-tight text-piece">Jeux de famille</h1>
      <div className="grid grid-cols-4 gap-6">
        {GAMES.map((game) => {
          // Un jeu contre l'ordinateur n'a besoin que d'un seul profil réel —
          // le bot fabriqué par le shell comble le reste (spec 04).
          const requiredPlayers = game.bot ? 1 : game.meta.minPlayers;
          const missing = requiredPlayers - players.length;
          const available = missing <= 0;
          return (
            <button
              key={game.meta.id}
              type="button"
              disabled={!available}
              onClick={() => {
                play('tap');
                onSelectGame(game);
              }}
              className={[
                'flex h-40 w-40 flex-col items-center justify-center gap-3 rounded-3xl bg-piece text-board shadow-[0_6px_0_0_rgba(0,0,0,0.25)] transition-transform',
                available
                  ? 'active:translate-y-1 active:shadow-[0_2px_0_0_rgba(0,0,0,0.25)]'
                  : 'cursor-not-allowed opacity-40',
              ].join(' ')}
            >
              <img src={game.meta.icon} alt="" className="h-16 w-16" />
              <span className="text-lg">{game.meta.title}</span>
              {!available && (
                <span className="px-2 text-center text-xs leading-tight">
                  Ajoute {missing} joueur{missing > 1 ? 's' : ''}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
