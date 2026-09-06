import { registerSW } from 'virtual:pwa-register';

// Sur iPad, l'app installée est le plus souvent réveillée depuis un état
// suspendu par iOS plutôt que vraiment rechargée : la vérification native de
// mise à jour du navigateur (qui se fait sur une vraie navigation) ne se
// déclenche pas. Sans ça, l'app peut rester bloquée sur une vieille version
// jusqu'à ce qu'iOS finisse par la tuer et la relancer pour de bon.
// On revérifie donc nous-mêmes à chaque retour au premier plan, plus un filet
// de sécurité périodique pour une session qui reste ouverte longtemps.
const PERIODIC_CHECK_MS = 60 * 60 * 1000; // 1 h

export function registerServiceWorker(): void {
  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;

      setInterval(() => registration.update(), PERIODIC_CHECK_MS);

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registration.update();
      });
    },
  });
}
