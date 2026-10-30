import { describe, expect, it } from 'vitest';
import { type Vec2, dist } from '../model/geometry';
import { RockworkSchema } from '../model/schema';
import { type RockEnv, buildRockwork } from './buildRockwork';

// Flat deck at 0.12 m; the pool is everything with y > 0.8 (just in front of the wall).
const env: RockEnv = {
  groundAt: (p) => (p.y > 0.8 ? -1.2 : 0.12),
  isWater: (p) => p.y > 0.8,
};

const wall = (over: Record<string, unknown> = {}) =>
  RockworkSchema.parse({
    id: 'r',
    path: [
      { x: 0, y: 0 },
      { x: 4, y: 0.3 },
      { x: 8, y: 0 },
    ],
    height: 1.4,
    thickness: 1.4,
    boulderSize: 0.7,
    seed: 3,
    ...over,
  });

function distToSpine(p: Vec2, spine: Vec2[]) {
  let best = Infinity;
  for (const q of spine) best = Math.min(best, dist(p, q));
  return best;
}

describe('rockwork builder', () => {
  it('is deterministic for a seed and reshuffles with a new one', () => {
    const a = buildRockwork(wall(), env);
    const b = buildRockwork(wall(), env);
    const c = buildRockwork(wall({ seed: 4 }), env);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(a.rocks)).not.toBe(JSON.stringify(c.rocks));
  });

  it('stacks rocks inside the footprint and up to the requested height', () => {
    const lay = buildRockwork(wall(), env);
    expect(lay.rocks.length).toBeGreaterThan(20);
    for (const r of lay.rocks) expect(distToSpine({ x: r.x, y: r.z }, lay.spine)).toBeLessThan(0.7 + 0.35 + 0.1);
    expect(lay.topY).toBeGreaterThan(0.12 + 1.4 * 0.75);
    expect(lay.topY).toBeLessThan(0.12 + 1.4 + 0.7);
    // Several courses.
    expect(new Set(lay.rocks.map((r) => r.course)).size).toBeGreaterThanOrEqual(2);
  });

  it('a longer wall uses more rocks', () => {
    const short = buildRockwork(wall({ path: [{ x: 0, y: 0 }, { x: 3, y: 0 }] }), env);
    const long = buildRockwork(wall({ path: [{ x: 0, y: 0 }, { x: 9, y: 0 }] }), env);
    expect(long.rocks.length).toBeGreaterThan(short.rocks.length * 2);
  });

  it('finds the pool side', () => {
    // Path runs +x; its normal (-ty, tx) points +y, which is where the pool is.
    expect(buildRockwork(wall(), env).waterSide).toBe(1);
    expect(buildRockwork(wall({ path: [{ x: 8, y: 0 }, { x: 0, y: 0 }] }), env).waterSide).toBe(-1);
  });

  it('a grotto leaves a clear opening under a slab roof', () => {
    const lay = buildRockwork(wall({ grotto: { enabled: true, span: { t0: 0.3, t1: 0.7 }, openingHeight: 1.0 } }), env);
    expect(lay.grotto).not.toBeNull();
    const rows = Math.max(...lay.rocks.map((r) => r.row)) + 1;
    expect(rows).toBeGreaterThan(1);
    // Spine length ≈ 8 m; check the middle half of the opening span (t 0.3–0.7).
    for (const r of lay.rocks) {
      if (r.slab || r.row === rows - 1) continue;
      if (r.x < 8 * 0.4 || r.x > 8 * 0.6) continue;
      // Front rocks in the middle of the opening sit above it (their base clears the opening).
      const base = r.y - r.sy * 0.9 - 0.12;
      expect(base).toBeGreaterThanOrEqual(0.7);
    }
    expect(lay.rocks.some((r) => r.slab)).toBe(true);
  });

  it('a waterfall pours from the lip down into the pool', () => {
    const lay = buildRockwork(wall({ waterfall: { enabled: true, span: { t0: 0.35, t1: 0.65 }, type: 'sheet' } }), env);
    expect(lay.falls).not.toBeNull();
    const cols = lay.falls!.columns;
    expect(cols.length).toBeGreaterThan(5);
    for (const col of cols) {
      expect(col[0].y).toBeCloseTo(lay.falls!.lipY, 5);
      for (let i = 1; i < col.length; i++) expect(col[i].y).toBeLessThanOrEqual(col[i - 1].y);
      // Lands on the water surface, on the pool side.
      expect(col[col.length - 1].y).toBeCloseTo(0, 5);
      expect(col[col.length - 1].z).toBeGreaterThan(0.8);
    }
  });
});
