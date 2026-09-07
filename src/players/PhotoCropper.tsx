import { useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { cropToDataUrl } from './photo';

const FRAME_SIZE = 260; // px, cercle de recadrage affiché à l'écran
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

interface PhotoCropperProps {
  img: HTMLImageElement;
  onConfirm(dataUrl: string): void;
  onCancel(): void;
}

export function PhotoCropper({ img, onConfirm, onCancel }: PhotoCropperProps) {
  const baseScale = FRAME_SIZE / Math.min(img.naturalWidth, img.naturalHeight);

  // Position exprimée en fraction (0..1) de la marge de défilement possible,
  // pas en pixels : indépendante du zoom, pas besoin de la recalculer quand
  // il change.
  const [panFraction, setPanFraction] = useState({ x: 0.5, y: 0.5 });
  const [zoom, setZoom] = useState(1);
  const [drag, setDrag] = useState<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const scale = baseScale * zoom;
  const scaledWidth = img.naturalWidth * scale;
  const scaledHeight = img.naturalHeight * scale;
  const rangeX = Math.max(0, scaledWidth - FRAME_SIZE);
  const rangeY = Math.max(0, scaledHeight - FRAME_SIZE);
  const posX = -rangeX * panFraction.x;
  const posY = -rangeY * panFraction.y;

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ startX: event.clientX, startY: event.clientY, origX: panFraction.x, origY: panFraction.y });
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    setPanFraction({
      x: rangeX > 0 ? clamp01(drag.origX - dx / rangeX) : 0.5,
      y: rangeY > 0 ? clamp01(drag.origY - dy / rangeY) : 0.5,
    });
  }

  function handlePointerUp() {
    setDrag(null);
  }

  function handleConfirm() {
    const side = FRAME_SIZE / scale;
    const sx = (rangeX * panFraction.x) / scale;
    const sy = (rangeY * panFraction.y) / scale;
    onConfirm(cropToDataUrl(img, sx, sy, side));
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div
        className="relative touch-none select-none overflow-hidden rounded-full"
        style={{ width: FRAME_SIZE, height: FRAME_SIZE, boxShadow: '0 0 0 5px rgba(242,228,201,0.4)' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <img
          src={img.src}
          alt=""
          draggable={false}
          className="absolute max-w-none"
          style={{ width: scaledWidth, height: scaledHeight, left: posX, top: posY }}
        />
      </div>

      <div className="flex w-64 items-center gap-3">
        <span className="text-xl text-piece" aria-hidden>
          🔍
        </span>
        <input
          type="range"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.05}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="h-10 flex-1"
          style={{ accentColor: '#F5A623' }}
          aria-label="Zoom"
        />
      </div>

      <p className="text-lg text-piece/70">Fais glisser la photo pour la recentrer</p>
      <div className="flex gap-4">
        <button
          type="button"
          onClick={onCancel}
          className="h-16 rounded-2xl bg-piece/20 px-6 text-lg text-piece"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          className="h-16 rounded-2xl bg-victory px-6 text-lg text-board"
        >
          Valider
        </button>
      </div>
    </div>
  );
}
