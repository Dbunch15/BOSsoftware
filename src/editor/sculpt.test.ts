import { describe, expect, it } from 'vitest';
import { brushFalloff, predictDelta, DAB_DEPTH } from './sculpt';

describe('brush shapes', () => {
  it('round eases from centre to rim', () => {
    expect(brushFalloff(0, 'round')).toBe(1);
    expect(brushFalloff(0.5, 'round')).toBeCloseTo(0.5625);
    expect(brushFalloff(1, 'round')).toBe(0);
  });
  it('flat keeps full strength over the inner 60%', () => {
    expect(brushFalloff(0.55, 'flat')).toBe(1);
    expect(brushFalloff(0.8, 'flat')).toBeCloseTo(0.5);
    expect(brushFalloff(0.999, 'flat')).toBeLessThan(0.01);
  });
  it('noise varies with position but stays bounded', () => {
    const vals = Array.from({ length: 50 }, (_, i) => brushFalloff(0.3, 'noise', i * 0.37, i * 0.11));
    expect(Math.max(...vals) - Math.min(...vals)).toBeGreaterThan(0.2);
    for (const v of vals) expect(v).toBeGreaterThanOrEqual(0);
  });
  it('predicts the per-dab change for each mode', () => {
    const base = { center: { x: 0, y: 0 }, radius: 1, strength: 1, pressure: 1, flattenDepth: 1, shape: 'round' as const };
    expect(predictDelta({ ...base, mode: 'deepen' }, { x: 0, y: 0 }, 1.2, 1.2)).toBeCloseTo(DAB_DEPTH);
    expect(predictDelta({ ...base, mode: 'raise' }, { x: 0, y: 0 }, 1.2, 1.2)).toBeCloseTo(-DAB_DEPTH);
    expect(predictDelta({ ...base, mode: 'flatten' }, { x: 0, y: 0 }, 1.4, 1.4)).toBeCloseTo(-0.4 * 0.35);
    expect(predictDelta({ ...base, mode: 'smooth' }, { x: 0, y: 0 }, 1.4, 1.0)).toBeCloseTo(-0.2);
    expect(predictDelta({ ...base, mode: 'deepen' }, { x: 2, y: 0 }, 1, 1)).toBe(0);
  });
});
