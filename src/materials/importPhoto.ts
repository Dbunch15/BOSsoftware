/** Browser side of the sample-photo pipeline: decode, crop, resize, process in a worker, encode. */
import type { PhotoJob, PhotoResult } from './photo.worker';

export interface FinishPhoto {
  finishId: string;
  albedo: Blob;
  normal: Blob;
  roughness: Blob;
  /** Real-world width covered by one texture tile (m). */
  tileSize: number;
  size: number;
  mean: string;
  sourceName: string;
  createdAt: string;
}

const largestPow2 = (n: number) => 2 ** Math.floor(Math.log2(n));

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Encoding failed'))), type, quality));
}

function encode(w: number, h: number, buffer: ArrayBuffer, quality: number): Promise<Blob> {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(buffer), w, h), 0, 0);
  return toBlob(c, 'image/jpeg', quality);
}

/**
 * Turn a photo of a physical sample into tileable maps. The centre square of the photo is used;
 * `sampleWidth` is the real width (m) of that square, which sets the texture scale.
 */
export async function processPhotoFile(
  file: Blob & { name?: string },
  finishId: string,
  opts: { size: number; sampleWidth: number; normalStrength?: number },
): Promise<FinishPhoto> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const size = Math.max(256, Math.min(opts.size, largestPow2(side)));
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
  bmp.close();
  const pixels = ctx.getImageData(0, 0, size, size);

  const worker = new Worker(new URL('./photo.worker.ts', import.meta.url), { type: 'module' });
  const result = await new Promise<PhotoResult>((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<PhotoResult>) => resolve(e.data);
    worker.onerror = (e) => reject(new Error(e.message || 'Processing failed'));
    const job: PhotoJob = { w: size, h: size, buffer: pixels.data.buffer, normalStrength: opts.normalStrength ?? 2.5 };
    worker.postMessage(job, [job.buffer]);
  }).finally(() => worker.terminate());

  const [albedo, normal, roughness] = await Promise.all([
    encode(size, size, result.albedo, 0.92),
    encode(size, size, result.normal, 0.95),
    encode(size, size, result.roughness, 0.9),
  ]);
  return {
    finishId,
    albedo,
    normal,
    roughness,
    tileSize: opts.sampleWidth,
    size,
    mean: result.mean,
    sourceName: file.name ?? 'photo',
    createdAt: new Date().toISOString(),
  };
}
