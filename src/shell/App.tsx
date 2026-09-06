import { useCallback, useState } from 'react';
import type { GameModule, Result } from '../games/types';
import { FIXED_PLAYERS } from '../players/fixedPlayers';
import { GameScreen } from './GameScreen';
import { MenuScreen } from './MenuScreen';
import { ResultScreen } from './ResultScreen';

type Screen =
  | { kind: 'menu' }
  | { kind: 'game'; game: GameModule<any, any>; seed: number }
  | { kind: 'result'; game: GameModule<any, any>; result: Result };

function randomSeed(): number {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return bytes[0];
}

export function App() {
  const [screen, setScreen] = useState<Screen>({ kind: 'menu' });

  const handleSelectGame = useCallback((game: GameModule<any, any>) => {
    setScreen({ kind: 'game', game, seed: randomSeed() });
  }, []);

  const handleGameEnd = useCallback((game: GameModule<any, any>, result: Result) => {
    setScreen({ kind: 'result', game, result });
  }, []);

  const handleReplay = useCallback((game: GameModule<any, any>) => {
    setScreen({ kind: 'game', game, seed: randomSeed() });
  }, []);

  const handleMenu = useCallback(() => setScreen({ kind: 'menu' }), []);

  switch (screen.kind) {
    case 'menu':
      return <MenuScreen onSelectGame={handleSelectGame} />;
    case 'game':
      return (
        <GameScreen
          key={screen.seed}
          game={screen.game}
          players={FIXED_PLAYERS}
          seed={screen.seed}
          onGameEnd={(result) => handleGameEnd(screen.game, result)}
        />
      );
    case 'result':
      return (
        <ResultScreen
          result={screen.result}
          players={FIXED_PLAYERS}
          onReplay={() => handleReplay(screen.game)}
          onMenu={handleMenu}
        />
      );
  }
}
