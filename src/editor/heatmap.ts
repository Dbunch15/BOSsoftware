/** Depth heatmap raster for the plan view, with amber/red violation tint. */
import type { Model } from '../model/buildModel';

const STOPS: Array<[number, [number, number, number]]> = [
  [0, [214, 240, 233]],
  [0.45, [128, 214, 210]],
  [0.9, [64, 172, 196]],
  [1.5, [33, 118, 164]],
  [2.1, [20, 78, 128]],
  [2.6, [14, 50, 92]],
];

export function depthColor(d: number): [number, number, number] {
  if (d <= STOPS[0][0]) return STOPS[0][1];
  for (let s = 1; s < STOPS.length; s++) {
    if (d <= STOPS[s][0]) {
      const [d0, c0] = STOPS[s - 1];
      const [d1, c1] = STOPS[s];
      const t = (d - d0) / (d1 - d0);
      return [c0[0] + (c1[0] - c0[0]) * t, c0[1] + (c1[1] - c0[1]) * t, c0[2] + (c1[2] - c0[2]) * t];
    }
  }
  return STOPS[STOPS.length - 1][1];
}

const WARN: [number, number, number] = [245, 165, 36];
const CRIT: [number, number, number] = [240, 82, 79];

/** Returns a data URL; rows run in +y, matching plan coordinates. */
export function heatmapDataUrl(model: Model): string {
  const f = model.field;
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = f.nx;
  canvas.height = f.ny;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const img = ctx.createImageData(f.nx, f.ny);
  const px = img.data;
  for (let j = 0; j < f.ny; j++) {
    for (let i = 0; i < f.nx; i++) {
      const k = j * f.nx + i;
      const o = k * 4;
      if (f.sdf[k] <= 0) {
        px[o + 3] = 0;
        continue;
      }
      let c = depthColor(-f.elev[k]);
      const flag = model.cellFlags[k];
      if (flag) {
        const stripe = (i + j) % 6 < 3;
        const t = stripe ? 0.85 : 0.55;
        const fc = flag === 2 ? CRIT : WARN;
        c = [c[0] + (fc[0] - c[0]) * t, c[1] + (fc[1] - c[1]) * t, c[2] + (fc[2] - c[2]) * t];
      }
      px[o] = c[0];
      px[o + 1] = c[1];
      px[o + 2] = c[2];
      px[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}
