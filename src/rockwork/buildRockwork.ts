/**
 * Rockwork layout: stacks boulders in courses along a spine to form a natural rock wall, with an
 * optional waterfall spilling from its top and an optional grotto opening through it. Pure and
 * seeded, so the plan and the 3D view agree and a layout only changes when the designer asks.
 */
import { type Vec2, clamp, dist, smoothstep } from '../model/geometry';
import type { Rockwork } from '../model/schema';

export interface RockEnv {
  /** Ground (floor or deck) elevation at a plan point; water surface = 0. */
  groundAt(p: Vec2): number;
  /** Whether a plan point is inside the pool. */
  isWater(p: Vec2): boolean;
}

export interface RockInstance {
  /** Center: plan x, elevation, plan y. */
  x: number;
  y: number;
  z: number;
  /** Radii along the spine, vertical, across the spine (m). */
  sx: number;
  sy: number;
  sz: number;
  rotY: number;
  tilt: number;
  variant: number;
  shade: number;
  course: number;
  /** 0 = front (water side) row; the last row is the back wall. */
  row: number;
  slab: boolean;
  /** Top-view outline for the plan. */
  plan: Vec2[];
}

export interface FallSheet {
  /** Columns across the span; each runs from the lip down to where the water lands. */
  columns: Array<Array<{ x: number; y: number; z: number }>>;
  lipY: number;
  type: 'sheet' | 'cascade';
}

export interface RockLayout {
  rocks: RockInstance[];
  spine: Vec2[];
  length: number;
  /** +1 if the water is on the left of the spine's travel direction, -1 if on the right. */
  waterSide: 1 | -1;
  falls: FallSheet | null;
  grotto: { from: Vec2; to: Vec2; openingHeight: number; outline: Vec2[] } | null;
  topY: number;
}

export const ROCK_VARIANTS = 8;

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Spine {
  pts: Vec2[];
  cum: number[];
  length: number;
}

function makeSpine(path: readonly Vec2[]): Spine {
  const cum = [0];
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + dist(path[i - 1], path[i]));
  return { pts: path.slice(), cum, length: cum[cum.length - 1] };
}

/** Point, unit tangent and left normal at arc length s. */
function frame(sp: Spine, s: number): { p: Vec2; t: Vec2; n: Vec2 } {
  s = clamp(s, 0, sp.length);
  let i = 1;
  while (i < sp.pts.length - 1 && sp.cum[i] < s) i++;
  const a = sp.pts[i - 1];
  const b = sp.pts[i];
  const segLen = sp.cum[i] - sp.cum[i - 1] || 1;
  const u = (s - sp.cum[i - 1]) / segLen;
  const tx = (b.x - a.x) / segLen;
  const ty = (b.y - a.y) / segLen;
  return { p: { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u }, t: { x: tx, y: ty }, n: { x: -ty, y: tx } };
}

const off = (p: Vec2, n: Vec2, d: number): Vec2 => ({ x: p.x + n.x * d, y: p.y + n.y * d });

function planOutline(cx: number, cy: number, rx: number, rz: number, rot: number, variant: number): Vec2[] {
  const r = rng(variant * 977 + 13);
  const pts: Vec2[] = [];
  const n = 9;
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const j = 0.82 + r() * 0.3;
    const lx = Math.cos(a) * rx * j;
    const lz = Math.sin(a) * rz * j;
    pts.push({ x: cx + lx * c - lz * s, y: cy + lx * s + lz * c });
  }
  return pts;
}

export function buildRockwork(rw: Rockwork, env: RockEnv): RockLayout {
  const sp = makeSpine(rw.path);
  const L = Math.max(sp.length, 0.01);
  const rand = rng(rw.seed * 7919 + 17);
  const size = rw.boulderSize;
  const half = rw.thickness / 2;

  // Which side is the pool?
  let left = 0;
  let right = 0;
  for (let k = 0; k <= 10; k++) {
    const f = frame(sp, (L * k) / 10);
    if (env.isWater(off(f.p, f.n, half + 0.6))) left++;
    if (env.isWater(off(f.p, f.n, -(half + 0.6)))) right++;
  }
  const waterSide: 1 | -1 = right > left ? -1 : 1;

  // Height profile: tapering ends.
  const ease = Math.min(1.5, L / 3);
  const profile = (s: number) => rw.height * (0.4 + 0.6 * smoothstep(0, ease, s) * smoothstep(0, ease, L - s));

  const g = rw.grotto.enabled ? { s0: Math.min(rw.grotto.span.t0, rw.grotto.span.t1) * L, s1: Math.max(rw.grotto.span.t0, rw.grotto.span.t1) * L } : null;
  const opening = (s: number) => {
    if (!g || g.s1 - g.s0 < 0.2) return 0;
    const mid = (g.s0 + g.s1) / 2;
    const hw = (g.s1 - g.s0) / 2;
    const u = (s - mid) / hw;
    return Math.abs(u) >= 1 ? 0 : rw.grotto.openingHeight * Math.sqrt(1 - u * u);
  };
  const w = rw.waterfall.enabled ? { s0: Math.min(rw.waterfall.span.t0, rw.waterfall.span.t1) * L, s1: Math.max(rw.waterfall.span.t0, rw.waterfall.span.t1) * L } : null;
  const inFalls = (s: number) => !!w && s >= w.s0 && s <= w.s1;
  const lipH = rw.height * 0.85;

  const rows = clamp(Math.round(rw.thickness / (size * 0.9)), 1, 3);
  const rocks: RockInstance[] = [];
  const push = (p: Vec2, ground: number, base: number, rx: number, ry: number, rz: number, rot: number, course: number, slab: boolean, row = -1) => {
    const variant = Math.floor(rand() * ROCK_VARIANTS);
    rocks.push({
      x: p.x,
      y: ground + base + ry * 0.9,
      z: p.y,
      sx: rx,
      sy: ry,
      sz: rz,
      rotY: rot,
      tilt: (rand() - 0.5) * (slab ? 0.08 : 0.5),
      variant,
      shade: 0.84 + rand() * 0.26,
      course,
      row,
      slab,
      plan: planOutline(p.x, p.y, rx, rz, rot, variant),
    });
  };

  for (let r = 0; r < rows; r++) {
    // Row 0 is the front (water side); back rows stand taller.
    const offset = rows === 1 ? 0 : waterSide * (half - size / 2 - ((rw.thickness - size) * r) / (rows - 1));
    const rowFactor = rows === 1 ? 1 : 0.72 + (0.28 * r) / (rows - 1);
    const isBack = r === rows - 1 && rows > 1;
    let z = 0;
    for (let course = 0; course < 12; course++) {
      const courseSize = size * Math.max(0.42, 1 - 0.16 * course);
      let s = rand() * courseSize * 0.6;
      let placed = 0;
      while (s <= L + 0.01) {
        // Natural stacking: a wide spread of sizes, the odd big anchor stone low down, irregular gaps.
        const anchor = course === 0 && rand() < 0.22;
        const cs = courseSize * (anchor ? 1.45 : 0.7 + rand() * 0.6);
        const step = cs * (0.62 + rand() * 0.38);
        let top = profile(s) * rowFactor;
        const oh = opening(s);
        if (oh > 0) top = Math.max(top, oh + size * 0.7);
        const inSpill = inFalls(s);
        if (inSpill) top = Math.min(top, lipH - 0.05);
        const zj = Math.max(0, z + (rand() - 0.5) * courseSize * 0.3);
        const fits = zj + cs * 0.3 <= top;
        const inCave = !isBack && oh > 0 && zj < oh;
        if (fits && !inCave) {
          const f = frame(sp, s);
          const p = off(f.p, f.n, offset + (rand() - 0.5) * cs * 0.4);
          const rx = cs * (0.5 + rand() * 0.2);
          const ry = cs * (0.3 + rand() * 0.16);
          const rz = cs * (0.42 + rand() * 0.18);
          push(p, env.groundAt(f.p), zj, rx, Math.min(ry, (top - zj) * 0.6 + cs * 0.15), rz, Math.atan2(f.t.y, f.t.x) + (rand() - 0.5) * 1.1, course, false, r);
          placed++;
        }
        s += step;
      }
      if (!placed && z > 0) break;
      z += courseSize * 0.55;
      if (z > rw.height * 1.05 + size) break;
    }
  }

  // Grotto roof: flat slabs spanning the opening.
  let grotto: RockLayout['grotto'] = null;
  if (g && g.s1 - g.s0 >= 0.2) {
    const cave: Vec2[] = [];
    for (let s = g.s0; s <= g.s1 + 1e-6; s += 0.5) {
      const f = frame(sp, s);
      const oh = opening(s);
      push(off(f.p, f.n, 0), env.groundAt(f.p), Math.max(oh, 0.3), 0.42 + rand() * 0.12, 0.13, half * 0.95, Math.atan2(f.t.y, f.t.x), 99, true);
    }
    const n = 12;
    for (let k = 0; k <= n; k++) cave.push(off(frame(sp, g.s0 + ((g.s1 - g.s0) * k) / n).p, frame(sp, g.s0 + ((g.s1 - g.s0) * k) / n).n, waterSide * half));
    for (let k = n; k >= 0; k--) cave.push(off(frame(sp, g.s0 + ((g.s1 - g.s0) * k) / n).p, frame(sp, g.s0 + ((g.s1 - g.s0) * k) / n).n, -waterSide * (half - size * 0.8)));
    grotto = { from: frame(sp, g.s0).p, to: frame(sp, g.s1).p, openingHeight: rw.grotto.openingHeight, outline: cave };
  }

  // Waterfall: a spill lip of slabs and the falling water sheet.
  let falls: FallSheet | null = null;
  if (w && w.s1 - w.s0 >= 0.1) {
    const ground0 = env.groundAt(frame(sp, (w.s0 + w.s1) / 2).p);
    const lipY = ground0 + lipH;
    for (let s = w.s0; s <= w.s1 + 1e-6; s += 0.55) {
      const f = frame(sp, s);
      push(off(f.p, f.n, waterSide * half * 0.35), ground0, lipH - 0.14, 0.4 + rand() * 0.1, 0.12, half * 0.75, Math.atan2(f.t.y, f.t.x), 98, true);
    }
    const columns: FallSheet['columns'] = [];
    const inset = Math.min(0.15, (w.s1 - w.s0) * 0.1);
    const nCols = Math.max(2, Math.round((w.s1 - w.s0 - 2 * inset) / 0.15) + 1);
    const v = rw.waterfall.type === 'sheet' ? 1.1 : 0.55;
    for (let c = 0; c < nCols; c++) {
      const s = w.s0 + inset + ((w.s1 - w.s0 - 2 * inset) * c) / (nCols - 1);
      const f = frame(sp, s);
      const out = { x: f.n.x * waterSide, y: f.n.y * waterSide };
      const lip = off(f.p, out, half * 0.35 + 0.42);
      const col: Array<{ x: number; y: number; z: number }> = [];
      const steps = 14;
      // Free fall from the lip; a cascade bounces off a ledge halfway down.
      const tTotal = Math.sqrt((2 * Math.max(0.05, lipY - landingAt(lip, env))) / 9.81);
      for (let k = 0; k <= steps; k++) {
        const t = (tTotal * k) / steps;
        let d = v * t;
        let y = lipY - 0.5 * 9.81 * t * t;
        if (rw.waterfall.type === 'cascade' && y < lipY * 0.55) d += 0.18;
        const p = off(lip, out, d);
        const landing = landingAt(p, env);
        if (y <= landing) {
          y = landing;
          col.push({ x: p.x, y, z: p.y });
          break;
        }
        col.push({ x: p.x, y, z: p.y });
      }
      columns.push(col);
    }
    falls = { columns, lipY, type: rw.waterfall.type };
  }

  let topY = 0;
  for (const r of rocks) topY = Math.max(topY, r.y + r.sy);
  const spine: Vec2[] = [];
  for (let k = 0; k <= 20; k++) spine.push(frame(sp, (L * k) / 20).p);
  return { rocks, spine, length: sp.length, waterSide, falls, grotto, topY };
}

function landingAt(p: Vec2, env: RockEnv): number {
  return env.isWater(p) ? 0 : env.groundAt(p);
}
