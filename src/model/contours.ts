/** Depth contours via marching squares over the floor field, stitched into polylines. */
import type { Vec2 } from './geometry';
import type { GridSpec } from './floorField';
import type { Units } from './schema';

export interface Contour {
  level: number;
  points: Vec2[];
  closed: boolean;
}

// Edge pairs per marching-squares case. Edges: 0 bottom (v0-v1), 1 right (v1-v2), 2 top (v3-v2), 3 left (v0-v3).
const TABLE: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [],
  [[3, 0]],
  [[0, 1]],
  [[3, 1]],
  [[1, 2]],
  [], // saddle, resolved below
  [[0, 2]],
  [[3, 2]],
  [[2, 3]],
  [[0, 2]],
  [], // saddle
  [[1, 2]],
  [[1, 3]],
  [[0, 1]],
  [[3, 0]],
  [],
];

export function marchingSquares(g: GridSpec, values: Float32Array, level: number): Contour[] {
  const { nx, ny, x0, y0, cell } = g;
  const segA: number[] = [];
  const segB: number[] = [];
  const pts = new Map<number, Vec2>();

  const hEdge = (i: number, j: number) => (j * nx + i) * 2;
  const vEdge = (i: number, j: number) => (j * nx + i) * 2 + 1;
  const edgePoint = (id: number): Vec2 => {
    let p = pts.get(id);
    if (p) return p;
    const base = id >> 1;
    const i = base % nx;
    const j = (base - i) / nx;
    const a = values[base];
    const b = id & 1 ? values[base + nx] : values[base + 1];
    const t = b === a ? 0.5 : (level - a) / (b - a);
    p = id & 1 ? { x: x0 + i * cell, y: y0 + (j + t) * cell } : { x: x0 + (i + t) * cell, y: y0 + j * cell };
    pts.set(id, p);
    return p;
  };

  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const k = j * nx + i;
      const v0 = values[k];
      const v1 = values[k + 1];
      const v2 = values[k + nx + 1];
      const v3 = values[k + nx];
      const c = (v0 > level ? 1 : 0) | (v1 > level ? 2 : 0) | (v2 > level ? 4 : 0) | (v3 > level ? 8 : 0);
      if (c === 0 || c === 15) continue;
      const edges = [hEdge(i, j), vEdge(i + 1, j), hEdge(i, j + 1), vEdge(i, j)];
      let pairs = TABLE[c];
      if (c === 5 || c === 10) {
        const centerAbove = (v0 + v1 + v2 + v3) / 4 > level;
        const isolateOdd: Array<[number, number]> = [
          [0, 1],
          [2, 3],
        ];
        const isolateEven: Array<[number, number]> = [
          [3, 0],
          [1, 2],
        ];
        pairs = c === 5 ? (centerAbove ? isolateOdd : isolateEven) : centerAbove ? isolateEven : isolateOdd;
      }
      for (const [ea, eb] of pairs) {
        segA.push(edges[ea]);
        segB.push(edges[eb]);
      }
    }
  }

  // Stitch segments into polylines via shared edge ids.
  const byEdge = new Map<number, number[]>();
  const link = (e: number, s: number) => {
    const l = byEdge.get(e);
    if (l) l.push(s);
    else byEdge.set(e, [s]);
  };
  for (let s = 0; s < segA.length; s++) {
    link(segA[s], s);
    link(segB[s], s);
  }
  const used = new Uint8Array(segA.length);
  const nextFrom = (edge: number): number => {
    const l = byEdge.get(edge);
    if (!l) return -1;
    for (const s of l) if (!used[s]) return s;
    return -1;
  };
  const out: Contour[] = [];
  for (let s0 = 0; s0 < segA.length; s0++) {
    if (used[s0]) continue;
    used[s0] = 1;
    const startEdge = segA[s0];
    const chain: number[] = [segA[s0], segB[s0]];
    // forward
    let edge = segB[s0];
    for (;;) {
      const s = nextFrom(edge);
      if (s < 0) break;
      used[s] = 1;
      edge = segA[s] === edge ? segB[s] : segA[s];
      chain.push(edge);
    }
    const closed = chain[chain.length - 1] === startEdge;
    if (!closed) {
      // backward from the start
      edge = startEdge;
      for (;;) {
        const s = nextFrom(edge);
        if (s < 0) break;
        used[s] = 1;
        edge = segA[s] === edge ? segB[s] : segA[s];
        chain.unshift(edge);
      }
    }
    const points = chain.map(edgePoint);
    if (closed) points.pop();
    out.push({ level, points, closed });
  }
  return out;
}

const FOOT = 0.3048;

/** Contour depths: every foot in imperial, every 0.25 m in metric. */
export function contourLevels(maxDepth: number, units: Units): number[] {
  const step = units === 'imperial' ? FOOT : 0.25;
  const levels: number[] = [];
  for (let d = step; d < maxDepth - 1e-6; d += step) levels.push(Math.round(d * 1e6) / 1e6);
  return levels;
}

export function depthContours(g: GridSpec, elev: Float32Array, levels: readonly number[]): Contour[] {
  const depth = new Float32Array(elev.length);
  for (let k = 0; k < elev.length; k++) depth[k] = -elev[k];
  return levels.flatMap((l) => marchingSquares(g, depth, l)).filter((c) => c.points.length >= 3);
}
