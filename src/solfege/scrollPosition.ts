// Position horizontale d'un repère de défilement, en pourcentage de la
// largeur du couloir — pur, testé sans navigateur (CLAUDE.md, règle 2).
// `ScrollingBeats.tsx` l'appelle à chaque frame pour chaque repère.
//
// Un repère apparaît à droite (100 %) `lookaheadSec` avant son temps, avance
// linéairement, et tombe exactement sur `hitLinePercent` à l'instant prévu —
// puis continue au-delà (vers la gauche), jamais figé ni téléporté.
export function beatXPercent(now: number, beatTime: number, hitLinePercent: number, lookaheadSec: number): number {
  const timeUntil = beatTime - now;
  return hitLinePercent + (timeUntil / lookaheadSec) * (100 - hitLinePercent);
}
