# Notes techniques

Complète `CLAUDE.md` (contraintes) et `ARCHITECTURE.md` (contrats). Ce fichier
recense les comportements observés sur l'appareil réel qui pourraient
autrement être pris pour des bugs.

## Mode silencieux de l'iPad (spec 03)

Interrupteur physique sur silencieux → Safari coupe le son joué via
`AudioContext` (donc tous les sons ZzFX de `src/fx/sound.ts`), comme il coupe
la plupart de l'audio web. **C'est le comportement normal d'iPadOS, pas un bug
de l'app**, et il n'existe pas de contournement propre pour un site/PWA — les
API qui permettraient de forcer la lecture malgré l'interrupteur n'existent
que pour les apps natives.

Concrètement : partie coupée = pas de son de coup, de victoire, etc.
L'interrupteur son dans l'écran des profils reste inchangé et fonctionne
normalement quand l'iPad n'est pas en mode silencieux.

*À confirmer sur l'iPad réel — observation à mettre à jour après test.*
