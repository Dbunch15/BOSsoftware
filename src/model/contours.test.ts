import { describe, expect, it } from 'vitest';
import { TEMPLATES, createFromTemplate } from '../templates';
import { buildModel } from './buildModel';
import { contourLevels, marchingSquares } from './contours';
import { dist, polygonArea } from './geometry';

describe('contours', () => {
  const g = { x0: -5, y0: -5, cell: 0.1, nx: 101, ny: 101 };
  const bowl = new Float32Array(g.nx * g.ny);
  for (let j = 0; j < g.ny; j++)
    for (let i = 0; i < g.nx; i++) {
      const x = g.x0 + i * g.cell;
      const y = g.y0 + j * g.cell;
      bowl[j * g.nx + i] = 3 - Math.hypot(x, y); // cone: value 3 at center, 0 at r=3
    }

  it('closed loops on a bowl, with the right radius', () => {
    const cs = marchingSquares(g, bowl, 1); // r = 2 circle
    expect(cs).toHaveLength(1);
    expect(cs[0].closed).toBe(true);
    for (const p of cs[0].points) expect(Math.hypot(p.x, p.y)).toBeCloseTo(2, 2);
    expect(polygonArea(cs[0].points)).toBeCloseTo(Math.PI * 4, 1);
    // closure: consecutive points (including last → first) are within one cell
    const pts = cs[0].points;
    for (let i = 0; i < pts.length; i++) expect(dist(pts[i], pts[(i + 1) % pts.length])).toBeLessThan(0.15);
  });

  it('open polyline where the level leaves the grid', () => {
    const ramp = new Float32Array(g.nx * g.ny);
    for (let k = 0; k < ramp.length; k++) ramp[k] = (k % g.nx) * 0.1;
    const cs = marchingSquares(g, ramp, 5.05);
    expect(cs).toHaveLength(1);
    expect(cs[0].closed).toBe(false);
  });

  it('every template contour is a closed loop inside the pool', () => {
    for (const t of TEMPLATES) {
      const m = buildModel(createFromTemplate(t.id));
      expect(m.contours.length).toBeGreaterThan(0);
      for (const c of m.contours) expect(c.closed).toBe(true);
    }
  });

  it('levels step by 1 ft (imperial) or 0.25 m (metric)', () => {
    expect(contourLevels(1.0, 'imperial').map((l) => +l.toFixed(4))).toEqual([0.3048, 0.6096, 0.9144]);
    expect(contourLevels(1.0, 'metric')).toEqual([0.25, 0.5, 0.75]);
  });
});
