// Les six pièces d'échecs « au trait », redessinées à la main d'après tes
// icônes (app hors ligne, zéro asset de tiers). Même viewBox, même épaisseur
// de trait, même skin pour toutes : une pièce se colore exactement comme le pion.
//
// Chaque pièce est dessinée par-dessus elle-même dans l'ordre : ce qui vient
// après masque les raccords de ce qui vient avant (le socle couvre le bas du
// corps, le col du pion couvre le haut de la jupe, etc.). C'est ce qui donne
// le trait continu des dessins d'origine — ne pas réordonner les éléments.

import type { ReactNode } from 'react';

export type PieceKind = 'pawn' | 'rook' | 'knight' | 'bishop' | 'queen' | 'king';

export type PieceSkin = {
  fill: string;
  stroke: string;
};

/** Ancien nom, gardé pour ne rien casser dans le code qui l'importe déjà. */
export type PawnSkin = PieceSkin;

export const PIECE_SKINS = {
  white: { fill: '#FAF6EC', stroke: '#1E3D34' },
  black: { fill: '#201C16', stroke: 'rgba(250,246,236,0.4)' },
  roseOutline: { fill: '#FFFFFF', stroke: '#E85C8A' },
  roseSolid: { fill: '#F07FA8', stroke: '#B8446B' },
} as const satisfies Record<string, PieceSkin>;

const SHAPES: Record<PieceKind, ReactNode> = {
  // Pion : tête, jupe, puis le col par-dessus pour masquer les raccords.
  pawn: (
    <>
      <circle cx={22.5} cy={9.2} r={6.85} />
      <path d="M17.3 21 C17.4 28.2 14.6 32.6 10.2 36.8 L10.2 42.5 L34.8 42.5 L34.8 36.8 C30.4 32.6 27.6 28.2 27.7 21 Z" />
      <rect x={13} y={16.5} width={19} height={5} rx={2.5} />
    </>
  ),
  // Tour : fût, créneaux, socle.
  rook: (
    <>
      <path d="M15.4 13.8 L14 33.8 L31 33.8 L29.6 13.8 Z" />
      <path d="M11.5 2.3 L16.5 2.3 L16.5 7 L19.8 7 L19.8 2.3 L25.2 2.3 L25.2 7 L28.5 7 L28.5 2.3 L33.5 2.3 L33.5 8.6 C33.5 11.9 31.7 13.8 28.8 13.8 L16.2 13.8 C13.3 13.8 11.5 11.9 11.5 8.6 Z" />
      <path d="M8 42.2 L8 38.6 C8 35.2 10.6 33.8 13.8 33.55 C18.3 33.3 26.7 33.3 31.2 33.55 C34.4 33.8 37 35.2 37 38.6 L37 42.2 Z" />
    </>
  ),
  // Cavalier : tête et encolure d'un seul tenant, le trait de la bouche à part (il dépasse du contour), puis les deux marches du socle.
  knight: (
    <>
      <path d="M22.1 20.95 C21.88 20.88 21.25 20.66 20.8 20.5 C20.35 20.34 19.83 20.11 19.4 20 C18.97 19.89 18.62 19.79 18.2 19.85 C17.78 19.91 17.33 20.1 16.9 20.35 C16.47 20.6 16.1 21.09 15.6 21.35 C15.1 21.61 14.45 21.84 13.9 21.9 C13.35 21.96 12.78 21.85 12.3 21.7 C11.82 21.55 11.32 21.33 11 21 C10.68 20.67 10.48 20.18 10.35 19.7 C10.22 19.22 10.18 18.58 10.2 18.1 C10.22 17.62 10.28 17.17 10.45 16.8 C10.62 16.43 11.07 16.05 11.2 15.9 C11.53 15.65 12.55 14.9 13.2 14.4 C13.85 13.9 14.78 13.15 15.1 12.9 C15.32 12.65 15.98 11.83 16.4 11.4 C16.82 10.97 17.18 10.6 17.6 10.3 C18.02 10 18.48 9.78 18.9 9.6 C19.32 9.42 19.78 9.39 20.1 9.2 C20.42 9.01 20.68 8.72 20.8 8.45 C20.92 8.18 20.7 7.83 20.8 7.6 C20.9 7.37 21.15 7.17 21.4 7.05 C21.65 6.92 22.1 7.01 22.3 6.85 C22.5 6.69 22.58 6.47 22.6 6.1 C22.62 5.72 22.42 5.05 22.4 4.6 C22.38 4.15 22.48 3.6 22.5 3.4 C22.6 3.42 22.82 3.27 23.1 3.5 C23.38 3.73 23.85 4.33 24.2 4.8 C24.55 5.27 24.83 5.92 25.2 6.3 C25.57 6.68 25.83 6.82 26.4 7.1 C26.97 7.38 27.83 7.62 28.6 8 C29.37 8.38 30.23 8.75 31 9.4 C31.77 10.05 32.58 10.92 33.2 11.9 C33.82 12.88 34.37 14.13 34.7 15.3 C35.03 16.47 35.18 17.68 35.2 18.9 C35.22 20.12 35.03 21.35 34.8 22.6 C34.57 23.85 34.17 25.13 33.8 26.4 C33.43 27.67 32.95 29.03 32.6 30.2 C32.25 31.37 31.9 32.55 31.7 33.4 C31.5 34.25 31.45 34.98 31.4 35.3 L15.7 35.3 C15.72 34.78 15.62 33.22 15.8 32.2 C15.98 31.18 16.33 30.18 16.8 29.2 C17.27 28.22 18 27.23 18.6 26.3 C19.2 25.37 19.82 24.49 20.4 23.6 C20.98 22.71 21.82 21.39 22.1 20.95 Z" />
      <path d="M22.1 20.95 C23.2 20.85 24.3 20.7 25.3 20.4" fill="none" />
      <rect x={14.4} y={35.1} width={18.4} height={2.9} rx={0.6} />
      <rect x={12.6} y={38} width={22.1} height={3.4} rx={0.6} />
    </>
  ),
  // Fou : mitre avec sa fente (la fente est un vide, elle laisse voir la case), puis le socle.
  bishop: (
    <>
      <path d="M14.9 34.4 C14.6 33.83 13.68 32.37 13.1 31 C12.52 29.63 11.72 27.78 11.4 26.2 C11.08 24.62 11.03 23.1 11.2 21.5 C11.37 19.9 11.75 18.13 12.4 16.6 C13.05 15.07 14.13 13.5 15.1 12.3 C16.07 11.1 17.42 10.1 18.2 9.4 C18.98 8.7 19.53 8.32 19.8 8.1 C19.67 7.8 19.15 6.93 19 6.3 C18.85 5.67 18.72 4.88 18.9 4.3 C19.08 3.72 19.53 3.15 20.1 2.8 C20.67 2.45 21.58 2.2 22.3 2.2 C23.02 2.2 23.92 2.4 24.4 2.8 C24.88 3.2 25.17 3.97 25.2 4.6 C25.23 5.23 24.93 5.88 24.6 6.6 C24.27 7.32 23.68 8.12 23.2 8.9 C22.72 9.68 22.15 10.38 21.7 11.3 C21.25 12.22 20.8 13.25 20.5 14.4 C20.2 15.55 20.02 16.95 19.9 18.2 C19.78 19.45 19.72 21 19.8 21.9 C19.88 22.8 20.3 23.32 20.4 23.6 L24.2 23.7 C24.27 22.98 24.43 20.85 24.6 19.4 C24.77 17.95 24.95 16.28 25.2 15 C25.45 13.72 25.78 12.5 26.1 11.7 C26.42 10.9 26.93 10.45 27.1 10.2 C27.5 10.57 28.68 11.42 29.5 12.4 C30.32 13.38 31.32 14.73 32 16.1 C32.68 17.47 33.32 19.08 33.6 20.6 C33.88 22.12 33.92 23.7 33.7 25.2 C33.48 26.7 32.9 28.23 32.3 29.6 C31.7 30.97 30.47 32.77 30.1 33.4 L30.1 34.4 Z" />
      <path d="M8.9 42.1 L8.9 38.6 C8.9 35.3 11.5 33.9 14.7 33.65 C19.2 33.4 25.7 33.4 30.2 33.65 C33.4 33.9 36 35.3 36 38.6 L36 42.1 Z" />
    </>
  ),
  // Dame : couronne, puis les quatre boules par-dessus pour masquer les départs de branches, puis le socle.
  queen: (
    <>
      <path d="M12.3 34 L6.4 19.2 L10.2 17.7 L14.4 21.6 L14.8 12.3 L18.3 12 L21.4 20.3 L23.6 20.3 L26.7 12 L30.2 12.3 L30.6 21.6 L34.8 17.7 L38.6 19.2 L32.7 34 Z" />
      <circle cx={6.75} cy={15.4} r={3.9} />
      <circle cx={16.15} cy={8.4} r={4.0} />
      <circle cx={28.85} cy={8.4} r={4.0} />
      <circle cx={38.25} cy={15.4} r={3.9} />
      <path d="M9.1 40.4 L9.1 37.2 C9.1 34.9 11.7 33.5 14.9 33.25 C19.4 33 25.6 33 30.1 33.25 C33.3 33.5 35.9 34.9 35.9 37.2 L35.9 40.4 Z" />
    </>
  ),
  // Roi : couronne et croix d'un seul tenant, les deux jours, puis le socle.
  king: (
    <>
      <path d="M12.4 35.3 C6.9 30.4 4.05 26.4 4.1 22.4 C4.2 17.7 8.4 14.1 12.9 14.1 C15.1 14.1 16.9 14.9 18.5 16.3 L19.8 12 L16.4 12 L16.4 8.5 L19.6 8.5 L19.6 2.4 L25.4 2.4 L25.4 8.5 L28.6 8.5 L28.6 12 L25.2 12 L26.5 16.3 C28.1 14.9 29.9 14.1 32.1 14.1 C36.6 14.1 40.8 17.7 40.9 22.4 C40.95 26.4 38.1 30.4 32.6 35.3 Z" />
      <path d="M17.8 29.8 L15.9 29.8 L11.5 24.2 C10.9 23.4 11 22.3 11.8 21.5 C12.8 20.6 14.6 20.6 16.3 21.4 C17.3 21.9 17.8 22.7 17.8 23.7 Z" />
      <path d="M27.2 29.8 L29.1 29.8 L33.5 24.2 C34.1 23.4 34 22.3 33.2 21.5 C32.2 20.6 30.4 20.6 28.7 21.4 C27.7 21.9 27.2 22.7 27.2 23.7 Z" />
      <path d="M9.3 42.5 L9.3 39.3 C9.3 36.9 11.9 35.5 15.1 35.25 C19.6 35 26 35 30.5 35.25 C33.7 35.5 36.3 36.9 36.3 39.3 L36.3 42.5 Z" />
    </>
  ),
};

type ChessPieceProps = {
  kind: PieceKind;
  skin: PieceSkin;
  /** Retourne la pièce à 180° pour le joueur assis en face (mode partagé). */
  rotated?: boolean;
  /** Taille dans la case. Par défaut 72 % comme le plateau actuel. */
  className?: string;
  /** Épaisseur du trait, en unités du viewBox 45×45. */
  strokeWidth?: number;
};

export function ChessPiece({
  kind,
  skin,
  rotated = false,
  className = 'h-[72%] w-[72%]',
  strokeWidth = 1.3,
}: ChessPieceProps) {
  return (
    <svg
      viewBox="0 0 45 45"
      className={className}
      style={rotated ? { transform: 'rotate(180deg)' } : undefined}
      aria-hidden
    >
      <g
        fill={skin.fill}
        stroke={skin.stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        {SHAPES[kind]}
      </g>
    </svg>
  );
}

/** Raccourci pour la course des poussins, qui n'utilise que des pions. */
export function Pawn(props: Omit<ChessPieceProps, 'kind'>) {
  return <ChessPiece kind="pawn" {...props} />;
}
