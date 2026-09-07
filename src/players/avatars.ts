import chat from './avatars/chat.svg?raw';
import chien from './avatars/chien.svg?raw';
import cochon from './avatars/cochon.svg?raw';
import dragon from './avatars/dragon.svg?raw';
import grenouille from './avatars/grenouille.svg?raw';
import herisson from './avatars/herisson.svg?raw';
import hibou from './avatars/hibou.svg?raw';
import koala from './avatars/koala.svg?raw';
import lapin from './avatars/lapin.svg?raw';
import licorne from './avatars/licorne.svg?raw';
import lion from './avatars/lion.svg?raw';
import loup from './avatars/loup.svg?raw';
import ours from './avatars/ours.svg?raw';
import panda from './avatars/panda.svg?raw';
import pingouin from './avatars/pingouin.svg?raw';
import poule from './avatars/poule.svg?raw';
import poulpe from './avatars/poulpe.svg?raw';
import renard from './avatars/renard.svg?raw';
import singe from './avatars/singe.svg?raw';
import tigre from './avatars/tigre.svg?raw';

// Chargés en texte brut (?raw) plutôt qu'en asset : un import SVG classique
// n'est mis en data URI par Vite que sous ~4 ko, et plusieurs de ces dessins
// dépassent cette limite. Au-delà, Vite en fait un fichier séparé avec une URL
// — un player.photo qui serait cette URL échouerait la validation de
// storage/index.ts (qui exige un data URI auto-suffisant). ?raw contourne le
// problème : on construit nous-mêmes un data URI, toujours, quelle que soit
// la taille.
function toDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Personnages au choix quand on ne veut pas prendre de photo. Licence des
// dessins : src/players/avatars/LICENSE.md.
export const AVATARS = [
  { id: 'renard', label: 'Renard', src: toDataUri(renard) },
  { id: 'chat', label: 'Chat', src: toDataUri(chat) },
  { id: 'chien', label: 'Chien', src: toDataUri(chien) },
  { id: 'lion', label: 'Lion', src: toDataUri(lion) },
  { id: 'tigre', label: 'Tigre', src: toDataUri(tigre) },
  { id: 'ours', label: 'Ours', src: toDataUri(ours) },
  { id: 'panda', label: 'Panda', src: toDataUri(panda) },
  { id: 'koala', label: 'Koala', src: toDataUri(koala) },
  { id: 'lapin', label: 'Lapin', src: toDataUri(lapin) },
  { id: 'grenouille', label: 'Grenouille', src: toDataUri(grenouille) },
  { id: 'cochon', label: 'Cochon', src: toDataUri(cochon) },
  { id: 'singe', label: 'Singe', src: toDataUri(singe) },
  { id: 'licorne', label: 'Licorne', src: toDataUri(licorne) },
  { id: 'hibou', label: 'Hibou', src: toDataUri(hibou) },
  { id: 'pingouin', label: 'Pingouin', src: toDataUri(pingouin) },
  { id: 'poule', label: 'Poule', src: toDataUri(poule) },
  { id: 'poulpe', label: 'Poulpe', src: toDataUri(poulpe) },
  { id: 'dragon', label: 'Dragon', src: toDataUri(dragon) },
  { id: 'loup', label: 'Loup', src: toDataUri(loup) },
  { id: 'herisson', label: 'Hérisson', src: toDataUri(herisson) },
] as const;
