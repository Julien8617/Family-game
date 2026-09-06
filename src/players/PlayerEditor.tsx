import { useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { PLAYER_COLORS } from './palette';
import { toProfilePhoto } from './photo';
import { createPlayer, deletePlayer, listPlayers, updatePlayer } from '../storage';
import type { Player } from './types';

interface PlayerEditorProps {
  player?: Player;
  onDone(): void;
  onCancel(): void;
}

export function PlayerEditor({ player, onDone, onCancel }: PlayerEditorProps) {
  const [id] = useState(() => player?.id ?? crypto.randomUUID());
  const [name, setName] = useState(player?.name ?? '');
  const [photo, setPhoto] = useState(player?.photo ?? '');
  const [color, setColor] = useState(player?.color ?? '');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const takenColors = useMemo(
    () => new Set(listPlayers().filter((p) => p.id !== id).map((p) => p.color)),
    [id],
  );

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      setPhoto(await toProfilePhoto(file));
      setError(null);
    } catch {
      setError('Photo illisible, réessaie.');
    }
  }

  const trimmedName = name.trim();
  const canSave = photo.length > 0 && trimmedName.length >= 1 && trimmedName.length <= 12 && color.length > 0;

  function handleSave() {
    if (!canSave) return;
    const record: Player = { id, name: trimmedName, photo, color };
    const result = player ? updatePlayer(record) : createPlayer(record);
    if (!result.ok) {
      setError(
        result.error === 'quota'
          ? 'Impossible d’enregistrer la photo : espace de stockage plein.'
          : 'Impossible d’enregistrer le profil.',
      );
      return;
    }
    onDone();
  }

  function handleDelete() {
    if (!player) return;
    deletePlayer(player.id);
    onDone();
  }

  return (
    <div className="flex h-screen w-screen flex-col items-center gap-8 bg-board px-12 py-10">
      <h1 className="text-4xl text-piece">{player ? 'Modifier le joueur' : 'Nouveau joueur'}</h1>

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="flex h-48 w-48 items-center justify-center overflow-hidden rounded-full bg-piece/20 text-piece shadow-[0_6px_0_0_rgba(0,0,0,0.25)]"
      >
        {photo ? (
          <img src={photo} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="px-4 text-center text-lg">Ajouter une photo</span>
        )}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handlePhotoChange}
        className="hidden"
      />

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={12}
        placeholder="Prénom"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="words"
        className="h-20 w-80 rounded-2xl bg-piece px-6 text-center text-2xl text-board outline-none"
      />

      <div className="flex flex-wrap justify-center gap-4">
        {PLAYER_COLORS.map((swatch) => {
          const isTaken = takenColors.has(swatch) && swatch !== color;
          const isSelected = swatch === color;
          return (
            <button
              key={swatch}
              type="button"
              disabled={isTaken}
              onClick={() => setColor(swatch)}
              aria-label={`Couleur ${swatch}`}
              className="flex h-20 w-20 items-center justify-center rounded-full disabled:opacity-25"
              style={{
                backgroundColor: swatch,
                boxShadow: isSelected ? '0 0 0 5px #F2E4C9' : 'none',
              }}
            >
              {isSelected && <span className="text-2xl text-piece">✓</span>}
            </button>
          );
        })}
      </div>

      {error && <p className="text-lg text-victory">{error}</p>}

      <div className="mt-auto flex flex-wrap items-center justify-center gap-6">
        <button
          type="button"
          onClick={onCancel}
          className="h-20 rounded-3xl bg-piece/20 px-8 text-xl text-piece"
        >
          Annuler
        </button>
        {player && (
          <button
            type="button"
            onClick={() => dialogRef.current?.showModal()}
            className="h-20 rounded-3xl bg-player1/20 px-8 text-xl text-player1"
          >
            Supprimer
          </button>
        )}
        <button
          type="button"
          disabled={!canSave}
          onClick={handleSave}
          className="h-20 rounded-3xl bg-victory px-10 text-2xl text-board disabled:opacity-40"
        >
          Enregistrer
        </button>
      </div>

      <dialog
        ref={dialogRef}
        className="rounded-3xl bg-piece p-8 text-board backdrop:bg-black/50"
      >
        <p className="mb-6 text-xl">Supprimer ce joueur ?</p>
        <div className="flex justify-center gap-4">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="h-16 rounded-2xl bg-board/10 px-6 text-lg"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="h-16 rounded-2xl bg-player1 px-6 text-lg text-piece"
          >
            Supprimer
          </button>
        </div>
      </dialog>
    </div>
  );
}
