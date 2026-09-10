import { useState } from 'react';
import { GAME_GROUPS, GAMES } from '../games/registry';
import type { GameModule } from '../games/types';
import { play } from '../fx/sound';
import { listPlayers } from '../storage';
import settingsIcon from './settings-icon.svg';

interface MenuScreenProps {
  onSelectGame(game: GameModule<any, any>): void;
  onManagePlayers(): void;
}

// Un jeu contre l'ordinateur n'a besoin que d'un seul profil réel — le bot
// fabriqué par le shell comble le reste (spec 04). Partagé entre la tuile de
// jeu et la tuile de groupe (disponible si au moins un jeu du groupe l'est).
function isAvailable(game: GameModule<any, any>, playerCount: number): boolean {
  const required = game.bot ? 1 : game.meta.minPlayers;
  return playerCount - required >= 0;
}

function GameTile({
  game,
  playerCount,
  onSelect,
}: {
  game: GameModule<any, any>;
  playerCount: number;
  onSelect(): void;
}) {
  const required = game.bot ? 1 : game.meta.minPlayers;
  const missing = required - playerCount;
  const available = missing <= 0;
  return (
    <button
      type="button"
      disabled={!available}
      onClick={() => {
        play('tap');
        onSelect();
      }}
      className={[
        'flex h-32 w-28 flex-col items-center justify-center gap-1 rounded-3xl bg-piece px-1 text-board shadow-[0_6px_0_0_rgba(0,0,0,0.25)] transition-transform sm:h-40 sm:w-40 sm:gap-3 sm:px-0',
        available
          ? 'active:translate-y-1 active:shadow-[0_2px_0_0_rgba(0,0,0,0.25)]'
          : 'cursor-not-allowed opacity-40',
      ].join(' ')}
    >
      <img src={game.meta.icon} alt="" className="h-10 w-10 sm:h-16 sm:w-16" />
      <span className="text-center text-xs leading-tight sm:text-lg">{game.meta.title}</span>
      {!available && (
        <span className="px-2 text-center text-xs leading-tight">
          Ajoute {missing} joueur{missing > 1 ? 's' : ''}
        </span>
      )}
    </button>
  );
}

export function MenuScreen({ onSelectGame, onManagePlayers }: MenuScreenProps) {
  const [players] = useState(() => listPlayers());
  // Sous-menu ouvert (spec 05, « Regroupement dans le menu ») — état local à
  // MenuScreen, aucun changement d'App.tsx : c'est une fonctionnalité de
  // menu, pas une règle de jeu qui remonte dans le shell.
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  if (players.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-8 bg-board px-4 sm:px-12">
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

  // Sous-menu d'un groupe (« Musique », spec 05) : mêmes tuiles que le menu
  // principal, retour par le même geste que partout ailleurs
  // (PlayerPickScreen, « Qui commence ? »).
  if (openGroup) {
    const group = GAME_GROUPS[openGroup];
    const groupGames = GAMES.filter((g) => g.meta.groupId === openGroup);
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-8 bg-board px-4 sm:px-12">
        <h1 className="text-4xl tracking-tight text-piece">{group.title}</h1>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
          {groupGames.map((game) => (
            <GameTile
              key={game.meta.id}
              game={game}
              playerCount={players.length}
              onSelect={() => onSelectGame(game)}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            play('tap');
            setOpenGroup(null);
          }}
          className="h-20 rounded-3xl bg-piece/20 px-8 text-xl text-piece"
        >
          Retour
        </button>
      </div>
    );
  }

  const ungroupedGames = GAMES.filter((g) => !g.meta.groupId);
  const groupIds = Object.keys(GAME_GROUPS).filter((id) => GAMES.some((g) => g.meta.groupId === id));

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-8 bg-board px-4 sm:px-12">
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
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
        {ungroupedGames.map((game) => (
          <GameTile
            key={game.meta.id}
            game={game}
            playerCount={players.length}
            onSelect={() => onSelectGame(game)}
          />
        ))}
        {groupIds.map((id) => {
          const group = GAME_GROUPS[id];
          const groupGames = GAMES.filter((g) => g.meta.groupId === id);
          const available = groupGames.some((g) => isAvailable(g, players.length));
          return (
            <button
              key={id}
              type="button"
              disabled={!available}
              onClick={() => {
                play('tap');
                setOpenGroup(id);
              }}
              className={[
                'flex h-32 w-28 flex-col items-center justify-center gap-1 rounded-3xl bg-piece px-1 text-board shadow-[0_6px_0_0_rgba(0,0,0,0.25)] transition-transform sm:h-40 sm:w-40 sm:gap-3 sm:px-0',
                available
                  ? 'active:translate-y-1 active:shadow-[0_2px_0_0_rgba(0,0,0,0.25)]'
                  : 'cursor-not-allowed opacity-40',
              ].join(' ')}
            >
              <img src={group.icon} alt="" className="h-10 w-10 sm:h-16 sm:w-16" />
              <span className="text-center text-xs leading-tight sm:text-lg">{group.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
