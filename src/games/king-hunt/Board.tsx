import { useEffect, useState } from 'react';
import type { BoardProps } from '../types';
import { attackedSquares } from '../../chess/attacks';
import { ChessPiece } from './ChessPiece';
import { pieceSkin } from '../../chess/skin';
import { warmSolvedTable } from './bot';
import { CONTROLLED_SQUARES_VISIBLE_MAX_LEVEL, legalMovesFrom, SIZE } from './logic';
import type { KingHuntMove, KingHuntState } from './logic';

// Rangée haute réservée (budget) : même principe que piece-quiz/Board.tsx
// (LevelBadge) — le plateau réserve explicitement cette hauteur plutôt que
// de superposer la rangée en position absolue, pour ne jamais chevaucher une
// pièce de la rangée du haut.
const RESERVED_HEADER_PX = 44;

// À partir de combien de coups restants la rangée de jetons s'alarme (spec
// 07 : « quand il reste trois coups, la rangée se teinte d'alerte »).
const LOW_BUDGET_THRESHOLD = 3;

export function Board({ state, players, onMove }: BoardProps<KingHuntState, KingHuntMove>) {
  const [selected, setSelected] = useState<number | null>(null);

  // Nouvelle référence de state = un coup vient d'être appliqué (le shell
  // ignore les coups invalides sans changer l'état) — même patron que
  // chess-race/Board.tsx.
  useEffect(() => {
    setSelected(null);
  }, [state]);

  // Précalcule la table résolue du niveau 4 avant qu'elle ne soit vraiment
  // nécessaire (premier coup du roi) — bot.ts reste pur, c'est ce montage-ci
  // qui décide QUAND (voir bot.ts, warmSolvedTable). Sans effet si la partie
  // ne joue jamais au niveau 4.
  useEffect(() => {
    warmSolvedTable();
  }, []);

  const [rooksId] = state.players;
  const rooksColor = players.find((p) => p.id === rooksId)?.color ?? '#52707A';
  const kingSkin = pieceSkin('enemy', rooksColor);
  const rooksSkin = pieceSkin('own', rooksColor);

  const activeSide = state.turn === 'rooks' ? 'own' : 'enemy';
  const legalTargets = selected !== null ? legalMovesFrom(state, selected) : [];

  const showControlled = state.level <= CONTROLLED_SQUARES_VISIBLE_MAX_LEVEL;
  const controlledSquares = showControlled ? attackedSquares(state.board, SIZE, 'own') : null;

  function handleTap(cell: number) {
    const occupant = state.board[cell];

    if (selected === null) {
      if (occupant?.side === activeSide) setSelected(cell);
      return;
    }
    if (cell === selected) {
      setSelected(null);
      return;
    }
    if (occupant?.side === activeSide) {
      setSelected(cell);
      return;
    }
    onMove({ from: selected, to: cell });
  }

  const rows = Array.from({ length: SIZE }, (_, i) => SIZE - 1 - i); // rangée SIZE-1 en haut de l'écran
  const cols = Array.from({ length: SIZE }, (_, i) => i);

  return (
    <div className="relative flex h-full w-full flex-col items-center">
      <BudgetRow total={state.budgetTotal} left={state.budgetLeft} />
      <div
        className="mt-2 grid overflow-hidden rounded-3xl shadow-[0_6px_0_0_rgba(0,0,0,0.25)]"
        style={{
          aspectRatio: '1 / 1',
          height: `calc(100% - ${RESERVED_HEADER_PX}px)`,
          gridTemplateColumns: `repeat(${SIZE}, 1fr)`,
          gridTemplateRows: `repeat(${SIZE}, 1fr)`,
        }}
      >
        {rows.map((row) =>
          cols.map((col) => {
            const cell = row * SIZE + col;
            const isLight = (row + col) % 2 === 0;
            const piece = state.board[cell];
            const isSelected = selected === cell;
            const isLastMove = state.lastMove !== null && (state.lastMove.from === cell || state.lastMove.to === cell);
            // Case tenue par les tours (spec 07) : un aplat plein dans la
            // couleur des tours se voit sur case claire comme foncée — un
            // lavis crème à 20 % (première version) était quasiment invisible
            // sur les cases déjà claires, trouvé en testant le jeu réel.
            const isControlled = (controlledSquares?.has(cell) ?? false) && piece === null;
            const isTarget = legalTargets.includes(cell);
            const isCaptureTarget = isTarget && piece !== null;

            return (
              <button
                key={cell}
                type="button"
                onClick={() => handleTap(cell)}
                className={`relative flex items-center justify-center ${isLight ? 'bg-squareLight' : 'bg-squareDark'}`}
              >
                {isLastMove && <span className="absolute inset-0 bg-victory/35" />}
                {isControlled && !isLastMove && (
                  <span className="absolute h-2.5 w-2.5 rounded-full" style={{ backgroundColor: rooksColor, opacity: 0.55 }} />
                )}

                {piece && (
                  <ChessPiece type={piece.type} skin={piece.side === 'own' ? rooksSkin : kingSkin} />
                )}

                {isSelected && <span className="absolute inset-1 rounded-xl ring-4 ring-victory ring-inset" />}
                {isTarget && !isCaptureTarget && <span className="absolute h-[28%] w-[28%] rounded-full bg-victory/70" />}
                {isCaptureTarget && <span className="absolute inset-1 rounded-full ring-4 ring-victory" />}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}

// Une rangée de jetons plutôt qu'un nombre : comptable d'un coup d'œil, sans
// savoir lire (CLAUDE.md, direction visuelle) — s'éteignent un par un à
// mesure que le budget des tours se consomme, la rangée passe en rouge sous
// le seuil d'alerte (spec 07).
function BudgetRow({ total, left }: { total: number; left: number }) {
  const alert = left <= LOW_BUDGET_THRESHOLD;
  return (
    <div className="flex h-9 w-full shrink-0 items-center justify-center gap-1 px-1" aria-label={`${left} coups restants sur ${total}`}>
      {Array.from({ length: total }, (_, i) => {
        const lit = i < left;
        return (
          <span
            key={i}
            className={`h-3.5 max-w-[18px] flex-1 rounded-full transition-colors ${
              lit ? (alert ? 'bg-red-500' : 'bg-victory') : 'bg-piece/15'
            }`}
          />
        );
      })}
    </div>
  );
}
