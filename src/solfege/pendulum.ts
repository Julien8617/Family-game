// Calcul pur de l'angle d'un métronome à pendule — pas de React, pas de DOM
// (CLAUDE.md, règle 2). `Metronome.tsx` l'appelle à chaque frame ; testable
// ici sans navigateur avec de simples nombres.
//
// Le pendule atteint une extrémité (+maxAngleDeg ou -maxAngleDeg) exactement
// à chaque temps — même principe que le clic de calibration/count-in : le
// tic visuel tombe pile sur l'instant réel, jamais une approximation.
export function pendulumAngle(now: number, referenceTime: number, secPerBeat: number, maxAngleDeg: number): number {
  const phase = ((now - referenceTime) / secPerBeat) * Math.PI;
  return Math.cos(phase) * maxAngleDeg;
}
