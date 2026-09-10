import { useEffect, useRef } from 'react';
import { audioNow } from './audio';
import { pendulumAngle } from './pendulum';

// Amplitude du battement — assez large pour se voir sans passer pour un
// tressautement nerveux.
const MAX_ANGLE_DEG = 28;

interface MetronomeProps {
  tempoBpm: number;
  // Instant audio (AudioContext.currentTime) d'un temps connu — généralement
  // PlaybackHandle.startTime du clic/de la mélodie en cours, pour que le
  // pendule batte exactement en phase avec le son réel, pas une
  // approximation calée sur le montage du composant.
  referenceTime: number;
  running: boolean;
}

// Métronome à pendule, purement décoratif — anime en continu tant que
// `running`, mais répond toujours à un son réel en cours (jamais posé seul,
// CLAUDE.md « rien ne bouge tout seul » : il cadence une lecture déjà
// lancée). Piloté par requestAnimationFrame et une mutation DOM directe (pas
// de setState par frame), même patron que shell/GameScreen.tsx (ExitButton).
export function Metronome({ tempoBpm, referenceTime, running }: MetronomeProps) {
  const rodRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number>();

  useEffect(() => {
    if (!running) return undefined;
    const secPerBeat = 60 / tempoBpm;

    function tick() {
      const angle = pendulumAngle(audioNow(), referenceTime, secPerBeat, MAX_ANGLE_DEG);
      if (rodRef.current) rodRef.current.style.transform = `rotate(${angle}deg)`;
      frameRef.current = requestAnimationFrame(tick);
    }
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
    };
  }, [running, tempoBpm, referenceTime]);

  return (
    <div className="relative flex h-28 w-28 items-end justify-center sm:h-36 sm:w-36" aria-hidden>
      <div className="absolute bottom-0 h-3 w-20 rounded-full bg-piece/20 sm:w-24" />
      <div
        ref={rodRef}
        className="absolute bottom-2 left-1/2 h-[85%] w-1.5 origin-bottom -translate-x-1/2 rounded-full bg-piece"
        style={{ transform: 'rotate(0deg)' }}
      >
        <span className="absolute -top-2 left-1/2 h-5 w-5 -translate-x-1/2 rounded-full bg-victory sm:h-6 sm:w-6" />
      </div>
    </div>
  );
}
