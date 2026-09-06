import type { Player } from './types';

// Joueurs codés en dur pour la phase 1. Remplacé par le vrai stockage des
// profils (photos, sélection) en spec 2 — voir ARCHITECTURE.md section 5.
export const FIXED_PLAYERS: [Player, Player] = [
  { id: 'p1', name: 'Joueur 1', photo: '', color: '#C94F3D' },
  { id: 'p2', name: 'Joueur 2', photo: '', color: '#3C6E9F' },
];
