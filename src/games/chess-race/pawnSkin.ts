// Couleur d'un pion : pas de teinte fixe (la spec 04 avait un blanc/noir
// classique, volontairement indépendant du profil, pour ressembler à un vrai
// jeu d'échecs). La couleur choisie à la création du profil identifie
// maintenant la pièce elle-même, comme partout ailleurs dans l'app (repère
// de tour, écran de résultat...). Les Blancs gardent un intérieur blanc avec
// un contour dans la couleur du joueur ; les Noirs ont l'inverse (intérieur
// coloré), avec un contour sombre par défaut. Cette règle de contour côté
// Noirs est provisoire — à ajuster au cas par cas si une couleur de la
// palette se lit mal avec un contour noir plat.

export type PawnSkin = {
  fill: string;
  stroke: string;
};

// Couleur « rose framboise » de src/players/palette.ts (PLAYER_COLORS[5]) —
// dupliquée ici en hex plutôt qu'importée, comme les autres couleurs de
// plateau du projet (voir tailwind.config.js), pour garder ce module
// indépendant du reste de la palette joueur.
const ROSE_PLAYER_COLOR = '#C15C8C';
const ROSE_DARK_STROKE = '#B8446B';
const DEFAULT_DARK_STROKE = '#201C16';

export function pawnSkin(playerColor: string, side: 'white' | 'black'): PawnSkin {
  if (side === 'white') {
    return { fill: '#FFFFFF', stroke: playerColor };
  }
  const stroke = playerColor === ROSE_PLAYER_COLOR ? ROSE_DARK_STROKE : DEFAULT_DARK_STROKE;
  return { fill: playerColor, stroke };
}
