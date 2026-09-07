import { useEffect, useState } from 'react';
import type { BoardProps } from '../types';
import { algebraic, colOf, legalMovesFrom, rowOf, SIZE } from './logic';
import type { ChessRaceMove, ChessRaceState } from './logic';

// Couleurs d'équipe fixes, comme un vrai jeu d'échecs — pas la couleur de
// profil du joueur (celle-ci sert déjà à identifier qui joue dans la barre de
// tour et l'écran de résultat).
const YELLOW = '#E3B23C';
const RED = '#C94F3D';

export function Board({ state, onMove }: BoardProps<ChessRaceState, ChessRaceMove>) {
  const [selected, setSelected] = useState<number | null>(null);

  // Une nouvelle référence de state = un vrai coup a été appliqué (le shell
  // ignore les coups invalides sans changer l'état) : la sélection retombe.
  // Une tentative invalide, elle, laisse la pièce sélectionnée — on peut
  // réessayer tout de suite.
  useEffect(() => {
    setSelected(null);
  }, [state]);

  const legalTargets = selected !== null ? legalMovesFrom(state, selected) : [];
  const [yellowId] = state.players;

  function handleTap(cell: number) {
    const occupant = state.board[cell];

    if (selected === null) {
      if (occupant === state.turn) setSelected(cell);
      return; // simple sélection, pas une tentative de coup
    }
    if (cell === selected) {
      setSelected(null);
      return;
    }
    if (occupant === state.turn) {
      setSelected(cell);
      return;
    }
    // Case interdite ou légale : GameScreen tranche et joue le son adéquat.
    onMove({ from: selected, to: cell });
  }

  const cells: number[] = [];
  for (let row = SIZE - 1; row >= 0; row--) {
    for (let col = 0; col < SIZE; col++) {
      cells.push(row * SIZE + col);
    }
  }

  return (
    <div className="grid aspect-square h-full grid-cols-8 grid-rows-8 overflow-hidden rounded-3xl shadow-[0_6px_0_0_rgba(0,0,0,0.25)]">
      {cells.map((cell) => {
        const row = rowOf(cell);
        const col = colOf(cell);
        const isLight = (row + col) % 2 === 0;
        const occupant = state.board[cell];
        const isSelected = selected === cell;
        const isTarget = legalTargets.includes(cell);
        const isCaptureTarget = isTarget && occupant !== null;
        const labelColor = isLight ? 'text-squareDark/70' : 'text-squareLight/70';

        return (
          <button
            key={cell}
            type="button"
            onClick={() => handleTap(cell)}
            aria-label={algebraic(cell)}
            className={`relative flex items-center justify-center ${isLight ? 'bg-squareLight' : 'bg-squareDark'}`}
          >
            {row === SIZE - 1 && <span className="absolute inset-x-0 top-0 h-1.5 bg-chickYellow" />}
            {row === 0 && <span className="absolute inset-x-0 bottom-0 h-1.5 bg-chickRed" />}

            {col === 0 && (
              <span className={`absolute left-1 top-1 text-[10px] font-bold ${labelColor}`}>{row + 1}</span>
            )}
            {row === 0 && (
              <span className={`absolute bottom-1 right-1 text-[10px] font-bold ${labelColor}`}>
                {String.fromCharCode(97 + col)}
              </span>
            )}

            {occupant && <Chick color={occupant === yellowId ? YELLOW : RED} />}

            {isSelected && <span className="absolute inset-1 rounded-xl ring-4 ring-victory ring-inset" />}
            {isTarget && !isCaptureTarget && (
              <span className="absolute h-[28%] w-[28%] rounded-full bg-victory/70" />
            )}
            {isCaptureTarget && <span className="absolute inset-1 rounded-full ring-4 ring-victory" />}
          </button>
        );
      })}
    </div>
  );
}

function Chick({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[62%] w-[62%]" aria-hidden>
      <circle cx="12" cy="15" r="7" fill={color} />
      <circle cx="12" cy="7" r="4.5" fill={color} />
      <path d="M16 6.5l4 1.5-4 1.5z" fill="#1E3D34" />
      <circle cx="13.5" cy="6" r="0.9" fill="#1E3D34" />
    </svg>
  );
}
