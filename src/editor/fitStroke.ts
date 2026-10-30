/** Fit a freehand stroke to a small set of Catmull-Rom control points. */
import { type Vec2, dist, polylineLength, resample, simplifyRDP } from '../model/geometry';

export interface FitOptions {
  /** RDP tolerance (m). */
  tolerance: number;
  minSpacing: number;
  maxSpacing: number;
  minPoints: number;
}

export const OUTLINE_FIT: FitOptions = { tolerance: 0.12, minSpacing: 0.6, maxSpacing: 2.6, minPoints: 6 };
export const ZONE_FIT: FitOptions = { tolerance: 0.08, minSpacing: 0.35, maxSpacing: 1.6, minPoints: 4 };

/** Treats the stroke as closed. Returns null if the stroke is too small to be a shape. */
export function fitClosedStroke(raw: readonly Vec2[], opts: FitOptions = OUTLINE_FIT): Vec2[] | null {
  const pts = raw.filter((p, i) => i === 0 || dist(p, raw[i - 1]) > 1e-3);
  if (pts.length < 4) return null;
  const length = polylineLength(pts, true);
  if (length < opts.minSpacing * opts.minPoints) return null;

  const step = 0.1;
  const even = resample(pts, step, true);
  const n = even.length;
  if (n < 8) return null;

  // Light circular moving-average smoothing removes hand jitter.
  const w = 3;
  const smooth = even.map((_, i) => {
    let sx = 0;
    let sy = 0;
    for (let k = -w; k <= w; k++) {
      const q = even[(i + k + n) % n];
      sx += q.x;
      sy += q.y;
    }
    return { x: sx / (2 * w + 1), y: sy / (2 * w + 1) };
  });

  // RDP on the loop, opened at the sample farthest from the start so both halves are well conditioned.
  let far = 0;
  for (let i = 1; i < n; i++) if (dist(smooth[i], smooth[0]) > dist(smooth[far], smooth[0])) far = i;
  const half1 = simplifyRDP(smooth.slice(0, far + 1), opts.tolerance);
  const half2 = simplifyRDP([...smooth.slice(far), smooth[0]], opts.tolerance);
  const keepIdx: number[] = [];
  const indexOf = (p: Vec2) => smooth.indexOf(p);
  for (const p of half1) keepIdx.push(indexOf(p));
  for (const p of half2.slice(1, -1)) keepIdx.push(indexOf(p));

  // Enforce max spacing by inserting evenly spaced samples, and min spacing by merging.
  const maxGap = Math.round(opts.maxSpacing / step);
  const withMax: number[] = [];
  for (let k = 0; k < keepIdx.length; k++) {
    const a = keepIdx[k];
    const b = k + 1 < keepIdx.length ? keepIdx[k + 1] : keepIdx[0] + n;
    withMax.push(a);
    const gap = b - a;
    const extra = Math.ceil(gap / maxGap) - 1;
    for (let e = 1; e <= extra; e++) withMax.push(Math.round(a + (gap * e) / (extra + 1)) % n);
  }
  let ctrl = withMax.map((i) => smooth[i]);
  const merged: Vec2[] = [];
  for (const p of ctrl) if (!merged.length || dist(p, merged[merged.length - 1]) >= opts.minSpacing) merged.push(p);
  while (merged.length > 3 && dist(merged[0], merged[merged.length - 1]) < opts.minSpacing) merged.pop();
  ctrl = merged;

  if (ctrl.length < opts.minPoints) {
    ctrl = resample(smooth, length / opts.minPoints, true).slice(0, opts.minPoints);
  }
  return ctrl.map((p) => ({ x: Math.round(p.x * 1000) / 1000, y: Math.round(p.y * 1000) / 1000 }));
}
