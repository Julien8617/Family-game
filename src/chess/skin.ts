// Couleur d'une pièce : la pièce de l'enfant prend la couleur de son profil
// (comme les pions de chess-race, spec 04) ; une pièce adverse reste neutre,
// fixe, choisie pour rester nettement distincte des 8 teintes de
// src/players/palette.ts.
//
// Table dupliquée depuis chess-race/pawnSkin.ts (mêmes couleurs, même
// principe : trait = teinte du joueur poussée très sombre) plutôt que
// partagée entre les deux dossiers de jeu — CLAUDE.md, « un jeu = un
// dossier » : un jeu n'importe pas les internes d'un autre. Vit dans
// src/chess/ (et non plus piece-quiz/) depuis la révision des silhouettes
// (spec 06, retour utilisateur) : ce principe de coloration sert le socle
// entier, pas seulement piece-quiz — voir NOTES.md.

export interface PieceSkin {
  fill: string;
  stroke: string;
}

const OWN_SKINS: Record<string, PieceSkin> = {
  '#C94F3D': { fill: '#C94F3D', stroke: '#4B1007' }, // terracotta
  '#3C6E9F': { fill: '#3C6E9F', stroke: '#0D2945' }, // bleu
  '#4F8F6B': { fill: '#4F8F6B', stroke: '#153C26' }, // vert émeraude
  '#C9A227': { fill: '#C9A227', stroke: '#4B3B06' }, // moutarde
  '#7B5EA7': { fill: '#7B5EA7', stroke: '#25153C' }, // violet
  '#C15C8C': { fill: '#C15C8C', stroke: '#450D27' }, // rose framboise
  '#2E8F9E': { fill: '#2E8F9E', stroke: '#08414A' }, // turquoise
  '#52707A': { fill: '#52707A', stroke: '#1A3037' }, // ardoise
};

// Gris chaud, à mi-chemin entre les cases claires et foncées de l'échiquier :
// se détache sur les deux et ne se confond avec aucune des 8 couleurs de
// PLAYER_COLORS (la plus proche, l'ardoise #52707A, est nettement bleutée).
// Même principe que les couleurs de profil : le trait est la même teinte
// poussée très sombre.
const ENEMY_SKIN: PieceSkin = { fill: '#9C9484', stroke: '#38332A' };

export function pieceSkin(side: 'own' | 'enemy', playerColor: string): PieceSkin {
  if (side === 'enemy') return ENEMY_SKIN;
  return OWN_SKINS[playerColor] ?? OWN_SKINS['#52707A'];
}
