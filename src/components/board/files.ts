import { MAX_IMAGE_CHARS } from '../../domain/board';

/**
 * Files in and out of the board editor. The work happens in this browser: an
 * uploaded image is downscaled here and kept in the workspace file, and an
 * exported overlay is handed to the browser as a download. Nothing leaves
 * the machine.
 */

/** Load an image from a URL, or null if it will not decode. */
export function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('That file could not be read.'));
    reader.readAsDataURL(file);
  });
}

export type Upload = { ok: true; image: string; aspect: number } | { ok: false; message: string };

/**
 * Read an uploaded image and redraw it as a PNG no wider than maxWidth. SVG is
 * rasterised the same way, so the workspace only ever holds a PNG.
 */
export async function readBoardImage(file: File, maxWidth: number): Promise<Upload> {
  if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) {
    return { ok: false, message: 'Use a PNG, JPEG, WebP or SVG image.' };
  }
  const image = await loadImage(await readAsDataUrl(file));
  if (!image || image.naturalWidth === 0) return { ok: false, message: 'That image could not be opened.' };
  const scale = Math.min(1, maxWidth / image.naturalWidth);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return { ok: false, message: 'This browser cannot resize images.' };
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const png = canvas.toDataURL('image/png');
  if (png.length > MAX_IMAGE_CHARS) {
    return { ok: false, message: 'That image is too detailed to keep. Try a simpler one, or a smaller file.' };
  }
  return { ok: true, image: png, aspect: canvas.width / canvas.height };
}

/** Offer a canvas to the browser as a PNG download. */
export function downloadCanvas(canvas: HTMLCanvasElement, filename: string): void {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}
