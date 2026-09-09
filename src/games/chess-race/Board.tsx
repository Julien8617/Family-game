import { useEffect, useState } from 'react';
import type { BoardProps } from '../types';
import { algebraic, colOf, colorOf, legalMovesFrom, rowOf, SIZE } from './logic';
import type { ChessRaceMove, ChessRaceState } from './logic';
import { Pawn } from './Pawn';
import { pawnSkin } from './pawnSkin';

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

export function Board({
  state,
  localPlayer,
  sharedDevice,
  players,
  onMove,
}: BoardProps<ChessRaceState, ChessRaceMove>) {
  const [selected, setSelected] = useState<number | null>(null);

  // Une nouvelle référence de state = un vrai coup a été appliqué (le shell
  // ignore les coups invalides sans changer l'état) : la sélection retombe.
  // Une tentative invalide, elle, laisse la pièce sélectionnée — on peut
  // réessayer tout de suite.
  useEffect(() => {
    setSelected(null);
  }, [state]);

  const legalTargets = selected !== null ? legalMovesFrom(state, selected) : [];
  const [whiteId, blackId] = state.players;
  const whiteColor = players.find((p) => p.id === whiteId)!.color;
  const blackColor = players.find((p) => p.id === blackId)!.color;

  // Orientation fixe pour toute la partie, pas une rotation à chaque tour :
  // `localPlayer` (GameScreen) est stable — l'humain contre l'ordinateur,
  // un repère arbitraire en famille (l'iPad se partage, personne n'est plus
  // « local » qu'un autre). Son camp reste en bas, quelle que soit sa couleur.
  const flipped = colorOf(state, localPlayer) === 'black';

  // Deux humains autour du même iPad (sharedDevice) : le plateau ne bouge
  // jamais (flipped reste toujours false dans ce cas, cf. GameScreen), donc
  // les noirs sont systématiquement en haut de l'écran. Plutôt que de les
  // laisser « à l'envers » pour le joueur assis de ce côté, on tourne
  // seulement leurs pièces à 180° — le plateau, lui, ne pivote pas.
  const faceOwner = (isWhite: boolean) => sharedDevice && !isWhite;

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
        const isLastMove = state.lastMove !== null && (state.lastMove.from === cell || state.lastMove.to === cell);
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
            {/* Case de départ/d'arrivée du dernier coup (joueur ou bot) — un
                lavis discret, sous la pièce et les repères de sélection, pas
                la couleur victory déjà prise par la sélection/les cases
                jouables (sinon on ne distinguerait plus « dernier coup » de
                « coup en cours »). */}
            {isLastMove && <span className="absolute inset-0 bg-piece/30" />}

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

            {occupant && (
              <Pawn
                skin={pawnSkin(isWhitePiece ? whiteColor : blackColor, isWhitePiece ? 'white' : 'black')}
                rotated={faceOwner(isWhitePiece)}
              />
            )}

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
