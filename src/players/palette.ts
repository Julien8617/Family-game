// Palette fixe des couleurs de profil. #F5A623 (victory) est volontairement exclu :
// c'est l'anneau de la ligne gagnante dans Board.tsx, la couleur d'un joueur ne doit
// jamais s'y confondre.
export const PLAYER_COLORS = [
  '#C94F3D', // terracotta
  '#3C6E9F', // bleu
  '#4F8F6B', // vert émeraude
  '#C9A227', // moutarde
  '#7B5EA7', // violet
  '#C15C8C', // rose framboise
  '#2E8F9E', // turquoise
  '#52707A', // ardoise
] as const;
