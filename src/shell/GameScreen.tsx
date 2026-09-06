import { useEffect, useState } from 'react';
import type { GameModule, Result } from '../games/types';
import { createLocalTransport } from '../net/localTransport';
import type { Player } from '../players/types';

interface GameScreenProps {
  game: GameModule<any, any>;
  players: Player[];
  seed: number;
  onGameEnd(result: Result, finalState: any): void;
}

export function GameScreen({ game, players, seed, onGameEnd }: GameScreenProps) {
  const [transport] = useState(() => createLocalTransport());
  const [state, setState] = useState<any>(() =>
    game.createState(
      players.map((p) => p.id),
      seed,
    ),
  );

  useEffect(() => {
    return transport.onMove((move) => {
      setState((prev: any) => (game.isValidMove(prev, move) ? game.applyMove(prev, move) : prev));
    });
  }, [transport, game]);

  useEffect(() => {
    const result = game.getResult(state);
    if (result) onGameEnd(result, state);
  }, [state, game, onGameEnd]);

  const turnId = game.currentPlayer(state);
  const turnPlayer = players.find((p) => p.id === turnId) ?? players[0];

  return (
    <div className="flex h-screen w-screen flex-col items-center bg-board px-8 py-6">
      <div className="flex items-center gap-4 rounded-full bg-piece/10 px-6 py-3">
        <img
          src={turnPlayer.photo}
          alt=""
          className="h-14 w-14 rounded-full object-cover"
          style={{ boxShadow: `0 0 0 3px ${turnPlayer.color}` }}
        />
        <span className="text-2xl text-piece">Tour de {turnPlayer.name}</span>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <div className="h-[600px] w-[600px]">
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
