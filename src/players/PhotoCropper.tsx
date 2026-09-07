import { useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { cropToDataUrl } from './photo';

const FRAME_SIZE = 260; // px, cercle de recadrage affiché à l'écran

interface PhotoCropperProps {
  img: HTMLImageElement;
  onConfirm(dataUrl: string): void;
  onCancel(): void;
}

export function PhotoCropper({ img, onConfirm, onCancel }: PhotoCropperProps) {
  const scale = FRAME_SIZE / Math.min(img.naturalWidth, img.naturalHeight);
  const scaledWidth = img.naturalWidth * scale;
  const scaledHeight = img.naturalHeight * scale;
  // <= 0 : jusqu'où l'image peut glisser avant qu'un bord n'entre dans le cadre.
  const minX = FRAME_SIZE - scaledWidth;
  const minY = FRAME_SIZE - scaledHeight;

  // Centré par défaut, comme l'ancien recadrage automatique.
  const [pos, setPos] = useState({ x: minX / 2, y: minY / 2 });
  const [drag, setDrag] = useState<{ startX: number; startY: number; origX: number; origY: number } | null>(
    null,
  );

  function clamp(x: number, y: number) {
    return {
      x: Math.min(0, Math.max(minX, x)),
      y: Math.min(0, Math.max(minY, y)),
    };
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ startX: event.clientX, startY: event.clientY, origX: pos.x, origY: pos.y });
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag) return;
    setPos(clamp(drag.origX + (event.clientX - drag.startX), drag.origY + (event.clientY - drag.startY)));
  }

  function handlePointerUp() {
    setDrag(null);
  }

  function handleConfirm() {
    onConfirm(cropToDataUrl(img, -pos.x / scale, -pos.y / scale));
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
          style={{ width: scaledWidth, height: scaledHeight, left: pos.x, top: pos.y }}
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
