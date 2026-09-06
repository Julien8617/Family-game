const OUTPUT_SIZE = 200;
const JPEG_QUALITY = 0.8;

// Recadre en carré centré, redimensionne à 200×200, exporte en JPEG. WebKit
// applique déjà l'orientation EXIF au décodage : naturalWidth/naturalHeight et les
// pixels dessinés par drawImage sont ceux, corrigés, qu'on veut. Ne pas ré-appliquer
// de rotation ici, sous peine de tourner une photo déjà droite.
export function toProfilePhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        resolve(cropAndResize(img));
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Traitement de la photo impossible'));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Photo illisible'));
    };
    img.src = url;
  });
}

function cropAndResize(img: HTMLImageElement): string {
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - side) / 2;
  const sy = (img.naturalHeight - side) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponible');
  ctx.drawImage(img, sx, sy, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}
