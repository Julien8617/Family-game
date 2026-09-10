import { useEffect, useRef, useState } from 'react';
import type { BoardProps } from '../types';
import { play } from '../../fx/sound';
import { CalibrationScreen } from '../../solfege/CalibrationScreen';
import { Metronome } from '../../solfege/Metronome';
import { audioNow, playClickTrack, playMelody } from '../../solfege/audio';
import type { PlaybackHandle } from '../../solfege/audio';
import { getCalibrationOffsetMs } from '../../solfege/calibration';
import { getMelody } from '../../solfege/music';
import type { RhythmTapMove, RhythmTapState } from './logic';

const FEEDBACK_FLASH_MS = 260;

// Compte à rebours « 3, 2, 1 » avant la chanson, au même tempo qu'elle
// (retour utilisateur après test réel sur iPad — un pendule seul ne
// suffisait pas, il fallait de vrais chiffres) : le temps de se caler sur le
// rythme avant que les temps ne comptent vraiment.
const COUNT_IN_BEATS = 3;

// Jamais de rouge/croix (CLAUDE.md : « pas d'échec sec ») — « en avance »/
// « en retard » ont le même traitement visuel discret, seul « bien » se
// distingue franchement.
const FEEDBACK_COLORS: Record<'good' | 'early' | 'late', string> = {
  good: '#4F8F6B',
  early: 'rgba(242,228,201,0.3)',
  late: 'rgba(242,228,201,0.3)',
};

export function Board({ state, onMove }: BoardProps<RhythmTapState, RhythmTapMove>) {
  // Calibration obligatoire avant tout jeu de rythme (spec 05) : phase interne
  // au Board, zéro modification du shell — même patron que la phase 'setup'
  // de sound-memory, mais hors de l'état du jeu (ce n'est pas une notion de
  // partie, seulement une propriété d'appareil lue via storage/index.ts).
  const [calibrated, setCalibrated] = useState(() => getCalibrationOffsetMs() !== undefined);
  const [flash, setFlash] = useState<'good' | 'early' | 'late' | null>(null);
  // Compte à rebours avant la vraie mélodie : taps ignorés, tapis inerte,
  // « 3, 2, 1 » affiché en chiffres (countInNumber). Une fois la mélodie
  // lancée, le pendule (Metronome) prend le relai pour cadencer le temps.
  // `metronomeReference` suit l'instant de départ de la mélodie, pour que le
  // pendule reste en phase avec le son réel.
  const [countingIn, setCountingIn] = useState(false);
  const [countInNumber, setCountInNumber] = useState<number | null>(null);
  const [metronomeReference, setMetronomeReference] = useState<number | null>(null);
  const playbackRef = useRef<PlaybackHandle | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      playbackRef.current?.stop();
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  // Lance le compte à rebours puis la mélodie à chaque entrée en phase
  // 'playing' — un aller simple. state.phase ne change qu'au
  // 'start'/'restart'/'melodyDone', jamais sur un tap (qui ne touche que
  // claimedBeats/lastTapResult/tapCount), donc cet effet ne relance jamais la
  // lecture en cours de manche — même garantie que sound-memory/Board.tsx
  // pour sa lecture de séquence. `onMove` absent des dépendances pour la
  // même raison que là-bas (recréé à chaque rendu du shell).
  useEffect(() => {
    if (state.phase !== 'playing') return undefined;
    setCountingIn(true);

    function startMelody() {
      setCountingIn(false);
      setCountInNumber(null);
      const { melody } = getMelody(state.melodyId);
      // Enchaîne sur la case suivante de la grille du compte à rebours — pas
      // un nouveau LEAD_IN_SEC, qui romprait le rythme entre le dernier
      // temps compté et la première note (retour utilisateur après test
      // réel : l'écart se sentait). Le compte à rebours va de 0 à
      // COUNT_IN_BEATS - 1 (affichés « 3, 2, 1 ») ; la première note tombe
      // exactement là où un temps COUNT_IN_BEATS (le « 0 » silencieux)
      // serait tombé.
      const firstNoteTime = countInHandle.startTime + COUNT_IN_BEATS * countInHandle.secPerBeat;
      const handle = playMelody(
        melody,
        state.tempoBpm,
        () => onMove({ type: 'melodyDone' }),
        () => onMove({ type: 'restart' }),
        firstNoteTime,
      );
      playbackRef.current = handle;
      setMetronomeReference(handle.startTime);
    }

    const countInHandle = playClickTrack(
      COUNT_IN_BEATS,
      state.tempoBpm,
      (beatIndex) => setCountInNumber(COUNT_IN_BEATS - beatIndex),
      startMelody,
      () => onMove({ type: 'restart' }), // arrière-plan pendant le compte à rebours
    );
    playbackRef.current = countInHandle;

    return () => {
      playbackRef.current?.stop();
      playbackRef.current = null;
      setCountingIn(false);
      setCountInNumber(null);
      setMetronomeReference(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  // Flash de retour visuel — rejoué à chaque tap même quand le classement se
  // répète (state.tapCount change à chaque tap, contrairement à
  // lastTapResult qui peut valoir deux fois de suite la même chose : une
  // valeur React inchangée ne redéclencherait pas cet effet, voir logic.ts).
  useEffect(() => {
    if (state.tapCount === 0 || !state.lastTapResult) return undefined;
    setFlash(state.lastTapResult);
    flashTimerRef.current = setTimeout(() => setFlash(null), FEEDBACK_FLASH_MS);
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.tapCount]);

  function handleStart() {
    play('tap');
    onMove({ type: 'start' });
  }

  function handleTap() {
    if (state.phase !== 'playing' || countingIn) return;
    const handle = playbackRef.current;
    if (!handle) return;
    // Lu de façon synchrone, dans ce même geste — pas performance.now() : le
    // biais constant d'un gestionnaire tactile est ce que la calibration
    // absorbe, pas quelque chose à corriger par une seconde horloge (voir
    // solfege/calibration.ts).
    const atBeat = (audioNow() - handle.startTime) / handle.secPerBeat;
    play('tap');
    onMove({ type: 'tap', atBeat });
  }

  if (!calibrated) {
    return <CalibrationScreen onDone={() => setCalibrated(true)} />;
  }

  if (state.phase === 'ready') {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-10 rounded-3xl bg-piece/10 p-6">
        <button
          type="button"
          onTouchStart={handleStart}
          onPointerDown={(e) => {
            if (e.pointerType === 'mouse') handleStart();
          }}
          aria-label="Commencer"
          className="flex h-40 w-40 items-center justify-center rounded-full bg-victory text-board shadow-[0_6px_0_0_rgba(0,0,0,0.25)] transition-transform active:translate-y-1 active:shadow-[0_2px_0_0_rgba(0,0,0,0.25)] sm:h-56 sm:w-56"
        >
          <svg viewBox="0 0 24 24" className="h-16 w-16 sm:h-20 sm:w-20" fill="currentColor" aria-hidden>
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
        <p className="text-xl text-piece/80">Prête à taper le rythme ?</p>
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-full bg-piece/10 px-3 py-2">
        {state.claimedBeats.map((claimed, i) => (
          <span
            key={i}
            className="h-2.5 w-2.5 rounded-full sm:h-3 sm:w-3"
            style={{ backgroundColor: claimed ? '#F5A623' : 'rgba(242,228,201,0.25)' }}
          />
        ))}
      </div>

      {/* Tout l'espace de jeu est la cible — « un tapis large, pas de petites
          cibles » (spec 05) — pas une grille de pads comme sound-memory.
          Pendant le compte à rebours (tapis inerte, `disabled`) : « 3, 2, 1 »
          en chiffres. Une fois la mélodie lancée : le pendule cadence le
          temps par-dessus. */}
      <button
        type="button"
        disabled={state.phase !== 'playing' || countingIn}
        onTouchStart={handleTap}
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse') handleTap();
        }}
        aria-label="Taper le rythme"
        className="relative flex-1 rounded-3xl transition-[background-color,transform] duration-100"
        style={{
          backgroundColor: flash ? FEEDBACK_COLORS[flash] : countingIn ? 'rgba(242,228,201,0.06)' : 'rgba(242,228,201,0.12)',
          transform: flash === 'good' ? 'scale(0.99)' : 'scale(1)',
        }}
      >
        {countingIn && countInNumber !== null && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span key={countInNumber} className="animate-count-in-pulse text-8xl font-extrabold text-piece sm:text-9xl">
              {countInNumber}
            </span>
          </div>
        )}
        {!countingIn && metronomeReference !== null && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <Metronome tempoBpm={state.tempoBpm} referenceTime={metronomeReference} running />
          </div>
        )}
      </button>
    </div>
  );
}
