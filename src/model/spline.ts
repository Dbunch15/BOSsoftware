/**
 * Closed centripetal Catmull-Rom splines (Barry–Goldman formulation).
 * The outline and zone polygons are all stored as control points and sampled here.
 */
import { type Vec2, clamp, closestOnSegment, dist, lerp, polylineLength, resample, signedArea } from './geometry';

function knot(a: Vec2, b: Vec2, alpha: number): number {
  return Math.max(Math.pow(dist(a, b), alpha), 1e-4);
}

function crPoint(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, alpha: number, u: number): Vec2 {
  const t0 = 0;
  const t1 = t0 + knot(p0, p1, alpha);
  const t2 = t1 + knot(p1, p2, alpha);
  const t3 = t2 + knot(p2, p3, alpha);
  const t = lerp(t1, t2, u);
  const mix = (a: Vec2, b: Vec2, ta: number, tb: number): Vec2 => {
    const w = (t - ta) / (tb - ta);
    return { x: a.x + (b.x - a.x) * w, y: a.y + (b.y - a.y) * w };
  };
  const a1 = mix(p0, p1, t0, t1);
  const a2 = mix(p1, p2, t1, t2);
  const a3 = mix(p2, p3, t2, t3);
  const b1 = mix(a1, a2, t0, t2);
  const b2 = mix(a2, a3, t1, t3);
  return mix(b1, b2, t1, t2);
}

export interface DenseSamples {
  pts: Vec2[];
  /** For each dense sample, the index of the control-point segment it belongs to. */
  seg: Int32Array;
}

/** Dense sampling of a closed spline; roughly `step` meters between samples. */
export function sampleClosedDense(ctrl: readonly Vec2[], alpha = 0.5, step = 0.05): DenseSamples {
  const n = ctrl.length;
  const pts: Vec2[] = [];
  const segs: number[] = [];
  if (n < 3) return { pts: ctrl.slice(), seg: new Int32Array(ctrl.map((_, i) => i)) };
  for (let i = 0; i < n; i++) {
    const p0 = ctrl[(i - 1 + n) % n];
    const p1 = ctrl[i];
    const p2 = ctrl[(i + 1) % n];
    const p3 = ctrl[(i + 2) % n];
    const count = Math.max(4, Math.ceil((dist(p1, p2) * 1.3) / step));
    for (let k = 0; k < count; k++) {
      pts.push(crPoint(p0, p1, p2, p3, alpha, k / count));
      segs.push(i);
    }
  }
  return { pts, seg: Int32Array.from(segs) };
}

export interface OutlineSamples {
  /** Uniformly spaced samples along the closed curve; sample k sits at u = k / pts.length. */
  pts: Vec2[];
  length: number;
  spacing: number;
  /** +1 if the interior is on the left of the travel direction (positive signed area), else -1. */
  orientation: 1 | -1;
}

export function sampleOutline(ctrl: readonly Vec2[], alpha = 0.5, spacing = 0.1): OutlineSamples {
  const dense = sampleClosedDense(ctrl, alpha, Math.min(0.05, spacing / 2));
  const pts = resample(dense.pts, spacing, true);
  const length = polylineLength(pts, true);
  return {
    pts,
    length,
    spacing: length / pts.length,
    orientation: signedArea(pts) >= 0 ? 1 : -1,
  };
}

/** Arc-length parameter u ∈ [0,1) of each control point along the closed spline. */
export function controlPointUs(ctrl: readonly Vec2[], alpha = 0.5): number[] {
  const dense = sampleClosedDense(ctrl, alpha, 0.02);
  const total = polylineLength(dense.pts, true);
  const out: number[] = new Array(ctrl.length).fill(0);
  let s = 0;
  let lastSeg = -1;
  for (let k = 0; k < dense.pts.length; k++) {
    if (dense.seg[k] !== lastSeg) {
      lastSeg = dense.seg[k];
      out[lastSeg] = total > 0 ? s / total : 0;
    }
    s += dist(dense.pts[k], dense.pts[(k + 1) % dense.pts.length]);
  }
  return out;
}

const wrap01 = (u: number) => ((u % 1) + 1) % 1;

export function sampleIndexAt(s: OutlineSamples, u: number): number {
  return Math.round(wrap01(u) * s.pts.length) % s.pts.length;
}

export interface Frame {
  p: Vec2;
  tangent: Vec2;
  /** Unit normal pointing into the pool. */
  inward: Vec2;
}

export function frameAt(s: OutlineSamples, u: number): Frame {
  const n = s.pts.length;
  const f = wrap01(u) * n;
  const i = Math.floor(f) % n;
  const t = f - Math.floor(f);
  const a = s.pts[i];
  const b = s.pts[(i + 1) % n];
  const p = { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
  const prev = s.pts[(i - 1 + n) % n];
  const next = s.pts[(i + 2) % n];
  let tx = next.x - prev.x;
  let ty = next.y - prev.y;
  const l = Math.hypot(tx, ty) || 1;
  tx /= l;
  ty /= l;
  return { p, tangent: { x: tx, y: ty }, inward: { x: -ty * s.orientation, y: tx * s.orientation } };
}

/** Length of a span from u0 to u1 travelling in +u (wrapping). */
export function spanFraction(u0: number, u1: number): number {
  const d = wrap01(u1) - wrap01(u0);
  return d >= 0 ? d : d + 1;
}

/** The open sub-polyline between u0 and u1 (travelling in +u, wrapping through 0). */
export function extractSpan(s: OutlineSamples, u0: number, u1: number): Vec2[] {
  const n = s.pts.length;
  const frac = spanFraction(u0, u1);
  const count = Math.max(2, Math.round(frac * n) + 1);
  const out: Vec2[] = [];
  for (let k = 0; k < count; k++) out.push(frameAt(s, u0 + (frac * k) / (count - 1)).p);
  return out;
}

export function nearestOnOutline(s: OutlineSamples, p: Vec2): { u: number; d: number; point: Vec2 } {
  const n = s.pts.length;
  let best = Infinity;
  let bu = 0;
  let bp = s.pts[0];
  for (let i = 0; i < n; i++) {
    const c = closestOnSegment(p, s.pts[i], s.pts[(i + 1) % n]);
    if (c.d2 < best) {
      best = c.d2;
      bu = (i + c.t) / n;
      bp = { x: c.x, y: c.y };
    }
  }
  return { u: wrap01(bu), d: Math.sqrt(best), point: bp };
}

/** Where a new control point should be inserted to land on the curve nearest p. */
export function insertionFor(ctrl: readonly Vec2[], alpha: number, p: Vec2): { index: number; point: Vec2; d: number } {
  const dense = sampleClosedDense(ctrl, alpha, 0.03);
  const n = dense.pts.length;
  let best = Infinity;
  let bi = 0;
  let bp = dense.pts[0];
  for (let i = 0; i < n; i++) {
    const c = closestOnSegment(p, dense.pts[i], dense.pts[(i + 1) % n]);
    if (c.d2 < best) {
      best = c.d2;
      bi = i;
      bp = { x: c.x, y: c.y };
    }
  }
  return { index: dense.seg[bi] + 1, point: bp, d: Math.sqrt(best) };
}

/** Curvature radius at each uniform sample using points ±k samples away (circumradius). */
export function curvatureRadii(s: OutlineSamples, window = 0.3): Float32Array {
  const n = s.pts.length;
  const k = clamp(Math.round(window / s.spacing), 1, Math.floor(n / 4));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = s.pts[(i - k + n) % n];
    const b = s.pts[i];
    const c = s.pts[(i + k) % n];
    const ab = dist(a, b);
    const bc = dist(b, c);
    const ca = dist(c, a);
    const area2 = Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y));
    out[i] = area2 < 1e-12 ? Infinity : (ab * bc * ca) / (2 * area2);
  }
  return out;
}

/** OutlineSamples from an arbitrary closed polyline (used for analytic shapes in tests and imports). */
export function polylineSamples(poly: readonly Vec2[], spacing = 0.1): OutlineSamples {
  const pts = resample(poly, spacing, true);
  const length = polylineLength(pts, true);
  return { pts, length, spacing: length / pts.length, orientation: signedArea(pts) >= 0 ? 1 : -1 };
}
