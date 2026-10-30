import { describe, expect, it } from 'vitest';
import { polygonArea } from '../model/geometry';
import { sampleOutline } from '../model/spline';
import { fitClosedStroke } from './fitStroke';

describe('freehand stroke fitting', () => {
  it('fits a wobbly hand-drawn circle with few points and preserves its area', () => {
    const raw = Array.from({ length: 400 }, (_, k) => {
      const t = (2 * Math.PI * k) / 400;
      const r = 4 + 0.04 * Math.sin(37 * t); // hand jitter
      return { x: r * Math.cos(t), y: r * Math.sin(t) };
    });
    const ctrl = fitClosedStroke(raw)!;
    expect(ctrl.length).toBeGreaterThanOrEqual(6);
    expect(ctrl.length).toBeLessThan(30);
    const area = polygonArea(sampleOutline(ctrl).pts);
    expect(area / (Math.PI * 16)).toBeGreaterThan(0.95);
    expect(area / (Math.PI * 16)).toBeLessThan(1.03);
  });

  it('rejects tiny strokes', () => {
    expect(fitClosedStroke([{ x: 0, y: 0 }, { x: 0.1, y: 0 }, { x: 0.1, y: 0.1 }, { x: 0, y: 0.1 }])).toBeNull();
  });
});
