import { useState } from 'react';
import type { GameModule, PlayerId, Result } from '../games/types';
import { PlayerEditor } from '../players/PlayerEditor';
import { PlayerListScreen } from '../players/PlayerListScreen';
import type { Player } from '../players/types';
import { CalibrationScreen } from '../solfege/CalibrationScreen';
import { getHighScore, recordScore } from '../storage';
import { GameScreen } from './GameScreen';
import { MenuScreen } from './MenuScreen';
import { PlayerPickScreen } from './PlayerPickScreen';
import { ResultScreen, type ScoreInfo } from './ResultScreen';

type BotChoice = { playerId: PlayerId; level: number };

type Screen =
  | { kind: 'menu' }
  | { kind: 'players' }
  | { kind: 'editPlayer'; player?: Player }
  | { kind: 'calibration' }
  | { kind: 'pick'; game: GameModule<any, any> }
  | {
      kind: 'game';
      game: GameModule<any, any>;
      seed: number;
      players: Player[];
      bot?: BotChoice;
      soloLevel?: number;
      lossStreak: number;
    }
  | {
      kind: 'result';
      game: GameModule<any, any>;
      result: Result;
      players: Player[];
      bot?: BotChoice;
      soloLevel?: number;
      lossStreak: number;
      scoreInfo?: ScoreInfo;
    };

// Result.score est générique (games/types.ts) : le shell range le meilleur
// score par (jeu, joueur, variant) sans connaître la signification de
// `variant`, puis transmet le résultat enrichi à ResultScreen.
function computeScoreInfo(gameId: string, result: Result): ScoreInfo | undefined {
  if (result.kind !== 'win' || !result.score) return undefined;
  const previousBest = getHighScore(gameId, result.winner, result.score.variant);
  const best = recordScore(gameId, result.winner, result.score.value, result.score.variant);
  return { value: result.score.value, best, isNewBest: result.score.value > previousBest };
}

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
          onCalibrate={() => setScreen({ kind: 'calibration' })}
        />
      );

    case 'calibration':
      return (
        <CalibrationScreen
          onDone={() => setScreen({ kind: 'players' })}
          onCancel={() => setScreen({ kind: 'players' })}
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
          onConfirm={(players, bot, soloLevel) =>
            setScreen({ kind: 'game', game: screen.game, seed: randomSeed(), players, bot, soloLevel, lossStreak: 0 })
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
          soloLevel={screen.soloLevel}
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
              soloLevel: screen.soloLevel,
              lossStreak: humanLost ? screen.lossStreak + 1 : 0,
              scoreInfo: computeScoreInfo(screen.game.meta.id, result),
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
          scoreInfo={screen.scoreInfo}
          onReplay={() =>
            setScreen({
              kind: 'game',
              game: screen.game,
              seed: randomSeed(),
              players: screen.players,
              bot: screen.bot,
              soloLevel: screen.soloLevel,
              lossStreak: screen.lossStreak,
            })
          }
          onMenu={() => setScreen({ kind: 'menu' })}
        />
      );
  }
}
