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
}

// Le temps de voir la ligne gagnante se dessiner sur le plateau avant de
// basculer sur l'écran de résultat (spec 03, critère 9 : ligne, puis photo).
const RESULT_DELAY_MS = 900;

// Spec 04 : un adversaire qui répond avant que le doigt ne soit relevé est
// déroutant, même quand le calcul est instantané (niveaux 1 et 2).
const BOT_MIN_DELAY_MS = 600;
// Laisse le temps au navigateur de peindre l'indicateur « réfléchit » avant
// de bloquer le fil principal sur une recherche synchrone (niveaux 3 et 4).
const BOT_PAINT_DELAY_MS = 80;

export function GameScreen({ game, players, seed, bot, onGameEnd }: GameScreenProps) {
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

  return (
    <div className="flex h-screen w-screen flex-col items-center bg-board px-6 py-4">
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
      <div className="flex flex-1 items-center justify-center overflow-hidden py-2">
        <div style={{ width: 'min(94vw, calc(100vh - 132px))', aspectRatio: '1 / 1' }}>
          <game.Board
            state={state}
            localPlayer={turnPlayer.id}
            players={players}
            onMove={(move) => transport.send(move)}
          />
        </div>
      </div>
    </div>
  );
}
