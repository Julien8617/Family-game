// Rejet de la paume : un enfant qui tape du doigt pose souvent aussi la paume
// sur l'écran, ce qui génère un toucher parasite. Mesuré sur iPad Air 2 réel
// (iPadOS 15.8, voir NOTES.md) : un doigt fait ~20 px de rayon de contact
// (`Touch.radiusX`/`radiusY`, extension WebKit du Touch standard), une paume
// ~73 px. Seuil choisi à mi-chemin en penchant du côté sûr (plus proche de la
// paume que du doigt) : mieux vaut laisser passer une paume occasionnelle que
// bloquer un vrai tap d'enfant. À retoucher si l'usage réel montre l'inverse
// dans un sens ou l'autre — un seul nombre à changer.
const PALM_RADIUS_PX = 50;

function isPalmTouch(touch: Touch): boolean {
  // `radiusX`/`radiusY` n'existent pas dans le type Touch standard du DOM lib
  // TS, mais sont bien exposés par WebKit — accès défensif, absent ⇒ jamais
  // traité comme une paume (dégrade en « rejet désactivé », jamais en « tout
  // bloqué »).
  const radiusX = (touch as Touch & { radiusX?: number }).radiusX;
  const radiusY = (touch as Touch & { radiusY?: number }).radiusY;
  if (typeof radiusX !== 'number' || typeof radiusY !== 'number') return false;
  return radiusX > PALM_RADIUS_PX || radiusY > PALM_RADIUS_PX;
}

// Un vrai champ de saisie reste exempté même si un contact large y atterrit —
// bloquer le clavier iPadOS serait pire que le problème d'origine (piège déjà
// payé une fois avec `user-select: none`, voir NOTES.md spec 02).
function isTextInput(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('input, textarea') !== null;
}

function handleTouchStart(event: TouchEvent): void {
  // `changedTouches` : seulement les touchers qui viennent de commencer dans
  // cet événement — une paume déjà posée pendant qu'un doigt tape ensuite
  // n'y figure pas, donc ce doigt est évalué seul, sans jamais hériter du
  // rejet de la paume déjà en place à côté de lui.
  for (const touch of Array.from(event.changedTouches)) {
    if (isPalmTouch(touch) && !isTextInput(touch.target)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
  }
}

// Écouteur unique, posé une fois pour toute la session — capture (pas
// bubble) pour intercepter avant que React ne voie quoi que ce soit, et
// `passive: false` puisque preventDefault() est indispensable ici.
export function installPalmRejection(): void {
  document.addEventListener('touchstart', handleTouchStart, { capture: true, passive: false });
}
