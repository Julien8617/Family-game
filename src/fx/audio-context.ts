// Seul propriétaire de l'AudioContext pour toute l'app (CLAUDE.md, règle
// implicite « un seul contexte » — iOS tolère mal d'en avoir deux, et un
// second contexte ferait diverger l'horloge du moteur musical de celle des
// effets sonores ZzFX). Créé paresseusement, débloqué au premier vrai tap.
let ctx: AudioContext | undefined;

export function getAudioContext(): AudioContext {
  return ctx ?? (ctx = new AudioContext());
}

// Débloque (reprend) le contexte partagé. À appeler depuis un vrai
// gestionnaire de geste utilisateur — iOS le garde suspendu jusque-là. Sans
// effet si déjà en cours d'exécution, donc sûr à appeler à chaque tap.
export function unlockAudioContext(): void {
  const context = getAudioContext();
  if (context.state === 'suspended') context.resume();
}
