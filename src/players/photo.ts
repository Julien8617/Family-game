const OUTPUT_SIZE = 200;
const JPEG_QUALITY = 0.8;

export interface LoadedPhoto {
  img: HTMLImageElement;
  // Le blob de l'image reste vivant tant que revoke() n'est pas appelé — à
  // faire une fois le recadrage confirmé ou annulé, jamais avant : un <img>
  // qui réutilise cette même source (le cadreur) casserait sinon.
  revoke: () => void;
}

// WebKit applique déjà l'orientation EXIF au décodage : naturalWidth/
// naturalHeight et les pixels obtenus via drawImage sont ceux, corrigés,
// qu'on veut. Ne jamais ré-appliquer de rotation par-dessus.
export function loadImage(file: File): Promise<LoadedPhoto> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, revoke: () => URL.revokeObjectURL(url) });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Photo illisible'));
    };
    img.src = url;
  });
}

// Recadre un carré de côté `side` (le plus petit côté de l'image) dont le
// coin haut-gauche est (sx, sy) en pixels de l'image d'origine, et
// redimensionne à 200×200 en JPEG. Le cadreur (PhotoCropper) calcule sx/sy ;
// (naturalWidth-side)/2, (naturalHeight-side)/2 donne le centrage par défaut.
export function cropToDataUrl(img: HTMLImageElement, sx: number, sy: number): string {
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponible');
  ctx.drawImage(img, sx, sy, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}
