import { useEffect, useRef } from 'react';
import { audioNow } from './audio';
import { beatXPercent } from './scrollPosition';

// Ligne de frappe fixe, proche du bord gauche — assez de couloir à droite
// pour voir un repère arriver avant qu'il ne compte.
const HIT_LINE_PERCENT = 14;
// Combien de temps à l'avance un repère devient visible, en temps (battements)
// plutôt qu'en secondes — toujours ~4 temps de couloir visible, quel que soit
// le tempo choisi.
const LOOKAHEAD_BEATS = 4;

interface ScrollingBeatsProps {
  totalBeats: number;
  claimedBeats: boolean[];
  tempoBpm: number;
  referenceTime: number;
  running: boolean;
}

// Défilement horizontal façon jeu de rythme — alternative au pendule
// (Metronome.tsx), au choix depuis l'écran Joueurs (solfege/visualization.ts).
// Chaque repère glisse vers la ligne de frappe et l'atteint exactement à son
// temps ; piloté par requestAnimationFrame et mutation DOM directe (pas de
// setState par frame, jusqu'à 32 repères) — même patron que Metronome.tsx et
// shell/GameScreen.tsx (ExitButton).
export function ScrollingBeats({ totalBeats, claimedBeats, tempoBpm, referenceTime, running }: ScrollingBeatsProps) {
  const markerRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const frameRef = useRef<number>();

  useEffect(() => {
    if (!running) return undefined;
    const secPerBeat = 60 / tempoBpm;
    const lookaheadSec = LOOKAHEAD_BEATS * secPerBeat;

    function tick() {
      const now = audioNow();
      for (let i = 0; i < totalBeats; i++) {
        const el = markerRefs.current[i];
        if (!el) continue;
        const beatTime = referenceTime + i * secPerBeat;
        el.style.left = `${beatXPercent(now, beatTime, HIT_LINE_PERCENT, lookaheadSec)}%`;
      }
      frameRef.current = requestAnimationFrame(tick);
    }
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
    };
  }, [running, tempoBpm, referenceTime, totalBeats]);

  return (
    <div className="relative h-16 w-full overflow-hidden rounded-full bg-piece/10 sm:h-20" aria-hidden>
      <div
        className="absolute inset-y-2 w-1 rounded-full bg-victory/70"
        style={{ left: `${HIT_LINE_PERCENT}%` }}
      />
      {Array.from({ length: totalBeats }, (_, i) => (
        <span
          key={i}
          ref={(el) => {
            markerRefs.current[i] = el;
          }}
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors sm:h-4 sm:w-4"
          style={{
            left: '-999%', // hors champ jusqu'au premier passage de tick()
            backgroundColor: claimedBeats[i] ? '#F5A623' : 'rgba(242,228,201,0.4)',
          }}
        />
      ))}
    </div>
  );
}
