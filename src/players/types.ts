import type { PlayerId } from '../games/types';

export interface Player {
  id: PlayerId;
  name: string;
  photo: string;
  color: string;
}
