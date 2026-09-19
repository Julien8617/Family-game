import { useEffect } from 'react';
import type { BoardProps } from '../types';
import { algebraic } from '../../chess/geometry';
import { ChessPiece } from './ChessPiece';
import {
  isTierUnlocked,
  resumeLevelForTier,
  TIER_LEVELS,
  TIER_ORDER,
} from './logic';
import type { PieceQuizMove, PieceQuizState } from './logic';
import { pieceSkin } from '../../chess/skin';
import type { Tier } from './generate';

// Même délai que GameScreen.RESULT_DELAY_MS (shell/GameScreen.tsx) : sur la
// 5ᵉ question, c'est ce délai-là (déclenché par getResult non nul, pas par ce
// timer) qui bascule vers l'écran de résultat — aligner les deux évite que la
// révélation soit coupée plus court sur la dernière question que sur les
// quatre précédentes.
const REVEAL_HOLD_MS = 900;

const TIER_LABELS: Record<Tier, string> = { easy: 'Facile', medium: 'Moyen', hard: 'Difficile' };
const TIER_ICON: Record<Tier, import('../../chess/pieces').PieceType> = {
  easy: 'pawn',
  medium: 'rook',
  hard: 'queen',
};

type RevealCategory = 'found' | 'missing' | 'wrong' | 'none';

function markerClass(phase: PieceQuizState['phase'], isMarked: boolean, reveal: RevealCategory): string {
  if (phase === 'question') {
    return isMarked ? 'opacity-100 bg-victory/55' : 'opacity-0 bg-victory/55';
  }
  switch (reveal) {
    case 'found':
      return 'opacity-100 bg-victory';
    case 'missing':
      return 'opacity-100 bg-victory/25 ring-2 ring-inset ring-victory/80';
    case 'wrong':
      return 'opacity-0 bg-victory/55';
    default:
      return 'opacity-0 bg-victory/55';
  }
}

export function Board({ state, localPlayer, players, onMove }: BoardProps<PieceQuizState, PieceQuizMove>) {
  const question = state.questions[state.questionIndex];
  const size = question.boardSize;
  const profileColor = players.find((p) => p.id === localPlayer)?.color ?? '#52707A';

  // Révélation animée localement (aucun applyMove pendant l'animation, même
  // patron que sound-memory : sequenceShown) — envoyé après CHAQUE
  // révélation, y compris celle de la 5ᵉ question : c'est ce 'next'-là qui
  // décide et enchaîne (niveau suivant / redémarre / fête / échec — voir
  // logic.ts et GameModule.progressSignal), le jeu ne s'arrête plus au
  // niveau. Seule exception : une fois la partie terminée (niveau 100
  // réussi, state.finished), GameScreen bascule déjà tout seul dès que
  // getResult() n'est plus nul — renvoyer 'next' serait alors invalide.
  useEffect(() => {
    if (state.phase !== 'reveal' || state.finished) return undefined;
    const timer = setTimeout(() => onMove({ type: 'next' }), REVEAL_HOLD_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.questionIndex, state.finished]);

  const markedSet = new Set(state.marked);
  const expectedSet = new Set(question.expectedSquares);
  const pieceAt = new Map(question.pieces.map((p) => [p.square, p] as const));

  function handleTap(cell: number) {
    if (state.phase !== 'question') return;
    onMove({ type: 'toggle', square: cell });
  }

  const rows = Array.from({ length: size }, (_, i) => size - 1 - i); // rangée size-1 en haut de l'écran
  const cols = Array.from({ length: size }, (_, i) => i);

  return (
    <div className="relative h-full w-full">
      <div
        className="grid h-full w-full overflow-hidden rounded-3xl shadow-[0_6px_0_0_rgba(0,0,0,0.25)]"
        style={{ gridTemplateColumns: `repeat(${size}, 1fr)`, gridTemplateRows: `repeat(${size}, 1fr)` }}
      >
        {rows.map((row) =>
          cols.map((col) => {
            const cell = row * size + col;
            const isLight = (row + col) % 2 === 0;
            const piece = pieceAt.get(cell);
            const isQueried = cell === question.queriedSquare;
            const isLastMove = question.lastMove !== null && (question.lastMove.from === cell || question.lastMove.to === cell);
            const isMarked = markedSet.has(cell);
            const reveal: RevealCategory =
              state.phase !== 'reveal' ? 'none' : expectedSet.has(cell) ? (isMarked ? 'found' : 'missing') : isMarked ? 'wrong' : 'none';
            const labelColor = isLight ? 'text-squareDark/70' : 'text-squareLight/70';

            return (
              <button
                key={cell}
                type="button"
                disabled={state.phase !== 'question'}
                onClick={() => handleTap(cell)}
                aria-label={size === 8 ? algebraic(size, cell) : undefined}
                className={`relative flex items-center justify-center ${isLight ? 'bg-squareLight' : 'bg-squareDark'}`}
              >
                {isLastMove && <span className="absolute inset-0 bg-victory/35" />}

                <span className={`absolute inset-1.5 rounded-xl transition-all duration-500 ${markerClass(state.phase, isMarked, reveal)}`} />

                {piece && (
                  <div className="relative flex h-full w-full items-center justify-center">
                    {isQueried && <span className="absolute h-[80%] w-[80%] rounded-full ring-4 ring-victory" />}
                    <ChessPiece type={piece.type} skin={pieceSkin(piece.side, profileColor)} />
                  </div>
                )}

                {size === 8 && col === 0 && <span className={`absolute left-1 top-1 text-[10px] font-bold ${labelColor}`}>{row + 1}</span>}
                {size === 8 && row === 0 && (
                  <span className={`absolute bottom-1 right-1 text-[10px] font-bold ${labelColor}`}>{String.fromCharCode(97 + col)}</span>
                )}
              </button>
            );
          }),
        )}
      </div>

      <LevelBadge level={state.level} tier={state.tier} />

      {state.phase === 'question' && (
        <>
          <ValidateButton enabled={state.marked.length > 0} onValidate={() => onMove({ type: 'validate' })} />
          <TierPickerButton onOpen={() => onMove({ type: 'openTierPicker' })} />
        </>
      )}

      {state.phase === 'tierPicker' && <TierPicker state={state} onPick={(level) => onMove({ type: 'startLevel', level })} />}
    </div>
  );
}

// Niveau en cours, en haut du damier (spec 06, point 2) : le numéro absolu
// (1-100, le même que celui utilisé dans les libellés de fête — « Niveau
// 30 » désigne toujours la même chose) porte le sens principal, l'icône du
// palier (même silhouette que le sélecteur de palier) le rend lisible sans
// savoir lire. À l'intérieur du carré (pas de position fixed comme les
// boutons) : purement informatif, aucune contrainte de zone tactile à
// garantir, pas de risque à chevaucher légèrement la rangée du haut.
function LevelBadge({ level, tier }: { level: number; tier: Tier }) {
  return (
    <div className="absolute left-1/2 top-2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-board/70 py-1 pl-1 pr-3 shadow-[0_2px_0_0_rgba(0,0,0,0.2)]">
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-piece/15 sm:h-8 sm:w-8">
        <ChessPiece type={TIER_ICON[tier]} skin={{ fill: '#F2E4C9', stroke: '#1E3D34' }} className="h-[70%] w-[70%]" />
      </div>
      <span className="text-lg font-bold text-piece sm:text-xl">{level}</span>
    </div>
  );
}

// Position flottante (fixed), hors du carré du plateau : sur les deux
// appareils cibles, le carré occupe toute la largeur disponible (94vw) et se
// centre verticalement dans l'espace restant — la marge sous le carré n'est
// donc que la moitié du surplus vertical (~85 px sur iPad, l'appareil le
// plus serré ; nettement plus sur iPhone, dont le carré est bien plus étroit
// que haut). 60 px + 10 px de marge tient dans ces 85 px avec de la
// respiration réelle (~15 px), pas au pixel près — un calcul qu'on ne peut
// pas vérifier au pixel dans cet environnement de développement (pas
// d'appareil réel ni de vraie fenêtre portrait disponibles ici). Sous les
// 80 px habituels de CLAUDE.md : un choix géométrique mesuré, pas arbitraire
// — comme l'exception iPhone des grilles denses — mais à reconfirmer sur
// l'iPad/iPhone réels (voir NOTES.md).
function ValidateButton({ enabled, onValidate }: { enabled: boolean; onValidate(): void }) {
  return (
    <button
      type="button"
      disabled={!enabled}
      onClick={onValidate}
      aria-label="Valider"
      style={{ bottom: 'calc(0.625rem + env(safe-area-inset-bottom))' }}
      className={`fixed left-1/2 z-20 flex h-[60px] w-[60px] -translate-x-1/2 items-center justify-center rounded-full shadow-[0_4px_0_0_rgba(0,0,0,0.25)] transition-transform active:translate-y-1 active:shadow-[0_2px_0_0_rgba(0,0,0,0.25)] ${
        enabled ? 'bg-victory' : 'bg-piece/20'
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
        <path
          d="M4 12.5 L9.5 18 L20 6"
          fill="none"
          stroke={enabled ? '#1E3D34' : 'rgba(242,228,201,0.5)'}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

// Discret, dans un coin — symétrique du bouton Quitter (shell/GameScreen.tsx,
// en haut à gauche) : même taille de cible tactile (80 px), juste plus
// transparent et une icône plus modeste.
function TierPickerButton({ onOpen }: { onOpen(): void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Choisir le palier"
      style={{ top: 'calc(1.5rem + env(safe-area-inset-top))' }}
      className="fixed right-6 z-20 flex h-20 w-20 items-center justify-center rounded-full bg-piece/10 opacity-60"
    >
      <svg viewBox="0 0 24 24" className="h-8 w-8" aria-hidden>
        <g fill="none" stroke="#F2E4C9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="4" width="6" height="6" rx="1.4" />
          <rect x="14" y="4" width="6" height="6" rx="1.4" />
          <rect x="4" y="14" width="6" height="6" rx="1.4" />
          <rect x="14" y="14" width="6" height="6" rx="1.4" />
        </g>
      </svg>
    </button>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
      <g fill="none" stroke="rgba(242,228,201,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="10.5" width="14" height="10" rx="2" />
        <path d="M8 10.5 V7 a4 4 0 0 1 8 0 v3.5" />
      </g>
    </svg>
  );
}

function TierPicker({ state, onPick }: { state: PieceQuizState; onPick(level: number): void }) {
  return (
    <div
      className="fixed inset-0 z-30 flex flex-col items-center justify-center gap-6 bg-board/95 px-6"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex gap-4 sm:gap-6">
        {TIER_ORDER.map((tier) => {
          const unlocked = isTierUnlocked(tier, state.progress);
          const total = TIER_LEVELS[tier];
          const done = Math.min(state.progress[tier], total);
          const fraction = total === 0 ? 0 : done / total;

          return (
            <button
              key={tier}
              type="button"
              disabled={!unlocked}
              onClick={() => onPick(resumeLevelForTier(tier, state.progress))}
              aria-label={TIER_LABELS[tier]}
              className={`flex h-32 w-32 flex-col items-center justify-center gap-4 rounded-3xl sm:h-40 sm:w-40 ${
                unlocked ? 'bg-piece/15' : 'bg-piece/5 opacity-50'
              }`}
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-piece/10 sm:h-16 sm:w-16">
                {unlocked ? (
                  <ChessPiece type={TIER_ICON[tier]} skin={{ fill: '#F2E4C9', stroke: '#1E3D34' }} className="h-[70%] w-[70%]" />
                ) : (
                  <LockIcon />
                )}
              </div>
              {unlocked && (
                <div className="h-2.5 w-20 overflow-hidden rounded-full bg-piece/20 sm:w-24">
                  <div className="h-full rounded-full bg-victory transition-[width]" style={{ width: `${Math.round(fraction * 100)}%` }} />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
