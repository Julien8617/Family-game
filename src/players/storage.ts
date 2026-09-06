import type { PlayerId } from '../games/types';
import type { Player } from './types';

const STORAGE_KEY = 'players';
const SCHEMA_VERSION = 1;

interface StoredData {
  version: number;
  players: Player[];
}

function isPlayer(value: unknown): value is Player {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.id === 'string' &&
    p.id.length > 0 &&
    typeof p.name === 'string' &&
    p.name.length >= 1 &&
    p.name.length <= 12 &&
    typeof p.photo === 'string' &&
    p.photo.startsWith('data:image/') &&
    typeof p.color === 'string' &&
    /^#[0-9a-fA-F]{6}$/.test(p.color)
  );
}

export function listPlayers(): Player[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return [];
    const data = parsed as Partial<StoredData>;
    // Pas de migration pour l'instant : une version inconnue est traitée comme
    // absente plutôt que de risquer de faire planter le démarrage.
    if (data.version !== SCHEMA_VERSION || !Array.isArray(data.players)) return [];
    return data.players.filter(isPlayer);
  } catch {
    return [];
  }
}

export function getPlayer(id: PlayerId): Player | undefined {
  return listPlayers().find((p) => p.id === id);
}

export type SaveResult = { ok: true } | { ok: false; error: 'quota' | 'unknown' };

function writeAll(players: Player[]): SaveResult {
  try {
    const data: StoredData = { version: SCHEMA_VERSION, players };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return { ok: true };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      return { ok: false, error: 'quota' };
    }
    return { ok: false, error: 'unknown' };
  }
}

export function createPlayer(player: Player): SaveResult {
  return writeAll([...listPlayers(), player]);
}

export function updatePlayer(player: Player): SaveResult {
  return writeAll(listPlayers().map((p) => (p.id === player.id ? player : p)));
}

export function deletePlayer(id: PlayerId): void {
  writeAll(listPlayers().filter((p) => p.id !== id));
}
