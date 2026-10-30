/** Small 2D geometry helpers. All lengths are meters, plan coordinates (x east, y south/down on plan). */

export interface Vec2 {
  x: number;
  y: number;
}

export const v2 = (x: number, y: number): Vec2 => ({ x, y });

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function smoothstep(e0: number, e1: number, x: number): number {
  if (e0 === e1) return x < e0 ? 0 : 1;
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Polynomial smooth minimum (k = blend width in value units). */
export function smin(a: number, b: number, k: number): number {
  if (k <= 0) return Math.min(a, b);
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return lerp(b, a, h) - k * h * (1 - h);
}

/** Signed shoelace area. Positive for counter-clockwise in a y-up frame. */
export function signedArea(poly: readonly Vec2[]): number {
  let s = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

export function polygonArea(poly: readonly Vec2[]): number {
  return Math.abs(signedArea(poly));
}

export function polylineLength(poly: readonly Vec2[], closed: boolean): number {
  let s = 0;
  const n = poly.length;
  const m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) s += dist(poly[i], poly[(i + 1) % n]);
  return s;
}

export function centroid(poly: readonly Vec2[]): Vec2 {
  let cx = 0;
  let cy = 0;
  let a = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % n];
    const c = p.x * q.y - q.x * p.y;
    a += c;
    cx += (p.x + q.x) * c;
    cy += (p.y + q.y) * c;
  }
  if (Math.abs(a) < 1e-12) {
    const s = poly.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: s.x / poly.length, y: s.y / poly.length };
  }
  return { x: cx / (3 * a), y: cy / (3 * a) };
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function bounds(pts: readonly Vec2[]): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

export function pointInPolygon(p: Vec2, poly: readonly Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Closest point on segment ab to p; returns parameter t in [0,1] and squared distance. */
export function closestOnSegment(p: Vec2, a: Vec2, b: Vec2): { t: number; d2: number; x: number; y: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 : 0;
  t = clamp(t, 0, 1);
  const x = a.x + dx * t;
  const y = a.y + dy * t;
  return { t, d2: (p.x - x) ** 2 + (p.y - y) ** 2, x, y };
}

/** Uniformly resample a polyline by arc length. Closed polylines don't repeat the first point. */
export function resample(poly: readonly Vec2[], spacing: number, closed: boolean): Vec2[] {
  const n = poly.length;
  if (n < 2) return poly.slice();
  const total = polylineLength(poly, closed);
  const count = Math.max(closed ? 3 : 2, Math.round(total / spacing));
  const step = total / (closed ? count : count - 1);
  const out: Vec2[] = [];
  let seg = 0;
  let segStart = 0;
  let segLen = dist(poly[0], poly[1 % n]);
  const segCount = closed ? n : n - 1;
  for (let k = 0; k < count; k++) {
    const s = k * step;
    while (seg < segCount - 1 && segStart + segLen < s) {
      segStart += segLen;
      seg++;
      segLen = dist(poly[seg], poly[(seg + 1) % n]);
    }
    const t = segLen > 0 ? clamp((s - segStart) / segLen, 0, 1) : 0;
    const a = poly[seg];
    const b = poly[(seg + 1) % n];
    out.push({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
  }
  return out;
}

/** Ramer–Douglas–Peucker simplification of an open polyline. */
export function simplifyRDP(pts: readonly Vec2[], tol: number): Vec2[] {
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length);
  keep[0] = 1;
  keep[pts.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, pts.length - 1]];
  const tol2 = tol * tol;
  while (stack.length) {
    const [s, e] = stack.pop()!;
    let maxD = -1;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const { d2 } = closestOnSegment(pts[i], pts[s], pts[e]);
      if (d2 > maxD) {
        maxD = d2;
        idx = i;
      }
    }
    if (idx >= 0 && maxD > tol2) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}
