// 24 icônes de trésors, une par id (logic.ts ne connaît que le nombre —
// aucune image ici n'est importée par un fichier pur, voir CLAUDE.md règle
// 5). Ordre arbitraire mais stable : l'id d'un trésor est fixé au moment où
// le plateau est généré (logic.ts, seed) et doit rester le même tant qu'une
// partie est en cours.
import boiteCadeau from '../../vendor/maze-treasures/boite-cadeau.png';
import bougie from '../../vendor/maze-treasures/bougie.png';
import carteAuTresor from '../../vendor/maze-treasures/carte-au-tresor.png';
import chatNoir from '../../vendor/maze-treasures/chat-noir.png';
import chevalier from '../../vendor/maze-treasures/chevalier.png';
import chevalier2 from '../../vendor/maze-treasures/chevalier-2.png';
import corde from '../../vendor/maze-treasures/corde.png';
import diamant from '../../vendor/maze-treasures/diamant.png';
import dragon from '../../vendor/maze-treasures/dragon.png';
import eclair from '../../vendor/maze-treasures/eclair.png';
import epeeEnPierre from '../../vendor/maze-treasures/epee-en-pierre.png';
import fantome from '../../vendor/maze-treasures/fantome.png';
import genie from '../../vendor/maze-treasures/genie.png';
import livreDeMagie from '../../vendor/maze-treasures/livre-de-magie.png';
import loup from '../../vendor/maze-treasures/loup.png';
import pieceDunDollar from '../../vendor/maze-treasures/piece-dun-dollar.png';
import pirate from '../../vendor/maze-treasures/pirate.png';
import porte from '../../vendor/maze-treasures/porte.png';
import princesse from '../../vendor/maze-treasures/princesse.png';
import roi2 from '../../vendor/maze-treasures/roi-2.png';
import singe from '../../vendor/maze-treasures/singe.png';
import sorciere from '../../vendor/maze-treasures/sorciere.png';
import tirALarc from '../../vendor/maze-treasures/tir-a-larc.png';
import tresor from '../../vendor/maze-treasures/tresor.png';

export const TREASURE_ICONS: string[] = [
  boiteCadeau,
  bougie,
  carteAuTresor,
  chatNoir,
  chevalier,
  chevalier2,
  corde,
  diamant,
  dragon,
  eclair,
  epeeEnPierre,
  fantome,
  genie,
  livreDeMagie,
  loup,
  pieceDunDollar,
  pirate,
  porte,
  princesse,
  roi2,
  singe,
  sorciere,
  tirALarc,
  tresor,
];
