import confetti from '../vendor/confetti';

// La version par défaut de canvas-confetti gère elle-même son canvas plein
// écran : elle le crée à la première célébration et le retire du DOM une fois
// l'animation terminée. Rien à nettoyer ici.
export function celebrate(winnerColor: string): void {
  try {
    confetti({
      particleCount: 80, // l'A8X n'est pas une machine de 2026
      spread: 70,
      startVelocity: 35,
      origin: { y: 0.6 },
      colors: [winnerColor, '#F2E4C9', '#F5A623'],
      disableForReducedMotion: true,
    });
  } catch {
    // La célébration est un bonus, jamais une raison de casser l'écran.
  }
}
