import { useState } from 'react';
import type { GameModule, PlayerId } from '../games/types';
import { play } from '../fx/sound';
import { getSettings, listPlayers, updateSettings } from '../storage';
import type { Player } from '../players/types';
import { BOT_PLAYER_ID, createBotPlayer } from './bot';

interface PlayerPickScreenProps {
  game: GameModule<any, any>;
  onConfirm(players: Player[], bot?: { playerId: PlayerId; level: number }): void;
  onBack(): void;
}

type Mode = 'family' | 'computer';

export function PlayerPickScreen({ game, onConfirm, onBack }: PlayerPickScreenProps) {
  const [players] = useState(() => listPlayers());
  const [mode, setMode] = useState<Mode>('family');
  const [selected, setSelected] = useState<PlayerId[]>([]);
  const levels = game.bot?.levels ?? [];
  const [levelId, setLevelId] = useState<number>(() => {
    const stored = getSettings().lastBotLevel;
    return levels.find((l) => l.id === stored)?.id ?? levels[0]?.id ?? 1;
  });

  const maxSelectable = mode === 'computer' ? 1 : game.meta.maxPlayers;

  function toggle(id: PlayerId) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (mode === 'computer') return [id];
      if (prev.length >= maxSelectable) return prev;
      return [...prev, id];
    });
  }

  function switchMode(next: Mode) {
    play('tap');
    setMode(next);
    setSelected((prev) => (next === 'computer' ? prev.slice(0, 1) : prev));
  }

  const canStart =
    mode === 'family'
      ? selected.length >= game.meta.minPlayers && selected.length <= game.meta.maxPlayers
      : selected.length === 1;

  function confirm() {
    play('tap');
    const chosen = selected.map((id) => players.find((p) => p.id === id)!);
    if (mode === 'computer') {
      const level = levels.find((l) => l.id === levelId) ?? levels[0];
      updateSettings({ lastBotLevel: level.id });
      onConfirm([chosen[0], createBotPlayer(level)], { playerId: BOT_PLAYER_ID, level: level.id });
    } else {
      onConfirm(chosen);
    }
  }

  return (
    <div className="flex h-screen w-screen flex-col items-center gap-6 bg-board px-12 py-8">
      <h1 className="text-4xl text-piece">Qui joue ?</h1>

      {game.bot && (
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => switchMode('family')}
            className={`h-16 rounded-2xl px-6 text-lg ${
              mode === 'family' ? 'bg-piece text-board' : 'bg-piece/15 text-piece'
            }`}
          >
            En famille
          </button>
          <button
            type="button"
            onClick={() => switchMode('computer')}
            className={`h-16 rounded-2xl px-6 text-lg ${
              mode === 'computer' ? 'bg-piece text-board' : 'bg-piece/15 text-piece'
            }`}
          >
            Contre l'ordinateur
          </button>
        </div>
      )}

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
              {isSelected && mode === 'family' && (
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

      {mode === 'computer' && (
        <div className="flex gap-6">
          {levels.map((level) => (
            <button
              key={level.id}
              type="button"
              onClick={() => {
                play('tap');
                setLevelId(level.id);
              }}
              className="flex flex-col items-center gap-2"
            >
              <span
                className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl"
                style={{
                  boxShadow:
                    levelId === level.id ? '0 0 0 5px #F5A623' : '0 0 0 3px rgba(242,228,201,0.25)',
                }}
              >
                <img src={level.icon} alt="" className="h-full w-full" />
              </span>
              <span className="text-lg text-piece">{level.label}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-6">
        <button
          type="button"
          onClick={() => {
            play('tap');
            onBack();
          }}
          className="h-20 rounded-3xl bg-piece/20 px-8 text-xl text-piece"
        >
          Retour
        </button>
        <button
          type="button"
          disabled={!canStart}
          onClick={confirm}
          className="h-20 rounded-3xl bg-victory px-10 text-2xl text-board disabled:opacity-40"
        >
          Jouer
        </button>
      </div>
    </div>
  );
}
