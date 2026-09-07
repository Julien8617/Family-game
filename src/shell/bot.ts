import type { BotLevel, PlayerId } from '../games/types';
import type { Player } from '../players/types';

// Identifiant réservé pour le joueur artificiel (spec 04). Jamais écrit dans
// storage/index.ts : la famille reste la famille.
export const BOT_PLAYER_ID: PlayerId = '__bot__';

// Couleur fixe, hors de la palette de profil (players/palette.ts) — le bot
// n'est jamais confondu avec un vrai joueur.
const BOT_COLOR = '#52707A';

export function createBotPlayer(level: BotLevel): Player {
  return {
    id: BOT_PLAYER_ID,
    name: level.label,
    photo: level.icon,
    color: BOT_COLOR,
  };
}
