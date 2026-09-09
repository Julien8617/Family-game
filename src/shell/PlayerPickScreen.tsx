import { useState } from 'react';
import type { GameModule, PlayerId } from '../games/types';
import { play } from '../fx/sound';
import { getSettings, listPlayers, updateSettings } from '../storage';
import type { Player } from '../players/types';
import familyIcon from '../vendor/mode-icons/family.png';
import computerIcon from '../vendor/mode-icons/computer.png';
import { BOT_PLAYER_ID, createBotPlayer } from './bot';

interface PlayerPickScreenProps {
  game: GameModule<any, any>;
  onConfirm(players: Player[], bot?: { playerId: PlayerId; level: number }): void;
  onBack(): void;
}

type Mode = 'family' | 'computer';
type Phase = 'select' | 'color';

function randomBit(): boolean {
  const bytes = new Uint8Array(1);
  crypto.getRandomValues(bytes);
  return bytes[0] % 2 === 0;
}

export function PlayerPickScreen({ game, onConfirm, onBack }: PlayerPickScreenProps) {
  const [players] = useState(() => listPlayers());
  // Un seul profil enregistré, jeu jouable contre l'ordinateur : ce profil et
  // ce mode sont l'unique choix sensé, pas la peine de le faire taper deux
  // fois. Reste un point de départ, pas un verrou — les boutons mode/joueur
  // fonctionnent normalement ensuite.
  const singlePlayerVsBot = players.length === 1 && Boolean(game.bot);
  const [mode, setMode] = useState<Mode>(singlePlayerVsBot ? 'computer' : 'family');
  const [phase, setPhase] = useState<Phase>('select');
  const [selected, setSelected] = useState<PlayerId[]>(singlePlayerVsBot ? [players[0].id] : []);
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

  // Ordre « naturel » avant tout choix de qui commence : l'ordre de sélection
  // en famille, ou [humain, bot] contre l'ordinateur.
  function participantsInOrder(): Player[] {
    if (mode === 'computer') {
      const human = players.find((p) => p.id === selected[0]);
      const level = levels.find((l) => l.id === levelId) ?? levels[0];
      return human ? [human, createBotPlayer(level)] : [];
    }
    return selected
      .map((id) => players.find((p) => p.id === id))
      .filter((p): p is Player => p !== undefined);
  }

  function finalize(orderedPlayers: Player[]) {
    play('tap');
    if (mode === 'computer') {
      const level = levels.find((l) => l.id === levelId) ?? levels[0];
      updateSettings({ lastBotLevel: level.id });
      onConfirm(orderedPlayers, { playerId: BOT_PLAYER_ID, level: level.id });
    } else {
      onConfirm(orderedPlayers);
    }
  }

  function onPlay() {
    if (game.meta.colorLabels) {
      play('tap');
      setPhase('color');
    } else {
      finalize(participantsInOrder());
    }
  }

  if (phase === 'color' && game.meta.colorLabels) {
    const participants = participantsInOrder();
    const [firstLabel] = game.meta.colorLabels;

    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-10 bg-board px-4 py-8 sm:px-12">
        <h1 className="text-4xl text-piece">Qui commence ?</h1>

        <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
          {participants.map((participant, index) => {
            const other = participants[1 - index];
            return (
              <button
                key={participant.id}
                type="button"
                onClick={() => finalize([participant, other])}
                className="flex flex-col items-center gap-3"
              >
                <span
                  className="block h-24 w-24 overflow-hidden rounded-full sm:h-36 sm:w-36"
                  style={{ boxShadow: `0 0 0 5px ${participant.color}` }}
                >
                  <img src={participant.photo} alt="" className="h-full w-full object-cover" />
                </span>
                <span className="text-xl text-piece">{participant.name}</span>
                <span className="rounded-full bg-piece/15 px-4 py-1 text-lg text-piece">{firstLabel}</span>
              </button>
            );
          })}
        </div>

        <div className="flex gap-6">
          <button
            type="button"
            onClick={() => {
              play('tap');
              setPhase('select');
            }}
            className="h-20 rounded-3xl bg-piece/20 px-8 text-xl text-piece"
          >
            Retour
          </button>
          <button
            type="button"
            onClick={() => {
              const first = randomBit() ? participants[0] : participants[1];
              const second = first === participants[0] ? participants[1] : participants[0];
              finalize([first, second]);
            }}
            className="h-20 rounded-3xl bg-victory px-10 text-2xl text-board"
          >
            Au hasard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-center gap-6 bg-board px-4 py-8 sm:px-12">
      <h1 className="text-4xl text-piece">Qui joue ?</h1>

      {game.bot && (
        <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
          <button
            type="button"
            onClick={() => switchMode('family')}
            aria-label="En famille"
            className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-3xl bg-piece p-3 sm:h-24 sm:w-24 sm:p-4"
            style={{ boxShadow: mode === 'family' ? '0 0 0 5px #F5A623' : '0 0 0 3px rgba(242,228,201,0.25)' }}
          >
            <img src={familyIcon} alt="" className="h-full w-full object-contain" />
          </button>
          <button
            type="button"
            onClick={() => switchMode('computer')}
            aria-label="Contre l'ordinateur"
            className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-3xl bg-piece p-3 sm:h-24 sm:w-24 sm:p-4"
            style={{ boxShadow: mode === 'computer' ? '0 0 0 5px #F5A623' : '0 0 0 3px rgba(242,228,201,0.25)' }}
          >
            <img src={computerIcon} alt="" className="h-full w-full object-contain" />
          </button>
        </div>
      )}

      <div className="flex flex-1 flex-wrap items-center justify-center gap-4 sm:gap-8">
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
                className="block h-24 w-24 overflow-hidden rounded-full sm:h-40 sm:w-40"
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
        <div className="flex flex-col items-center gap-3">
          <h2 className="text-xl text-piece/70">NIVEAU</h2>
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
            {levels.map((level) => (
              <button
                key={level.id}
                type="button"
                onClick={() => {
                  play('tap');
                  setLevelId(level.id);
                }}
                aria-label={level.label}
                className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-3xl sm:h-24 sm:w-24"
                style={{
                  boxShadow:
                    levelId === level.id ? '0 0 0 5px #F5A623' : '0 0 0 3px rgba(242,228,201,0.25)',
                }}
              >
                <img
                  // Animée seulement pendant que ce niveau est sélectionné —
                  // le choix du joueur est l'action qui déclenche le
                  // mouvement, l'icône ne s'anime jamais toute seule.
                  src={levelId === level.id ? level.animatedIcon ?? level.icon : level.icon}
                  alt=""
                  className="h-full w-full"
                />
              </button>
            ))}
          </div>
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
          onClick={onPlay}
          className="h-20 rounded-3xl bg-victory px-10 text-2xl text-board disabled:opacity-40"
        >
          Jouer
        </button>
      </div>
    </div>
  );
}
