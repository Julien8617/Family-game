import { useEffect, useRef, useState } from 'react';
import { audioNow, playClickTrack } from './audio';
import { computeCalibration, setCalibrationOffsetMs } from './calibration';
import type { CalibrationSample } from './calibration';
import type { PlaybackHandle } from './audio';
import { Metronome } from './Metronome';

// Tempo fixe du clic de calibration — pas un réglage, la mesure n'a pas
// besoin de varier avec le niveau choisi ensuite pour un jeu de rythme.
const TEMPO_BPM = 90;
const BEAT_COUNT = 8;
// Compte à rebours avant la mesure elle-même (retour utilisateur après test
// réel sur iPad) : le temps de se caler sur le tempo avant que les 8 taps
// mesurés ne commencent, au même tempo que la mesure qui suit.
const COUNT_IN_BEATS = 4;
const PULSE_FLASH_MS = 140;
const SUCCESS_HOLD_MS = 1100;

type Stage = 'intro' | 'counting-in' | 'running' | 'success' | 'retry';

interface CalibrationScreenProps {
  onDone(): void;
  onCancel?(): void;
}

// Écran de calibration, partagé entre deux points d'entrée (spec 05) : une
// route à part depuis l'écran Joueurs, ou embarqué en phase interne à
// rhythm-tap/Board.tsx quand aucun offset n'est encore enregistré. Aucun des
// deux appelants n'a besoin de savoir comment la mesure est faite.
export function CalibrationScreen({ onDone, onCancel }: CalibrationScreenProps) {
  const [stage, setStage] = useState<Stage>('intro');
  const [pulse, setPulse] = useState(false);
  const samplesRef = useRef<CalibrationSample[]>([]);
  const beatTimesRef = useRef<number[]>([]);
  const handleRef = useRef<PlaybackHandle | null>(null);
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      handleRef.current?.stop();
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    };
  }, []);

  // Passage en arrière-plan pendant le compte à rebours ou la mesure : on ne
  // laisse jamais l'écran bloqué en silence, on revient à l'invite de départ
  // plutôt que de proposer un « on refait un tour » qui laisserait croire à
  // une mesure ratée.
  function handleInterrupted() {
    handleRef.current = null;
    setStage('intro');
  }

  function start() {
    handleRef.current?.stop(); // au cas où : un essai précédent n'a pas fini de lui-même
    samplesRef.current = [];
    setStage('counting-in');
    const handle = playClickTrack(COUNT_IN_BEATS, TEMPO_BPM, () => {}, beginMeasurement, handleInterrupted);
    handleRef.current = handle;
  }

  function beginMeasurement() {
    setStage('running');
    beatTimesRef.current = [];
    const handle = playClickTrack(
      BEAT_COUNT,
      TEMPO_BPM,
      (beatIndex, time) => {
        beatTimesRef.current[beatIndex] = time;
        setPulse(true);
        if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
        pulseTimerRef.current = setTimeout(() => setPulse(false), PULSE_FLASH_MS);
      },
      () => {
        // Fin du clic : si l'enfant a tapé moins de 8 fois, il manque des
        // échantillons — computeCalibration renvoie alors { ok: false } de
        // lui-même (moins de 8), donc rien de spécial à faire ici.
        finish();
      },
      handleInterrupted,
    );
    handleRef.current = handle;
  }

  function finish() {
    const result = computeCalibration(samplesRef.current);
    if (result.ok) {
      setCalibrationOffsetMs(result.offsetMs);
      setStage('success');
      setTimeout(onDone, SUCCESS_HOLD_MS);
    } else {
      setStage('retry');
    }
  }

  function handleTap() {
    if (stage !== 'running') return;
    if (samplesRef.current.length >= BEAT_COUNT) return;
    const handle = handleRef.current;
    if (!handle) return;
    const index = samplesRef.current.length;
    const expectedTime = handle.startTime + index * handle.secPerBeat;
    samplesRef.current.push({ expectedTime, actualTime: audioNow() });
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-10 bg-board px-6 py-10">
      <div className="relative flex flex-1 items-center justify-center">
        {stage === 'counting-in' ? (
          <Metronome tempoBpm={TEMPO_BPM} referenceTime={handleRef.current?.startTime ?? 0} running />
        ) : (
          <button
            type="button"
            onTouchStart={(e) => {
              e.preventDefault();
              if (stage === 'intro' || stage === 'retry') start();
              else handleTap();
            }}
            onPointerDown={(e) => {
              if (e.pointerType !== 'mouse') return; // le vrai tap vient de onTouchStart sur iOS
              if (stage === 'intro' || stage === 'retry') start();
              else handleTap();
            }}
            aria-label={stage === 'running' ? 'Taper le rythme' : 'Commencer la calibration'}
            className="flex h-56 w-56 items-center justify-center rounded-full transition-transform duration-100 sm:h-72 sm:w-72"
            style={{
              backgroundColor: stage === 'success' ? '#4F8F6B' : '#F2E4C9',
              transform: pulse ? 'scale(1.08)' : 'scale(1)',
              boxShadow:
                stage === 'success'
                  ? '0 0 0 8px rgba(79,143,107,0.4)'
                  : '0 6px 0 0 rgba(0,0,0,0.25)',
            }}
          />
        )}
      </div>

      {stage === 'intro' && <p className="text-xl text-piece/80">Tape en rythme sur le disque.</p>}
      {stage === 'counting-in' && <p className="text-xl text-piece/80">Écoute le tempo…</p>}
      {stage === 'running' && <p className="text-xl text-piece/80">Suis le rythme…</p>}
      {stage === 'retry' && <p className="text-xl text-piece/80">On refait un tour, en tapant bien en rythme.</p>}
      {stage === 'success' && <p className="text-xl text-piece/80">Parfait !</p>}

      {onCancel && stage !== 'success' && (
        <button
          type="button"
          onClick={onCancel}
          className="h-16 rounded-2xl bg-piece/20 px-6 text-lg text-piece"
        >
          ← Retour
        </button>
      )}
    </div>
  );
}
