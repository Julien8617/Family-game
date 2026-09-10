import type { PlayerId } from '../games/types';
import type { Player } from '../players/types';

// Seul module de toute l'app à toucher localStorage (CLAUDE.md, conventions de
// code). Deux espaces de clés indépendants, chacun avec sa version de schéma.

export type SaveResult = { ok: true } | { ok: false; error: 'quota' | 'unknown' };

function readJSON(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJSON(key: string, data: unknown): SaveResult {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return { ok: true };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      return { ok: false, error: 'quota' };
    }
    return { ok: false, error: 'unknown' };
  }
}

// ---- players ----
// Clé et forme inchangées depuis la spec 02 : ce refactor ne fait que déplacer
// le code, pas les données. Les profils déjà sur l'iPad survivent sans migration.

const PLAYERS_KEY = 'players';
const PLAYERS_VERSION = 1;

interface StoredPlayers {
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
  const parsed = readJSON(PLAYERS_KEY);
  if (typeof parsed !== 'object' || parsed === null) return [];
  const data = parsed as Partial<StoredPlayers>;
  // Pas de migration pour l'instant : une version inconnue est traitée comme
  // absente plutôt que de risquer de faire planter le démarrage.
  if (data.version !== PLAYERS_VERSION || !Array.isArray(data.players)) return [];
  return data.players.filter(isPlayer);
}

export function getPlayer(id: PlayerId): Player | undefined {
  return listPlayers().find((p) => p.id === id);
}

function writePlayers(players: Player[]): SaveResult {
  const data: StoredPlayers = { version: PLAYERS_VERSION, players };
  return writeJSON(PLAYERS_KEY, data);
}

export function createPlayer(player: Player): SaveResult {
  return writePlayers([...listPlayers(), player]);
}

export function updatePlayer(player: Player): SaveResult {
  return writePlayers(listPlayers().map((p) => (p.id === player.id ? player : p)));
}

export function deletePlayer(id: PlayerId): void {
  writePlayers(listPlayers().filter((p) => p.id !== id));
}

// ---- settings ----

const SETTINGS_KEY = 'settings';
const SETTINGS_VERSION = 1;

export interface Settings {
  soundEnabled: boolean;
  // Dernier niveau de bot choisi (spec 04), proposé par défaut la fois
  // suivante. Optionnel : absent tant qu'aucune partie contre l'ordinateur
  // n'a été lancée, y compris pour un profil stocké avant la spec 04.
  lastBotLevel?: number;
  // Même principe pour GameMeta.soloLevels (mémoire sonore) — un seul champ
  // plat tant qu'un seul jeu solo à niveaux existe, à revoir (clé par jeu) si
  // un second en a besoin.
  lastSoloLevel?: number;
  // Derniers joueurs (et mode) utilisés, par jeu — pour présélectionner la
  // même équipe la fois suivante plutôt que de tout retaper. Par jeu (pas un
  // champ plat comme lastBotLevel) : Alice+Bob au morpion n'a aucune raison
  // de présélectionner la même paire à la course des poussins.
  lastPlayers?: Record<string, { mode: 'family' | 'computer'; playerIds: PlayerId[] }>;
  // Interrupteur de secours (shell/palmRejection.ts), validé sur l'iPad réel
  // (voir NOTES.md) — activé par défaut (absent ⇒ true), désactivable depuis
  // l'écran Joueurs si un appareil se comporte différemment.
  palmRejectionEnabled?: boolean;
}

const DEFAULT_SETTINGS: Settings = { soundEnabled: true };

interface StoredSettings {
  version: number;
  settings: Settings;
}

function isSettings(value: unknown): value is Partial<Settings> {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.soundEnabled !== 'boolean') return false;
  if (v.lastBotLevel !== undefined && typeof v.lastBotLevel !== 'number') return false;
  if (v.lastSoloLevel !== undefined && typeof v.lastSoloLevel !== 'number') return false;
  if (v.lastPlayers !== undefined && !isLastPlayersMap(v.lastPlayers)) return false;
  if (v.palmRejectionEnabled !== undefined && typeof v.palmRejectionEnabled !== 'boolean') return false;
  return true;
}

function isLastPlayersMap(value: unknown): value is Settings['lastPlayers'] {
  if (typeof value !== 'object' || value === null) return false;
  return Object.values(value as Record<string, unknown>).every((entry) => {
    if (typeof entry !== 'object' || entry === null) return false;
    const e = entry as Record<string, unknown>;
    return (
      (e.mode === 'family' || e.mode === 'computer') &&
      Array.isArray(e.playerIds) &&
      e.playerIds.every((id) => typeof id === 'string')
    );
  });
}

export function getSettings(): Settings {
  const parsed = readJSON(SETTINGS_KEY);
  if (typeof parsed !== 'object' || parsed === null) return DEFAULT_SETTINGS;
  const data = parsed as Partial<StoredSettings>;
  // Fusionné avec les valeurs par défaut : un champ ajouté après coup (comme
  // lastBotLevel en spec 04) ne doit pas rendre invalide un réglage déjà
  // stocké qui ne le connaît pas encore.
  if (data.version !== SETTINGS_VERSION || !isSettings(data.settings)) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...data.settings };
}

export function updateSettings(patch: Partial<Settings>): SaveResult {
  const next: StoredSettings = { version: SETTINGS_VERSION, settings: { ...getSettings(), ...patch } };
  return writeJSON(SETTINGS_KEY, next);
}

// ---- scores ----
// Meilleur score par (jeu, joueur, variant) — pour un jeu solo à score
// (Result.kind === 'score'), voir games/types.ts. Point laissé en suspens à
// ARCHITECTURE.md §10 ("Palmarès : compteur simple ou historique complet").
// Choix retenu ici : un seul entier (le record), pas un historique de
// parties — suffisant pour "score actuel / meilleur score".

const SCORES_KEY = 'scores';
const SCORES_VERSION = 1;

interface StoredScores {
  version: number;
  scores: Record<string, number>;
}

function scoreKey(gameId: string, playerId: string, variant?: string): string {
  return `${gameId}:${playerId}:${variant ?? 'default'}`;
}

function isScoreMap(value: unknown): value is Record<string, number> {
  if (typeof value !== 'object' || value === null) return false;
  return Object.values(value as Record<string, unknown>).every((v) => typeof v === 'number');
}

function readScores(): Record<string, number> {
  const parsed = readJSON(SCORES_KEY);
  if (typeof parsed !== 'object' || parsed === null) return {};
  const data = parsed as Partial<StoredScores>;
  if (data.version !== SCORES_VERSION || !isScoreMap(data.scores)) return {};
  return data.scores;
}

export function getHighScore(gameId: string, playerId: string, variant?: string): number {
  return readScores()[scoreKey(gameId, playerId, variant)] ?? 0;
}

// Met à jour le record si `value` le dépasse, et renvoie le meilleur score
// après coup (inchangé sinon).
export function recordScore(gameId: string, playerId: string, value: number, variant?: string): number {
  const scores = readScores();
  const key = scoreKey(gameId, playerId, variant);
  const best = Math.max(scores[key] ?? 0, value);
  writeJSON(SCORES_KEY, { version: SCORES_VERSION, scores: { ...scores, [key]: best } });
  return best;
}
