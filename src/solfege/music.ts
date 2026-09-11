// Modèle musical, pur (CLAUDE.md, règle 2) — pas de React, pas de DOM, pas
// d'horloge, pas de Math.random(). Testé sans navigateur (logic.test.ts-like).
//
// Noms latins (do ré mi fa sol la si), choix retenu pour tout le socle
// solfège — voir CLAUDE.md, « spec 05 ». Écrits sans accent dans le code
// (identifiants en anglais/ASCII, CLAUDE.md « conventions de code ») : 'do',
// 're', 'mi', 'fa', 'sol', 'la', 'si'.
export type PitchName = 'do' | 're' | 'mi' | 'fa' | 'sol' | 'la' | 'si';

// Une note est une hauteur (ou un silence, pitch: null) et une durée exprimée
// en temps (beats), pas en millisecondes — la conversion en secondes dépend
// du tempo et se fait au moment de jouer (voir schedule.ts). 1 = noire, 0.5 =
// croche, 2 = blanche, etc.
export interface Note {
  pitch: PitchName | null;
  beats: number;
}

export type Melody = Note[];

// Une octave, gamme tempérée, do = do4 (261.63 Hz) — mêmes valeurs que
// sound-memory/fx/sound.ts (PAD_NOTES), pour une gamme cohérente dans toute
// l'app. « Une octave suffit pour l'instant » (spec 05) : les mélodies
// ci-dessous sont transposées/simplifiées pour tenir entre do et si, sans
// note en dessous du do ni au-dessus du si — voir le détail par mélodie.
const PITCH_FREQUENCIES: Record<PitchName, number> = {
  do: 261.63,
  re: 293.66,
  mi: 329.63,
  fa: 349.23,
  sol: 392.0,
  la: 440.0,
  si: 493.88,
};

// Exporté : réutilisé par tout module qui a besoin de l'ensemble des hauteurs
// disponibles (ex. games/note-memory/logic.ts, une paire par hauteur).
export const PITCH_ORDER: PitchName[] = ['do', 're', 'mi', 'fa', 'sol', 'la', 'si'];

export function noteToFrequency(pitch: PitchName): number {
  return PITCH_FREQUENCIES[pitch];
}

// Sens inverse (« conversion nom ↔ fréquence », spec 05) : la hauteur la plus
// proche, à condition d'être vraiment proche (1 %, largement sous l'écart
// entre deux degrés voisins de la gamme) — sinon `null`, plutôt qu'un
// mauvais nom qui ferait croire à une correspondance exacte.
const MATCH_TOLERANCE = 0.01;

export function frequencyToNote(frequency: number): PitchName | null {
  for (const pitch of PITCH_ORDER) {
    const ref = PITCH_FREQUENCIES[pitch];
    if (Math.abs(frequency - ref) / ref <= MATCH_TOLERANCE) return pitch;
  }
  return null;
}

// Libellé affiché (français, avec accent) pour une hauteur — identifiants du
// code toujours en ASCII (CLAUDE.md), l'accent n'apparaît que dans ce qui est
// montré à l'écran (ex. l'indice « nom de la note » de note-memory).
const PITCH_LABELS: Record<PitchName, string> = {
  do: 'DO',
  re: 'RÉ',
  mi: 'MI',
  fa: 'FA',
  sol: 'SOL',
  la: 'LA',
  si: 'SI',
};

export function pitchLabel(pitch: PitchName): string {
  return PITCH_LABELS[pitch];
}

export function melodyLengthInBeats(melody: Melody): number {
  return melody.reduce((total, note) => total + note.beats, 0);
}

// Bibliothèque de mélodies traditionnelles (domaine public) encodées en code
// plutôt qu'en fichiers audio — CLAUDE.md §2 : règle le poids, le cache hors
// ligne et les droits d'un coup. Rythme fidèle aux comptines d'origine ;
// certaines lignes mélodiques sont re-voicées pour tenir dans une seule
// octave (pas de note sous le do), documenté mélodie par mélodie.
export interface MelodyEntry {
  id: string;
  title: string;
  melody: Melody;
}

function n(pitch: PitchName | null, beats: number): Note {
  return { pitch, beats };
}

// « Au clair de la lune » — tient nativement dans une octave do→sol, aucune
// simplification nécessaire.
const AU_CLAIR_DE_LA_LUNE: Melody = [
  n('do', 1), n('do', 1), n('do', 1), n('re', 1),
  n('mi', 2), n('re', 2),
  n('do', 1), n('mi', 1), n('re', 1), n('do', 1),
  n('re', 2), n(null, 2),
  n('do', 1), n('do', 1), n('do', 1), n('re', 1),
  n('mi', 2), n('re', 2),
  n('do', 1), n('mi', 1), n('re', 1), n('do', 1),
  n('do', 4),
];

// « Frère Jacques » — la ligne « Ding, ding, dong » descend d'ordinaire vers
// un sol *en dessous* du do tonique (une quarte plus bas). Hors de l'octave
// disponible ici : re-voicée sur le sol *au-dessus* du do (le sol de la
// gamme, une quinte plus haut) pour rester à une seule octave — même degré
// de gamme, juste dans l'autre sens (voir NOTES.md pour le détail).
const FRERE_JACQUES: Melody = [
  n('do', 1), n('re', 1), n('mi', 1), n('do', 1),
  n('do', 1), n('re', 1), n('mi', 1), n('do', 1),
  n('mi', 1), n('fa', 1), n('sol', 2),
  n('mi', 1), n('fa', 1), n('sol', 2),
  n('sol', 0.5), n('la', 0.5), n('sol', 0.5), n('fa', 0.5), n('mi', 1), n('do', 1),
  n('sol', 0.5), n('la', 0.5), n('sol', 0.5), n('fa', 0.5), n('mi', 1), n('do', 1),
  n('do', 1), n('sol', 1), n('do', 2),
  n('do', 1), n('sol', 1), n('do', 2),
];

// « Ah ! vous dirai-je, maman » — tient nativement dans do→la (premières
// deux phrases reprises, forme ABCA classique de la comptine).
const AH_VOUS_DIRAI_JE_MAMAN: Melody = [
  n('do', 1), n('do', 1), n('sol', 1), n('sol', 1),
  n('la', 1), n('la', 1), n('sol', 2),
  n('fa', 1), n('fa', 1), n('mi', 1), n('mi', 1),
  n('re', 1), n('re', 1), n('do', 2),
  n('sol', 1), n('sol', 1), n('fa', 1), n('fa', 1),
  n('mi', 1), n('mi', 1), n('re', 2),
  n('sol', 1), n('sol', 1), n('fa', 1), n('fa', 1),
  n('mi', 1), n('mi', 1), n('re', 2),
];

// « Sur le pont d'Avignon » — simplifiée à une phrase mélodique représentative
// (rythme fidèle, contour approché) plutôt que la ronde complète : le jeu de
// rythme ne se sert que du nombre de temps, pas de l'air note à note (hors
// périmètre spec 05 : oreille, hauteur nommée).
const SUR_LE_PONT_DAVIGNON: Melody = [
  n('sol', 1), n('sol', 1), n('la', 1), n('si', 1),
  n('sol', 1), n('sol', 1), n(null, 2),
  n('la', 1), n('la', 1), n('si', 1), n('si', 1),
  n('la', 2), n(null, 2),
  n('sol', 1), n('sol', 1), n('la', 1), n('si', 1),
  n('sol', 1), n('sol', 1), n(null, 2),
  n('la', 1), n('la', 1), n('sol', 1), n('fa', 1),
  n('sol', 2), n(null, 2),
];

export const MELODIES: MelodyEntry[] = [
  { id: 'au-clair-de-la-lune', title: 'Au clair de la lune', melody: AU_CLAIR_DE_LA_LUNE },
  { id: 'frere-jacques', title: 'Frère Jacques', melody: FRERE_JACQUES },
  { id: 'ah-vous-dirai-je-maman', title: 'Ah ! vous dirai-je, maman', melody: AH_VOUS_DIRAI_JE_MAMAN },
  { id: 'sur-le-pont-davignon', title: "Sur le pont d'Avignon", melody: SUR_LE_PONT_DAVIGNON },
];

export function getMelody(id: string): MelodyEntry {
  const entry = MELODIES.find((m) => m.id === id);
  if (!entry) throw new Error(`Mélodie inconnue : ${id}`);
  return entry;
}
