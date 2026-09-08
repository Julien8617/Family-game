import { useState } from 'react';
import type { GameModule, PlayerId, Result } from '../games/types';
import { PlayerEditor } from '../players/PlayerEditor';
import { PlayerListScreen } from '../players/PlayerListScreen';
import type { Player } from '../players/types';
import { GameScreen } from './GameScreen';
import { MenuScreen } from './MenuScreen';
import { PlayerPickScreen } from './PlayerPickScreen';
import { ResultScreen } from './ResultScreen';

type BotChoice = { playerId: PlayerId; level: number };

type Screen =
  | { kind: 'menu' }
  | { kind: 'players' }
  | { kind: 'editPlayer'; player?: Player }
  | { kind: 'pick'; game: GameModule<any, any> }
  | {
      kind: 'game';
      game: GameModule<any, any>;
      seed: number;
      players: Player[];
      bot?: BotChoice;
      lossStreak: number;
    }
  | {
      kind: 'result';
      game: GameModule<any, any>;
      result: Result;
      players: Player[];
      bot?: BotChoice;
      lossStreak: number;
    };

function randomSeed(): number {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return bytes[0];
}

export function App() {
  const [screen, setScreen] = useState<Screen>({ kind: 'menu' });

  switch (screen.kind) {
    case 'menu':
      return (
        <MenuScreen
          onSelectGame={(game) => setScreen({ kind: 'pick', game })}
          onManagePlayers={() => setScreen({ kind: 'players' })}
        />
      );

    case 'players':
      return (
        <PlayerListScreen
          onBack={() => setScreen({ kind: 'menu' })}
          onEdit={(player) => setScreen({ kind: 'editPlayer', player })}
          onCreate={() => setScreen({ kind: 'editPlayer' })}
        />
      );

    case 'editPlayer':
      return (
        <PlayerEditor
          player={screen.player}
          onDone={() => setScreen({ kind: 'players' })}
          onCancel={() => setScreen({ kind: 'players' })}
        />
      );

    case 'pick':
      return (
        <PlayerPickScreen
          game={screen.game}
          onBack={() => setScreen({ kind: 'menu' })}
          onConfirm={(players, bot) =>
            setScreen({ kind: 'game', game: screen.game, seed: randomSeed(), players, bot, lossStreak: 0 })
          }
        />
      );

    case 'game':
      return (
        <GameScreen
          key={screen.seed}
          game={screen.game}
          players={screen.players}
          seed={screen.seed}
          bot={screen.bot}
          lossStreak={screen.lossStreak}
          onGameEnd={(result) => {
            // Série de défaites d'affilée du joueur humain face au bot —
            // remise à zéro dès qu'il gagne ou fait nul. Sert uniquement à
            // adoucir discrètement l'Imbattable du morpion (voir
            // tictactoe/bot.ts, adjustLevel) ; ne change rien pour un jeu qui
            // ne s'en sert pas.
            const humanLost =
              Boolean(screen.bot) && result.kind === 'win' && result.winner === screen.bot!.playerId;
            setScreen({
              kind: 'result',
              game: screen.game,
              result,
              players: screen.players,
              bot: screen.bot,
              lossStreak: humanLost ? screen.lossStreak + 1 : 0,
            });
          }}
          onExit={() => setScreen({ kind: 'menu' })}
        />
      );

    case 'result':
      return (
        <ResultScreen
          result={screen.result}
          players={screen.players}
          onReplay={() =>
            setScreen({
              kind: 'game',
              game: screen.game,
              seed: randomSeed(),
              players: screen.players,
              bot: screen.bot,
              lossStreak: screen.lossStreak,
            })
          }
          onMenu={() => setScreen({ kind: 'menu' })}
        />
      );
  }
}
