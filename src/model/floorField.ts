/**
 * Floor heightfield. A regular grid (≈10 cm) of floor elevations, water surface at 0, deck above.
 *
 * Pipeline per cell: signed distance to the outline → base depth from zones by priority with
 * smooth blending → wall ease near the waterline → benches → beach ramps by distance from their
 * edge span → sculpt deltas.
 */
import { type Bounds, type Vec2, bounds, clamp, lerp, smin, smoothstep } from './geometry';
import type { Bench, BeachEntry, DeepZone, ProjectDoc, Shell, SunShelf, Zone } from './schema';
import { type OutlineSamples, extractSpan, frameAt, sampleOutline, spanFraction } from './spline';

export interface GridSpec {
  /** Center of cell (0,0). */
  x0: number;
  y0: number;
  cell: number;
  nx: number;
  ny: number;
}

export const Region = {
  Deck: 0,
  Lip: 1,
  Wall: 2,
  Floor: 3,
  Beach: 4,
  BeachToe: 5,
  Bench: 6,
  ShelfEdge: 7,
  /** Lateral transition at the sides of a beach span. */
  BeachWing: 8,
  Lawn: 9,
} as const;
export type RegionId = (typeof Region)[keyof typeof Region];

export interface FloorField extends GridSpec {
  /** Elevation of the floor (inside) or deck/lip (outside); water surface = 0. */
  elev: Float32Array;
  /** Signed distance to the outline, positive inside the pool. */
  sdf: Float32Array;
  region: Uint8Array;
  /** Beach ramp membership 0..1 (max over beaches). */
  beachW: Float32Array;
  /** Effective run length per beach zone (compressed when the pool is too short). */
  beachRun: number[];
  /** Index of the beach zone dominating the cell, -1 if none. */
  beachZone: Int16Array;
  /** Index of the bench zone dominating the cell, -1 if none. */
  benchZone: Int16Array;
  /** Floor slope magnitude |∇elev| (rise/run). */
  slope: Float32Array;
  deckHeight: number;
}

/** Margin of grid kept around the outline beyond the sand lip (deck ring + a strip of lawn). */
export const DECK_RING = 1.9;
/** Width of the paver deck ring beyond the sand lip. */
export const DECK_WIDTH = 1.22;
/** Lawn sits slightly below the deck. */
export const LAWN_DROP = 0.035;
export const TARGET_CELL = 0.1;
export const MAX_CELLS = 140_000;
/** Fraction of the available length in front of a beach span that the beach run may use. */
export const BEACH_ROOM = 0.6;

export function makeGrid(b: Bounds, margin: number, targetCell = TARGET_CELL, maxCells = MAX_CELLS): GridSpec {
  const w = b.maxX - b.minX + 2 * margin;
  const h = b.maxY - b.minY + 2 * margin;
  let cell = targetCell;
  const est = (w / cell) * (h / cell);
  if (est > maxCells) cell = Math.ceil(targetCell * Math.sqrt(est / maxCells) * 100) / 100;
  const x0 = Math.floor((b.minX - margin) / cell) * cell;
  const y0 = Math.floor((b.minY - margin) / cell) * cell;
  const nx = Math.ceil((b.maxX + margin - x0) / cell) + 1;
  const ny = Math.ceil((b.maxY + margin - y0) / cell) + 1;
  return { x0, y0, cell, nx, ny };
}

function toSegments(poly: readonly Vec2[], closed: boolean): Float64Array {
  const n = poly.length;
  const m = closed ? n : n - 1;
  const segs = new Float64Array(m * 4);
  for (let i = 0; i < m; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    segs[i * 4] = a.x;
    segs[i * 4 + 1] = a.y;
    segs[i * 4 + 2] = b.x;
    segs[i * 4 + 3] = b.y;
  }
  return segs;
}

function segDist2(px: number, py: number, segs: Float64Array, s: number): number {
  const ax = segs[s];
  const ay = segs[s + 1];
  const dx = segs[s + 2] - ax;
  const dy = segs[s + 3] - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const ex = px - (ax + dx * t);
  const ey = py - (ay + dy * t);
  return ex * ex + ey * ey;
}

/** Exact unsigned distance from every cell center to a set of segments, with block culling. */
export function distanceGrid(g: GridSpec, poly: readonly Vec2[], closed: boolean): Float32Array {
  const segs = toSegments(poly, closed);
  const count = segs.length / 4;
  const out = new Float32Array(g.nx * g.ny);
  const B = 8;
  const r = (B * g.cell) / Math.SQRT2;
  const dc = new Float64Array(count);
  const cand = new Int32Array(count);
  for (let bj = 0; bj < g.ny; bj += B) {
    for (let bi = 0; bi < g.nx; bi += B) {
      const cx = g.x0 + (bi + (B - 1) / 2) * g.cell;
      const cy = g.y0 + (bj + (B - 1) / 2) * g.cell;
      let minDc = Infinity;
      for (let s = 0; s < count; s++) {
        const d = Math.sqrt(segDist2(cx, cy, segs, s * 4));
        dc[s] = d;
        if (d < minDc) minDc = d;
      }
      let nc = 0;
      const limit = minDc + 2 * r;
      for (let s = 0; s < count; s++) if (dc[s] <= limit) cand[nc++] = s * 4;
      const jEnd = Math.min(bj + B, g.ny);
      const iEnd = Math.min(bi + B, g.nx);
      for (let j = bj; j < jEnd; j++) {
        const py = g.y0 + j * g.cell;
        for (let i = bi; i < iEnd; i++) {
          const px = g.x0 + i * g.cell;
          let best = Infinity;
          for (let c = 0; c < nc; c++) {
            const d2 = segDist2(px, py, segs, cand[c]);
            if (d2 < best) best = d2;
          }
          out[j * g.nx + i] = Math.sqrt(best);
        }
      }
    }
  }
  return out;
}

/** Even-odd scanline fill of a closed polygon at cell centers. */
export function insideMask(g: GridSpec, poly: readonly Vec2[]): Uint8Array {
  const out = new Uint8Array(g.nx * g.ny);
  const n = poly.length;
  const xs: number[] = [];
  for (let j = 0; j < g.ny; j++) {
    const y = g.y0 + j * g.cell;
    xs.length = 0;
    for (let k = 0; k < n; k++) {
      const a = poly[k];
      const b = poly[(k + 1) % n];
      if (a.y > y !== b.y > y) xs.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x));
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const i0 = Math.max(0, Math.ceil((xs[k] - g.x0) / g.cell));
      const i1 = Math.min(g.nx - 1, Math.floor((xs[k + 1] - g.x0) / g.cell));
      for (let i = i0; i <= i1; i++) out[j * g.nx + i] = 1;
    }
  }
  return out;
}

export interface SpanDistance {
  /** Distance to the open span polyline. */
  dist: Float32Array;
  /**
   * How far outside the span's slab the cell lies: the slab is bounded by two fences through the
   * span ends, perpendicular to its chord. 0 for cells in front of the span.
   */
  over: Float32Array;
}

export function spanDistanceGrid(g: GridSpec, span: readonly Vec2[]): SpanDistance {
  const dist = distanceGrid(g, span, false);
  const over = new Float32Array(dist.length);
  const a = span[0];
  const b = span[span.length - 1];
  const cx = b.x - a.x;
  const cy = b.y - a.y;
  const cl = Math.hypot(cx, cy);
  if (cl < 0.05) return { dist, over };
  const ux = cx / cl;
  const uy = cy / cl;
  const sA = a.x * ux + a.y * uy;
  const sB = b.x * ux + b.y * uy;
  for (let k = 0; k < dist.length; k++) {
    const px = g.x0 + (k % g.nx) * g.cell;
    const py = g.y0 + Math.floor(k / g.nx) * g.cell;
    const s = px * ux + py * uy;
    over[k] = Math.max(0, sA - s, s - sB);
  }
  return { dist, over };
}

export function signedDistanceGrid(g: GridSpec, poly: readonly Vec2[]): Float32Array {
  const d = distanceGrid(g, poly, true);
  const m = insideMask(g, poly);
  for (let k = 0; k < d.length; k++) if (!m[k]) d[k] = -d[k];
  return d;
}

const objIds = new WeakMap<object, number>();
let nextObjId = 1;
function objId(o: object): number {
  let id = objIds.get(o);
  if (id === undefined) {
    id = nextObjId++;
    objIds.set(o, id);
  }
  return id;
}

const gridKey = (g: GridSpec) => `${g.x0.toFixed(4)},${g.y0.toFixed(4)},${g.cell},${g.nx},${g.ny}`;

/** Cache of derived distance grids keyed by the (immutable) source object. Keeps sculpting cheap. */
const gridCache = new WeakMap<object, { key: string; data: unknown }>();
function cached<T>(source: object, extra: string, g: GridSpec, compute: () => T): T {
  const key = gridKey(g) + '|' + extra;
  const hit = gridCache.get(source);
  if (hit && hit.key === key) return hit.data as T;
  const data = compute();
  gridCache.set(source, { key, data });
  return data;
}

/** Wall profile: 0 at the waterline, easing to 1 at x = 1 (steep at the edge, flattening onto the floor). */
export function wallEase(x: number): number {
  if (x >= 1) return 1;
  if (x <= 0) return 0;
  const t = 1 - x;
  return 1 - t * t;
}

export interface FloorInput {
  outline: OutlineSamples;
  shell: Shell;
  zones: readonly Zone[];
  sculpt: ProjectDoc['sculpt'];
  alpha?: number;
  /** Stable object used to cache the outline distance grid (e.g. the doc's outline). */
  outlineKey?: object;
  cell?: number;
}

export function computeFloorField(input: FloorInput): FloorField {
  const { outline, shell, zones, sculpt } = input;
  const alpha = input.alpha ?? 0.5;
  const margin = shell.lipWidth + DECK_RING;
  const g = makeGrid(bounds(outline.pts), margin, input.cell ?? TARGET_CELL);
  const N = g.nx * g.ny;

  const sdf = input.outlineKey
    ? cached(input.outlineKey, 'outline', g, () => signedDistanceGrid(g, outline.pts))
    : signedDistanceGrid(g, outline.pts);

  const deep = zones.filter((z): z is DeepZone => z.kind === 'deepZone');
  const shelves = zones.filter((z): z is SunShelf => z.kind === 'sunShelf');
  const benches = zones.filter((z): z is Bench => z.kind === 'bench');
  const beaches = zones.filter((z): z is BeachEntry => z.kind === 'beachEntry');

  const polySdf = (z: DeepZone | SunShelf) =>
    cached(z.polygon, 'poly', g, () => signedDistanceGrid(g, sampleOutline(z.polygon, alpha, 0.1).pts));
  // Spans depend on the outline too, so the cache key includes the outline samples' identity.
  const spanDist = (z: BeachEntry | Bench) =>
    cached(z.span, `span:${objId(outline)}`, g, () => spanDistanceGrid(g, extractSpan(outline, z.span.u0, z.span.u1)));

  const deepSdf = deep.map(polySdf);
  const shelfSdf = shelves.map(polySdf);
  const benchDist = benches.map(spanDist);
  const beachDist = beaches.map(spanDist);

  // Rasterize the sparse sculpt layer onto the grid.
  const sculptGrid = new Float32Array(N);
  const cs = sculpt.cellSize;
  for (const key in sculpt.cells) {
    const comma = key.indexOf(',');
    const x = Number(key.slice(0, comma)) * cs;
    const y = Number(key.slice(comma + 1)) * cs;
    const i = Math.round((x - g.x0) / g.cell);
    const j = Math.round((y - g.y0) / g.cell);
    if (i < 0 || j < 0 || i >= g.nx || j >= g.ny) continue;
    const w = cs >= g.cell ? 1 : (cs * cs) / (g.cell * g.cell);
    sculptGrid[j * g.nx + i] += sculpt.cells[key] * w;
  }

  // A beach needs room: if the pool in front of the span is short, the run compresses (and the
  // slope steepens) to at most BEACH_ROOM of the available length: the shortest of three rays cast
  // across the pool from the middle of the span until they reach the far wall.
  const beachRun = beaches.map((b) => {
    const frac = spanFraction(b.span.u0, b.span.u1);
    const a = frameAt(outline, b.span.u0).p;
    const c = frameAt(outline, b.span.u1).p;
    const mid = frameAt(outline, b.span.u0 + frac / 2);
    // Rays run perpendicular to the span's chord (falling back to the mid normal for closed-ish spans).
    let dir = unit(-(c.y - a.y), c.x - a.x);
    if (Math.hypot(c.x - a.x, c.y - a.y) < 0.5) dir = mid.inward;
    else if (dir.x * mid.inward.x + dir.y * mid.inward.y < 0) dir = { x: -dir.x, y: -dir.y };
    const avail = Math.min(
      ...[0.35, 0.5, 0.65].map((t) => rayLength(g, sdf, frameAt(outline, b.span.u0 + frac * t).p, dir, shell.wallRun / 3)),
    );
    return Math.max(0.5, Math.min(b.runLength, avail * BEACH_ROOM));
  });

  const elev = new Float32Array(N);
  const region = new Uint8Array(N);
  const beachW = new Float32Array(N);
  const beachZone = new Int16Array(N).fill(-1);
  const benchZone = new Int16Array(N).fill(-1);
  const { baseDepth, wallRun, lipWidth, deckHeight } = shell;

  for (let k = 0; k < N; k++) {
    const d = sdf[k];
    if (d <= 0) {
      const t = lipWidth > 0 ? clamp(-d / lipWidth, 0, 1) : 1;
      const lawn = smoothstep(lipWidth + DECK_WIDTH, lipWidth + DECK_WIDTH + 0.16, -d);
      elev[k] = deckHeight * smoothstep(0, 1, t) - LAWN_DROP * lawn;
      region[k] = t < 1 ? Region.Lip : lawn > 0.5 ? Region.Lawn : Region.Deck;
      continue;
    }

    // 1. Base depth from zones by priority (deep zones, then sun shelves), smoothly blended.
    let target = baseDepth;
    for (let z = 0; z < deep.length; z++) {
      target = lerp(target, deep[z].depth, smoothstep(-deep[z].blend / 2, deep[z].blend / 2, deepSdf[z][k]));
    }
    let reg: RegionId = d < wallRun ? Region.Wall : Region.Floor;
    for (let z = 0; z < shelves.length; z++) {
      const sd = shelfSdf[z][k];
      const half = shelves[z].blend / 2;
      target = lerp(target, shelves[z].depth, smoothstep(-half, half, sd));
      if (Math.abs(sd) < half + 2 * g.cell && (reg === Region.Floor || reg === Region.Wall)) reg = Region.ShelfEdge;
    }

    // 2. Wall ease from the waterline.
    let depth = target * wallEase(d / wallRun);

    // 3. Benches: a seat band along an edge span.
    for (let z = 0; z < benches.length; z++) {
      const b = benches[z];
      const ds = benchDist[z].dist[k];
      const wS = 1 - smoothstep(0, 0.3, Math.max(ds - d, benchDist[z].over[k]));
      if (wS <= 0) continue;
      const wB = 1 - smoothstep(b.width, b.width + 0.25, d);
      const seat = b.seatDepth * wallEase(d / 0.12);
      depth = lerp(depth, seat, wS * wB);
      if (wS > 0.05 && d < b.width + 0.6) {
        reg = Region.Bench;
        benchZone[k] = z;
      }
    }

    // 4. Beach ramps by distance from their edge span. The ramp wins wherever it is shallower than
    //    the walls/zones and fades out laterally past the span ends.
    for (let z = 0; z < beaches.length; z++) {
      const b = beaches[z];
      const ds = beachDist[z].dist[k];
      const wS = 1 - smoothstep(0, Math.max(b.taper, 1e-3), beachDist[z].over[k]);
      if (wS <= 0) continue;
      const run = beachRun[z];
      const ramp = ds <= run ? (b.endDepth * ds) / run : b.endDepth + b.toeSlope * (ds - run);
      const before = depth;
      if (ramp >= before + 0.12) continue;
      depth = lerp(before, smin(before, ramp, 0.12), wS);
      if (ramp >= before - 0.25) continue;
      if (wS < 0.98) {
        if (reg === Region.Floor || reg === Region.Wall) reg = Region.BeachWing;
      } else if (ds <= run) {
        reg = Region.Beach;
        beachZone[k] = z;
        beachW[k] = Math.max(beachW[k], wS);
      } else {
        reg = Region.BeachToe;
        beachZone[k] = z;
      }
    }

    // 5. Sculpt deltas.
    depth += sculptGrid[k];
    depth = Math.max(depth, -deckHeight);
    elev[k] = -depth;
    region[k] = reg;
  }

  return {
    ...g,
    elev,
    sdf,
    region,
    beachW,
    beachRun,
    beachZone,
    benchZone,
    slope: slopeField(g, elev),
    deckHeight,
  };
}

/** Distance from p along dir until the cell sdf drops below `minSdf` (after first exceeding it). */
function rayLength(g: GridSpec, sdf: Float32Array, p: Vec2, dir: Vec2, minSdf: number): number {
  const step = g.cell;
  let entered = false;
  const maxSteps = Math.ceil((g.nx + g.ny) * 1.5);
  for (let n = 1; n < maxSteps; n++) {
    const i = Math.round((p.x + dir.x * n * step - g.x0) / g.cell);
    const j = Math.round((p.y + dir.y * n * step - g.y0) / g.cell);
    if (i < 0 || j < 0 || i >= g.nx || j >= g.ny) return n * step;
    const d = sdf[j * g.nx + i];
    if (d >= minSdf) entered = true;
    else if (entered || d <= 0) return n * step;
  }
  return maxSteps * step;
}

export function slopeField(g: GridSpec, elev: Float32Array): Float32Array {
  const out = new Float32Array(g.nx * g.ny);
  const { nx, ny, cell } = g;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const il = i > 0 ? k - 1 : k;
      const ir = i < nx - 1 ? k + 1 : k;
      const jd = j > 0 ? k - nx : k;
      const ju = j < ny - 1 ? k + nx : k;
      const dx = (elev[ir] - elev[il]) / (((ir - il) || 1) * cell);
      const dy = (elev[ju] - elev[jd]) / ((((ju - jd) / nx) || 1) * cell);
      out[k] = Math.hypot(dx, dy);
    }
  }
  return out;
}

/** Water depth at cell k (positive below the surface). */
export const depthAt = (f: FloorField, k: number) => -f.elev[k];

/** Bilinear sample of floor depth at a plan point. */
export function sampleDepth(f: FloorField, p: Vec2): number {
  const fx = clamp((p.x - f.x0) / f.cell, 0, f.nx - 1.0001);
  const fy = clamp((p.y - f.y0) / f.cell, 0, f.ny - 1.0001);
  const i = Math.floor(fx);
  const j = Math.floor(fy);
  const tx = fx - i;
  const ty = fy - j;
  const k = j * f.nx + i;
  const a = lerp(f.elev[k], f.elev[k + 1], tx);
  const b = lerp(f.elev[k + f.nx], f.elev[k + f.nx + 1], tx);
  return -lerp(a, b, ty);
}

export function cellIndexAt(f: GridSpec, p: Vec2): number {
  const i = Math.round((p.x - f.x0) / f.cell);
  const j = Math.round((p.y - f.y0) / f.cell);
  if (i < 0 || j < 0 || i >= f.nx || j >= f.ny) return -1;
  return j * f.nx + i;
}

export function cellCenter(f: GridSpec, k: number): Vec2 {
  return { x: f.x0 + (k % f.nx) * f.cell, y: f.y0 + Math.floor(k / f.nx) * f.cell };
}

function unit(x: number, y: number): Vec2 {
  const l = Math.hypot(x, y) || 1;
  return { x: x / l, y: y / l };
}
