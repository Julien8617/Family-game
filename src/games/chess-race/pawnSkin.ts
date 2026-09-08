// Couleur d'un pion : pas de teinte fixe (la spec 04 avait un blanc/noir
// classique, volontairement indépendant du profil, pour ressembler à un vrai
// jeu d'échecs). La couleur choisie à la création du profil identifie
// maintenant la pièce elle-même, comme partout ailleurs dans l'app (repère
// de tour, écran de résultat...).

export type PawnSkin = {
  fill: string;
  stroke: string;
};

// Skin par couleur de profil joueur — clé sur le hex de src/players/palette.ts
// directement (même valeur que `player.color`) plutôt que sur une seconde
// table nommée dupliquant cette liste.
//
// Principe (camp Noirs) : le corps est la couleur du joueur telle quelle, le
// trait la même teinte poussée très sombre — deux couleurs d'une seule
// famille, la pièce se lit comme « le pion de ce joueur », pas comme un pion
// bicolore générique.
//
// Contrastes vérifiés : trait/corps entre 2,8:1 et 4,4:1 ; trait/case claire
// (#EFE6D2) entre 8,8:1 et 13,5:1.
const PLAYER_PAWN_SKINS: Record<string, PawnSkin> = {
  '#C94F3D': { fill: '#C94F3D', stroke: '#4B1007' }, // terracotta
  '#3C6E9F': { fill: '#3C6E9F', stroke: '#0D2945' }, // bleu
  '#4F8F6B': { fill: '#4F8F6B', stroke: '#153C26' }, // vert émeraude
  '#C9A227': { fill: '#C9A227', stroke: '#4B3B06' }, // moutarde
  '#7B5EA7': { fill: '#7B5EA7', stroke: '#25153C' }, // violet
  '#C15C8C': { fill: '#C15C8C', stroke: '#450D27' }, // rose framboise
  '#2E8F9E': { fill: '#2E8F9E', stroke: '#08414A' }, // turquoise
  '#52707A': { fill: '#52707A', stroke: '#1A3037' }, // ardoise
};

export function pawnSkin(playerColor: string, side: 'white' | 'black'): PawnSkin {
  // playerColor vient toujours de PLAYER_COLORS (palette.ts) — profil ou
  // bot (couleur fixe #52707A, elle-même une entrée de cette palette).
  const skin = PLAYER_PAWN_SKINS[playerColor]!;
  if (side === 'white') {
    // Même trait que le pion Noirs de ce joueur, mais corps blanc — c'est le
    // trait qui porte l'identité de couleur des deux côtés.
    return { fill: '#FFFFFF', stroke: skin.stroke };
  }
  return skin;
}
