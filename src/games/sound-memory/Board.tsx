import { useEffect, useRef, useState } from 'react';
import type { BoardProps } from '../types';
import { playPadTone } from '../../fx/sound';
import { PAD_COLORS } from './padColors';
import { PAD_COUNTS } from './logic';
import type { PadCount, SoundMemoryMove, SoundMemoryState } from './logic';

// Aperçu miniature de la grille à venir (mêmes proportions que le vrai
// plateau), plutôt qu'un chiffre — navigable sans savoir lire (CLAUDE.md).
function CountPreview({ count }: { count: PadCount }) {
  const rows = count / 2;
  return (
    <div
      className="grid gap-1.5"
      style={{ gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: `repeat(${rows}, 1fr)` }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className="h-3 w-3 rounded-full bg-piece sm:h-4 sm:w-4" />
      ))}
    </div>
  );
}

const WRONG_TAP_RING = '#F5A623';
const PRESSED_RING = 'rgba(255,255,255,0.85)';

// Pause avant le premier pad d'une série — surtout sensible entre la fin du
// dernier tap d'une manche réussie et le début de la suivante (logic.ts
// renvoie 'showing' avec une séquence déjà plus longue, sans transition) :
// sans ce délai, le premier pad de la nouvelle série s'allumait pendant que
// le doigt venait tout juste de quitter l'écran, et passait inaperçu.
const LEAD_IN_MS = 550;
// Durée du sur-éclairage au tap, plus intense que le simple allumage passif
// de la lecture — retour tactile immédiat, décorrélé de la lecture pour ne
// jamais interférer avec elle (voir plus bas, pressedPad séparé de litPad).
const PRESS_FLASH_MS = 220;

export function Board({ state, onMove }: BoardProps<SoundMemoryState, SoundMemoryMove>) {
  // Deux états d'éclairage volontairement séparés : litPad (lecture de la
  // séquence, piloté par le seul effet ci-dessous) et pressedPad (retour
  // immédiat au tap, piloté seulement par handleTap). Les confondre dans un
  // seul état créait une vraie course : le minuteur d'extinction d'un tap
  // pouvait retomber pile pendant l'allumage du premier pad de la manche
  // suivante et l'éteindre prématurément.
  const [litPad, setLitPad] = useState<number | null>(null);
  const [pressedPad, setPressedPad] = useState<number | null>(null);
  const pressFlashRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      if (pressFlashRef.current) clearTimeout(pressFlashRef.current);
    };
  }, []);

  // Lecture de la séquence : un aller simple de timers, relancé seulement
  // quand `state.sequence` change de référence — ce qui n'arrive exactement
  // que lorsqu'une nouvelle manche démarre (setPadCount ou manche réussie
  // dans logic.ts), jamais sur un rendu intermédiaire (tap correct en cours
  // de manche, qui ne touche pas ce tableau). `onMove` volontairement absent
  // des dépendances : recréé à chaque rendu du shell, il ferait sinon
  // repartir l'animation en plein milieu de la lecture.
  useEffect(() => {
    if (state.phase !== 'showing') return undefined;

    const onMs = state.rhythmMs * 0.6;
    const gapMs = state.rhythmMs * 0.4;
    const timers: ReturnType<typeof setTimeout>[] = [];

    state.sequence.forEach((pad, i) => {
      const start = LEAD_IN_MS + i * (onMs + gapMs);
      timers.push(
        setTimeout(() => {
          setLitPad(pad);
          playPadTone(pad);
        }, start),
      );
      timers.push(setTimeout(() => setLitPad(null), start + onMs));
    });

    timers.push(
      setTimeout(() => onMove({ type: 'sequenceShown' }), LEAD_IN_MS + state.sequence.length * (onMs + gapMs)),
    );

    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.sequence, state.rhythmMs]);

  function handleTap(pad: number) {
    if (state.phase !== 'input') return;
    playPadTone(pad);
    setPressedPad(pad);
    if (pressFlashRef.current) clearTimeout(pressFlashRef.current);
    pressFlashRef.current = setTimeout(() => setPressedPad(null), PRESS_FLASH_MS);
    onMove({ type: 'tap', pad });
  }

  if (state.phase === 'setup') {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-8 rounded-3xl bg-piece/10 p-6">
        <p className="text-xl text-piece/80">Combien de pads ?</p>
        <div className="grid grid-cols-2 gap-4 sm:gap-6">
          {PAD_COUNTS.map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => onMove({ type: 'setPadCount', count })}
              aria-label={`${count} pads`}
              className="flex h-24 w-24 items-center justify-center rounded-3xl bg-piece/20 sm:h-32 sm:w-32"
            >
              <CountPreview count={count} />
            </button>
          ))}
        </div>
      </div>
    );
  }

  const padCount = state.padCount ?? 0;
  const rows = Math.ceil(padCount / 2);
  const tappable = state.phase === 'input';

  return (
    <div className="relative h-full w-full">
      <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-piece/10 px-4 py-1 text-lg text-piece/80">
        Score : {state.score}
      </div>
      <div
        className="grid h-full w-full gap-3"
        style={{ gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: `repeat(${rows}, 1fr)` }}
      >
        {Array.from({ length: padCount }, (_, pad) => {
          const isLit = litPad === pad;
          const isPressed = pressedPad === pad;
          const isWrongTap = state.phase === 'gameover' && state.lastTap === pad;
          return (
            <button
              key={pad}
              type="button"
              disabled={!tappable}
              onClick={() => handleTap(pad)}
              aria-label={`Pad ${pad + 1}`}
              className="rounded-3xl transition-[opacity,transform,filter] duration-100"
              style={{
                backgroundColor: PAD_COLORS[pad % PAD_COLORS.length],
                opacity: isLit || isPressed || isWrongTap ? 1 : 0.5,
                filter: isPressed ? 'brightness(1.4)' : undefined,
                transform: isPressed ? 'scale(1.04)' : undefined,
                boxShadow: isWrongTap
                  ? `0 0 0 6px ${WRONG_TAP_RING}`
                  : isPressed
                    ? `0 0 0 6px ${PRESSED_RING}, 0 0 22px 4px ${PRESSED_RING}`
                    : undefined,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
