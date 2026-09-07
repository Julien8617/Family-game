import { useEffect, useRef, useState } from 'react';
import type { GameModule, PlayerId, Result } from '../games/types';
import { play } from '../fx/sound';
import { createLocalTransport } from '../net/localTransport';
import type { Player } from '../players/types';

interface GameScreenProps {
  game: GameModule<any, any>;
  players: Player[];
  seed: number;
  bot?: { playerId: PlayerId; level: number };
  onGameEnd(result: Result, finalState: any): void;
  onExit(): void;
}

// Le temps de voir la ligne gagnante se dessiner sur le plateau avant de
// basculer sur l'écran de résultat (spec 03, critère 9 : ligne, puis photo).
const RESULT_DELAY_MS = 900;

// Rester appuyé, pas taper : un enfant qui touche l'écran par mégarde ne
// doit jamais couper une partie en cours.
const EXIT_HOLD_MS = 2000;

// Spec 04 : un adversaire qui répond avant que le doigt ne soit relevé est
// déroutant, même quand le calcul est instantané (niveaux 1 et 2).
const BOT_MIN_DELAY_MS = 600;
// Laisse le temps au navigateur de peindre l'indicateur « réfléchit » avant
// de bloquer le fil principal sur une recherche synchrone (niveaux 3 et 4).
const BOT_PAINT_DELAY_MS = 80;

export function GameScreen({ game, players, seed, bot, onGameEnd, onExit }: GameScreenProps) {
  const [transport] = useState(() => createLocalTransport());
  const [state, setState] = useState<any>(() =>
    game.createState(
      players.map((p) => p.id),
      seed,
    ),
  );
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const [thinking, setThinking] = useState(false);

  useEffect(() => {
    return transport.onMove((move) => {
      const prev = stateRef.current;

      if (!game.isValidMove(prev, move)) {
        play('invalid');
        return;
      }

      const next = game.applyMove(prev, move);
      const result = game.getResult(next);

      if (result) {
        play(result.kind === 'win' ? 'win' : 'draw');
      } else {
        play('move');
        if (game.currentPlayer(next) !== game.currentPlayer(prev)) {
          play('turn');
        }
      }

      setState(next);
    });
  }, [transport, game]);

  useEffect(() => {
    const result = game.getResult(state);
    if (!result) return;
    const timer = setTimeout(() => onGameEnd(result, state), RESULT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [state, game, onGameEnd]);

  // Orchestration du bot : générique, indépendante des règles du jeu (elle
  // ne fait qu'appeler game.bot.chooseMove et respecter le budget d'affichage
  // — le shell ne sait toujours rien du morpion ni des poussins).
  useEffect(() => {
    if (!bot || !game.bot) return;
    if (game.currentPlayer(state) !== bot.playerId) return;
    if (game.getResult(state)) return;

    let cancelled = false;
    let sendTimer: ReturnType<typeof setTimeout> | undefined;
    setThinking(true);

    const paintTimer = setTimeout(() => {
      const start = performance.now();
      const move = game.bot!.chooseMove(state, bot.level);
      const elapsed = performance.now() - start;
      const remaining = Math.max(0, BOT_MIN_DELAY_MS - elapsed);
      sendTimer = setTimeout(() => {
        if (cancelled) return;
        setThinking(false);
        transport.send(move);
      }, remaining);
    }, BOT_PAINT_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(paintTimer);
      if (sendTimer) clearTimeout(sendTimer);
      setThinking(false);
    };
  }, [state, bot, game, transport]);

  const turnId = game.currentPlayer(state);
  const turnPlayer = players.find((p) => p.id === turnId) ?? players[0];

  // Qui « tient l'appareil », fixe pour toute la partie — pas le joueur au
  // trait, qui change à chaque coup. Contre l'ordinateur, c'est toujours
  // l'humain (le bot n'est jamais assis devant l'écran). En famille, l'iPad
  // se partage : personne n'est plus « local » qu'un autre, donc un repère
  // arbitraire mais stable (players[0]) — un jeu qui s'en sert pour orienter
  // son plateau (spec 04) obtient ainsi une orientation fixe, pas une
  // rotation à chaque tour.
  const sharedDevice = !bot;
  const localPlayer = bot ? players.find((p) => p.id !== bot.playerId)!.id : players[0].id;

  // Deux humains autour d'un même iPad, dans un jeu à deux camps orientés :
  // chacun reçoit son propre repère (photo/nom), orienté vers lui, plutôt
  // qu'une seule barre lisible d'un seul côté de la table. Sans ça (bot, ou
  // jeu sans camps comme le morpion), la barre unique habituelle suffit.
  const dualSided = sharedDevice && Boolean(game.meta.colorLabels);

  return (
    <div className="relative flex h-screen w-screen flex-col items-center bg-board px-6 py-4">
      <ExitButton onExit={onExit} />

      {dualSided ? (
        <PlayerBadge player={players[1]} active={turnId === players[1].id} rotated />
      ) : (
        <div className="flex items-center gap-3 rounded-full bg-piece/10 px-5 py-2">
          <img
            src={turnPlayer.photo}
            alt=""
            className="h-11 w-11 rounded-full object-cover"
            style={{ boxShadow: `0 0 0 3px ${turnPlayer.color}` }}
          />
          <span className={`text-xl text-piece ${thinking ? 'animate-pulse' : ''}`}>
            {thinking ? `${turnPlayer.name} réfléchit…` : `Tour de ${turnPlayer.name}`}
          </span>
        </div>
      )}

      <div className="flex flex-1 items-center justify-center overflow-hidden py-2">
        <div
          style={{
            width: `min(94vw, calc(100vh - ${dualSided ? 168 : 132}px))`,
            aspectRatio: '1 / 1',
          }}
        >
          <game.Board
            state={state}
            localPlayer={localPlayer}
            sharedDevice={sharedDevice}
            players={players}
            onMove={(move) => transport.send(move)}
          />
        </div>
      </div>

      {dualSided && <PlayerBadge player={players[0]} active={turnId === players[0].id} />}
    </div>
  );
}

function PlayerBadge({ player, active, rotated }: { player: Player; active: boolean; rotated?: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-full px-5 py-2 transition-opacity ${
        active ? 'bg-piece/15 opacity-100' : 'bg-piece/5 opacity-50'
      }`}
      style={rotated ? { transform: 'rotate(180deg)' } : undefined}
    >
      <img
        src={player.photo}
        alt=""
        className="h-9 w-9 rounded-full object-cover"
        style={{ boxShadow: active ? `0 0 0 3px ${player.color}` : '0 0 0 2px rgba(242,228,201,0.25)' }}
      />
      <span className="text-lg text-piece">{player.name}</span>
    </div>
  );
}

// Bouton « Quitter » — placé avec de la marge (pas dans l'angle exact de
// l'écran), donc un anneau de progression complet reste toujours visible en
// entier pendant le maintien.
const EXIT_BUTTON_RADIUS = 34;
const EXIT_BUTTON_CIRCUMFERENCE = 2 * Math.PI * EXIT_BUTTON_RADIUS;

function ExitButton({ onExit }: { onExit(): void }) {
  const [progress, setProgress] = useState(0);
  const frameRef = useRef<number>();

  function start() {
    const startedAt = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startedAt;
      const p = Math.min(1, elapsed / EXIT_HOLD_MS);
      setProgress(p);
      if (p >= 1) {
        play('tap');
        onExit();
        return;
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
  }

  function cancel() {
    if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
    setProgress(0);
  }

  useEffect(() => {
    return () => {
      if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <button
      type="button"
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      aria-label="Quitter la partie (rester appuyé)"
      className="absolute left-6 top-6 flex h-20 w-20 items-center justify-center rounded-full bg-piece/10 opacity-60"
    >
      <svg viewBox="0 0 80 80" className="absolute h-full w-full -rotate-90" aria-hidden>
        <circle cx="40" cy="40" r={EXIT_BUTTON_RADIUS} fill="none" stroke="rgba(242,228,201,0.2)" strokeWidth="5" />
        <circle
          cx="40"
          cy="40"
          r={EXIT_BUTTON_RADIUS}
          fill="none"
          stroke="#F5A623"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={EXIT_BUTTON_CIRCUMFERENCE}
          strokeDashoffset={EXIT_BUTTON_CIRCUMFERENCE * (1 - progress)}
        />
      </svg>
      <svg viewBox="0 0 24 24" className="h-8 w-8" aria-hidden>
        <g stroke="#F2E4C9" strokeWidth="2.4" strokeLinecap="round">
          <line x1="7" y1="7" x2="17" y2="17" />
          <line x1="17" y1="7" x2="7" y2="17" />
        </g>
      </svg>
    </button>
  );
}
