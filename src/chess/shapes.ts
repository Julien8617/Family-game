import type { PieceType } from './pieces';

// Silhouettes des six pièces, dans l'esprit de chess-race/Pawn.tsx (même
// viewBox 45×45, même corps — tête ronde, col en gélule, jupe évasée, socle
// plat — repris tel quel pour les six, seule la tête change). Données pures
// (pas de JSX ici : ce module ne doit importer ni React ni le DOM, voir
// CLAUDE.md règle 5 et le critère d'acceptation 4 de la spec 06) ; un
// composant de rendu séparé (piece-quiz/ChessPiece.tsx) les transforme en SVG.
//
// Dette assumée, documentée dans NOTES.md : la silhouette de pion ci-dessous
// duplique chess-race/Pawn.tsx plutôt que de la réutiliser — chess-race n'est
// pas migré sur ce socle dans cette spec (hors périmètre explicite).

export type PieceShapeElement =
  | { kind: 'circle'; cx: number; cy: number; r: number }
  | { kind: 'path'; d: string }
  | { kind: 'rect'; x: number; y: number; width: number; height: number; rx?: number };

export interface PieceShape {
  viewBox: string;
  elements: PieceShapeElement[];
}

// Corps commun aux six pièces : jupe évasée + col, identique à Pawn.tsx.
const BODY: PieceShapeElement[] = [
  {
    kind: 'path',
    d: `M18.3 19.6
        C18.5 28.2 15.0 34.4 10.4 37.1
        L10.4 42.9
        L34.6 42.9
        L34.6 37.1
        C30.0 34.4 26.5 28.2 26.7 19.6
        Z`,
  },
  { kind: 'rect', x: 12.3, y: 15.7, width: 20.4, height: 5.5, rx: 2.75 },
];

export const PIECE_SHAPES: Record<PieceType, PieceShape> = {
  pawn: {
    viewBox: '0 0 45 45',
    elements: [{ kind: 'circle', cx: 22.5, cy: 9.3, r: 6.9 }, ...BODY],
  },

  // Tour : bloc crénelé (trois merlons) au lieu d'une tête ronde.
  rook: {
    viewBox: '0 0 45 45',
    elements: [
      { kind: 'rect', x: 13.5, y: 4.5, width: 18, height: 8.5, rx: 1.2 },
      { kind: 'rect', x: 13.5, y: 0, width: 4, height: 5.5 },
      { kind: 'rect', x: 20.5, y: 0, width: 4, height: 5.5 },
      { kind: 'rect', x: 27.5, y: 0, width: 4, height: 5.5 },
      ...BODY,
    ],
  },

  // Fou : mitre pointue (ovale effilé) surmontée d'une petite boule, fente
  // diagonale caractéristique tracée en trait seul (pas de remplissage).
  bishop: {
    viewBox: '0 0 45 45',
    elements: [
      {
        kind: 'path',
        d: `M22.5 1.2
            C27.3 1.2 29.8 6.2 27.6 10.6
            C26.6 12.6 24.7 13.9 22.5 13.9
            C20.3 13.9 18.4 12.6 17.4 10.6
            C15.2 6.2 17.7 1.2 22.5 1.2 Z`,
      },
      { kind: 'circle', cx: 22.5, cy: 0.6, r: 1.4 },
      {
        kind: 'path',
        d: 'M18.5 7.2 C19.7 8.6 25.3 8.6 26.5 7.2',
      },
      ...BODY,
    ],
  },

  // Cavalier : tête de cheval stylisée — encolure arquée, chanfrein, oreille.
  knight: {
    viewBox: '0 0 45 45',
    elements: [
      {
        kind: 'path',
        d: `M15.5 19.5
            C13.8 14.8 15.8 8.4 21.2 5.6
            C25.5 3.4 29 4.4 30.8 3.2
            C30.2 5.2 28.4 6.2 28.4 6.2
            C31.2 6.8 33.4 9.2 33.6 12.2
            C35.4 12.4 36.7 13.8 36.4 15.6
            C36.2 16.9 35.1 17.7 33.9 17.6
            C33.7 19.2 32.2 20.2 30.7 19.7
            L30.4 22.6
            L17.5 22.6
            C16.4 21.4 15.6 20.6 15.5 19.5 Z`,
      },
      { kind: 'circle', cx: 25.6, cy: 9.3, r: 1.05 },
      ...BODY,
    ],
  },

  // Dame : couronne à cinq pointes.
  queen: {
    viewBox: '0 0 45 45',
    elements: [
      {
        kind: 'path',
        d: `M13.5 15.5
            L11.5 6.5 L16.3 10.8 L18.6 3.5
            L22.5 9.4 L26.4 3.5 L28.7 10.8
            L33.5 6.5 L31.5 15.5 Z`,
      },
      { kind: 'circle', cx: 11.5, cy: 5.2, r: 1.5 },
      { kind: 'circle', cx: 22.5, cy: 2.4, r: 1.5 },
      { kind: 'circle', cx: 33.5, cy: 5.2, r: 1.5 },
      ...BODY,
    ],
  },

  // Roi : couronne surmontée d'une croix.
  king: {
    viewBox: '0 0 45 45',
    elements: [
      { kind: 'rect', x: 21, y: 0.4, width: 3, height: 6.6 },
      { kind: 'rect', x: 18.7, y: 2.4, width: 7.6, height: 2.6 },
      {
        kind: 'path',
        d: `M14 15.9
            L15.8 8.3 L22.5 12.1 L29.2 8.3 L31 15.9 Z`,
      },
      ...BODY,
    ],
  },
};
