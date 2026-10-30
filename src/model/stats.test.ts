import { describe, expect, it } from 'vitest';
import { circle, rect } from '../test/helpers';
import { computeFloorField } from './floorField';
import { polygonArea } from './geometry';
import { polylineSamples, sampleOutline } from './spline';
import { computeStats } from './stats';

// Near-vertical walls so volume ≈ area × depth.
const shell = { baseDepth: 1.5, wallRun: 0.001, lipWidth: 0.45, deckHeight: 0.12 };
const sculpt = { cellSize: 0.1, cells: {} };

describe('area / volume / perimeter against analytic shapes', () => {
  it('circle (Catmull-Rom through 24 points)', () => {
    const r = 5;
    const outline = sampleOutline(circle(r, 24), 0.5, 0.1);
    const s = computeStats(computeFloorField({ outline, shell, zones: [], sculpt }), outline);
    expect(s.area / (Math.PI * r * r)).toBeCloseTo(1, 2);
    expect(s.perimeter / (2 * Math.PI * r)).toBeCloseTo(1, 2);
    expect(s.volume / (Math.PI * r * r * 1.5)).toBeCloseTo(1, 1);
    expect(Math.abs(s.volume / (Math.PI * r * r * 1.5) - 1)).toBeLessThan(0.02);
    expect(s.maxDepth).toBeCloseTo(1.5, 5);
  });

  it('rectangle 10 × 5', () => {
    const outline = polylineSamples(rect(10, 5, 0.05, 0.05), 0.1);
    expect(polygonArea(outline.pts)).toBeCloseTo(50, 6);
    const s = computeStats(computeFloorField({ outline, shell, zones: [], sculpt }), outline);
    expect(s.area).toBeCloseTo(50, 6);
    expect(s.perimeter).toBeCloseTo(30, 6);
    expect(Math.abs(s.volume / 75 - 1)).toBeLessThan(0.01);
  });

  it('sloped walls reduce volume by the wall wedge', () => {
    const outline = polylineSamples(rect(10, 5, 0.05, 0.05), 0.1);
    const sloped = computeStats(
      computeFloorField({ outline, shell: { ...shell, wallRun: 0.9 }, zones: [], sculpt }),
      outline,
    );
    // wallEase(x) = 1-(1-x)² averages 2/3 over the band: missing ≈ perimeter·run·depth/3.
    const expected = 75 - (30 * 0.9 * 1.5) / 3;
    expect(Math.abs(sloped.volume / expected - 1)).toBeLessThan(0.03);
  });
});
