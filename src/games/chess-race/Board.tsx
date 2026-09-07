import { useEffect, useState } from 'react';
import type { BoardProps } from '../types';
import { algebraic, colOf, colorOf, legalMovesFrom, rowOf, SIZE } from './logic';
import type { ChessRaceMove, ChessRaceState } from './logic';

// Couleurs de pièces fixes, comme un vrai jeu d'échecs — blancs et noirs, pas
// la couleur de profil du joueur (celle-ci sert déjà à identifier qui joue
// dans la barre de tour et l'écran de résultat).
const WHITE_PIECE = '#FAF6EC';
const BLACK_PIECE = '#201C16';

// range(0, 8) -> [0..7] ; range(7, -1) -> [7..0]. Sert à parcourir lignes et
// colonnes dans un sens ou dans l'autre selon l'orientation du plateau.
function range(start: number, end: number): number[] {
  const result: number[] = [];
  if (start <= end) {
    for (let i = start; i < end; i++) result.push(i);
  } else {
    for (let i = start; i > end; i--) result.push(i);
  }
  return result;
}

export function Board({ state, localPlayer, onMove }: BoardProps<ChessRaceState, ChessRaceMove>) {
  const [selected, setSelected] = useState<number | null>(null);

  // Une nouvelle référence de state = un vrai coup a été appliqué (le shell
  // ignore les coups invalides sans changer l'état) : la sélection retombe.
  // Une tentative invalide, elle, laisse la pièce sélectionnée — on peut
  // réessayer tout de suite.
  useEffect(() => {
    setSelected(null);
  }, [state]);

  const legalTargets = selected !== null ? legalMovesFrom(state, selected) : [];
  const [whiteId] = state.players;

  // Orientation fixe pour toute la partie, pas une rotation à chaque tour :
  // `localPlayer` (GameScreen) est stable — l'humain contre l'ordinateur,
  // un repère arbitraire en famille (l'iPad se partage, personne n'est plus
  // « local » qu'un autre). Son camp reste en bas, quelle que soit sa couleur.
  const flipped = colorOf(state, localPlayer) === 'black';

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

  const rowOrder = flipped ? range(0, SIZE) : range(SIZE - 1, -1);
  const colOrder = flipped ? range(SIZE - 1, -1) : range(0, SIZE);
  const cells: number[] = [];
  for (const row of rowOrder) {
    for (const col of colOrder) {
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
        const isWhitePiece = occupant === whiteId;

        // Les rangées/colonnes d'arrivée et les coordonnées se collent au
        // bord *visuel* du plateau (haut/bas/gauche), pas au numéro de case
        // brut — sinon elles se retrouveraient à l'intérieur du plateau une
        // fois celui-ci retourné.
        const isVisualTopRow = flipped ? row === 0 : row === SIZE - 1;
        const isVisualBottomRow = flipped ? row === SIZE - 1 : row === 0;
        const isVisualLeftCol = flipped ? col === SIZE - 1 : col === 0;

        return (
          <button
            key={cell}
            type="button"
            onClick={() => handleTap(cell)}
            aria-label={algebraic(cell)}
            className={`relative flex items-center justify-center ${isLight ? 'bg-squareLight' : 'bg-squareDark'}`}
          >
            {row === SIZE - 1 && (
              <span className={`absolute inset-x-0 h-1.5 bg-chessWhite ${isVisualTopRow ? 'top-0' : 'bottom-0'}`} />
            )}
            {row === 0 && (
              <span className={`absolute inset-x-0 h-1.5 bg-chessBlack ${isVisualTopRow ? 'top-0' : 'bottom-0'}`} />
            )}

            {isVisualLeftCol && (
              <span className={`absolute left-1 top-1 text-[10px] font-bold ${labelColor}`}>{row + 1}</span>
            )}
            {isVisualBottomRow && (
              <span className={`absolute bottom-1 right-1 text-[10px] font-bold ${labelColor}`}>
                {String.fromCharCode(97 + col)}
              </span>
            )}

            {occupant && <Pawn color={isWhitePiece ? WHITE_PIECE : BLACK_PIECE} dark={!isWhitePiece} />}

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

function Pawn({ color, dark }: { color: string; dark: boolean }) {
  // Contour clair sur les pièces noires (sinon elles se fondent dans la case
  // foncée), contour sombre sur les blanches — même silhouette de pion
  // classique des deux côtés.
  const stroke = dark ? 'rgba(250,246,236,0.35)' : '#1E3D34';

  return (
    <svg viewBox="0 0 24 24" className="h-[66%] w-[66%]" aria-hidden>
      {/* Silhouette de pion classique (tête, col, corps évasé, socle) — un
          vrai échiquier, sans aucun ornement « poussin » sur la pièce
          elle-même. Le thème reste dans le nom du jeu et les icônes de niveau. */}
      <path
        d="M9.2 19 C9.0 14.2 9.6 11.6 10.6 10.3 C11.0 9.8 13.0 9.8 13.4 10.3 C14.4 11.6 15.0 14.2 14.8 19 Z"
        fill={color}
        stroke={stroke}
        strokeWidth="0.4"
        strokeLinejoin="round"
      />
      <rect x="7" y="18.6" width="10" height="2.6" rx="1.3" fill={color} stroke={stroke} strokeWidth="0.4" />
      <circle cx="12" cy="7" r="3.2" fill={color} stroke={stroke} strokeWidth="0.4" />
    </svg>
  );
}
