import { GAMES } from '../games/registry';
import type { GameModule } from '../games/types';

interface MenuScreenProps {
  onSelectGame(game: GameModule<any, any>): void;
}

export function MenuScreen({ onSelectGame }: MenuScreenProps) {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-8 bg-board px-12">
      <h1 className="text-4xl tracking-tight text-piece">Jeux de famille</h1>
      <div className="grid grid-cols-4 gap-6">
        {GAMES.map((game) => (
          <button
            key={game.meta.id}
            type="button"
            onClick={() => onSelectGame(game)}
            className="flex h-40 w-40 flex-col items-center justify-center gap-3 rounded-3xl bg-piece text-board shadow-[0_6px_0_0_rgba(0,0,0,0.25)] transition-transform active:translate-y-1 active:shadow-[0_2px_0_0_rgba(0,0,0,0.25)]"
          >
            <img src={game.meta.icon} alt="" className="h-16 w-16" />
            <span className="text-lg">{game.meta.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
