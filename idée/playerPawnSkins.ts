import type { PawnSkin } from './ChessPiece';

// Un skin de pion par couleur de profil : le corps est la couleur du joueur,
// le trait la même teinte poussée très sombre. Deux couleurs d'une seule
// famille — la pièce se lit comme « le pion de X », pas comme un pion bicolore.
//
// Contrastes mesurés : trait / corps entre 2,8 et 4,4 : 1 ; trait / case
// claire (#EFE6D2) entre 8,8 et 13,5 : 1.

export type PlayerColorKey =
  | 'red'
  | 'blue'
  | 'green'
  | 'gold'
  | 'purple'
  | 'pink'
  | 'teal'
  | 'slate';

export const PLAYER_PAWN_SKINS: Record<PlayerColorKey, PawnSkin> = {
  red:    { fill: '#C94F3D', stroke: '#4B1007' },
  blue:   { fill: '#3C6E9F', stroke: '#0D2945' },
  green:  { fill: '#4F8F6B', stroke: '#153C26' },
  gold:   { fill: '#C9A227', stroke: '#4B3B06' },
  purple: { fill: '#7B5EA7', stroke: '#25153C' },
  pink:   { fill: '#C15C8C', stroke: '#450D27' },
  teal:   { fill: '#2E8F9E', stroke: '#08414A' },
  slate:  { fill: '#52707A', stroke: '#1A3037' },
};
