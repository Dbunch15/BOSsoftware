import { describe, expect, it } from 'vitest';
import { TEMPLATES, createFromTemplate } from '../templates';
import { NATURI_SPECS } from '../specs/naturiSpecs';
import { buildModel } from './buildModel';
import { BEACH_ROOM, LAWN_DROP, Region, computeFloorField, sampleDepth } from './floorField';
import { centroid } from './geometry';
import type { BeachEntry, DeepZone, ProjectDoc } from './schema';
import { frameAt, polylineSamples, spanFraction } from './spline';
import { rect } from '../test/helpers';

const zone = <K extends ProjectDoc['zones'][number]['kind']>(d: ProjectDoc, kind: K) =>
  d.zones.find((z) => z.kind === kind) as Extract<ProjectDoc['zones'][number], { kind: K }>;

/** Point `dist` meters inward from the middle of a span. */
function intoSpan(m: ReturnType<typeof buildModel>, b: { span: { u0: number; u1: number } }, dist: number) {
  const f = frameAt(m.outline, b.span.u0 + spanFraction(b.span.u0, b.span.u1) / 2);
  return { x: f.p.x + f.inward.x * dist, y: f.p.y + f.inward.y * dist };
}

describe('floor field — templates', () => {
  it.each(TEMPLATES.map((t) => t.id))('%s builds a sane field with no violations', (id) => {
    const m = buildModel(createFromTemplate(id));
    expect(m.field.cell).toBeCloseTo(0.1, 5);
    expect(m.stats.maxDepth).toBeGreaterThan(1.2);
    expect(m.stats.maxDepth).toBeLessThanOrEqual(NATURI_SPECS.maxDepth.value);
    expect(m.violations.map((v) => v.id)).toEqual([]);
    // Waterline is at 0; the paver deck sits at deck height, the lawn just below it.
    const corner = 0;
    expect(m.field.region[corner]).toBe(Region.Lawn);
    expect(m.field.elev[corner]).toBeCloseTo(m.doc.shell.deckHeight - LAWN_DROP, 5);
    const lip = m.doc.shell.lipWidth;
    const deckCell = m.field.sdf.findIndex((d, k) => m.field.region[k] === Region.Deck && d < -(lip + 0.3) && d > -(lip + 0.9));
    expect(m.field.elev[deckCell]).toBeCloseTo(m.doc.shell.deckHeight, 5);
  });

  it('lagoon: deep end reaches its depth, base floor at base depth, beach ramps linearly', () => {
    const doc = createFromTemplate('lagoon');
    const m = buildModel(doc);
    const deep = zone(doc, 'deepZone') as DeepZone;
    expect(sampleDepth(m.field, centroid(deep.polygon))).toBeCloseTo(deep.depth, 1);

    const beach = zone(doc, 'beachEntry') as BeachEntry;
    const run = m.field.beachRun[0];
    expect(run).toBeCloseTo(beach.runLength, 5);
    // Near the waterline the ramp follows endDepth/run exactly; further in, a convex beach edge makes
    // the distance field (and so the ramp) slightly shallower than the straight-line value.
    expect(sampleDepth(m.field, intoSpan(m, beach, run * 0.2))).toBeCloseTo(beach.endDepth * 0.2, 1);
    let prev = 0;
    for (const t of [0.25, 0.5, 0.75, 1]) {
      const d = sampleDepth(m.field, intoSpan(m, beach, run * t));
      expect(d).toBeGreaterThan(prev);
      expect(d).toBeLessThanOrEqual(beach.endDepth * t + 0.02);
      prev = d;
    }
  });

  it('kidney: bench seat sits at seat depth; spa placeholder carried through', () => {
    const doc = createFromTemplate('kidney-spa');
    const m = buildModel(doc);
    const bench = zone(doc, 'bench');
    expect(sampleDepth(m.field, intoSpan(m, bench, bench.width * 0.6))).toBeCloseTo(bench.seatDepth, 1);
    expect(doc.spa?.placeholder).toBe(true);
  });

  it('plunge: sun shelf depth is flat at shelf depth', () => {
    const doc = createFromTemplate('plunge-shelf');
    const m = buildModel(doc);
    const shelf = zone(doc, 'sunShelf');
    expect(sampleDepth(m.field, { x: 2.35, y: 0 })).toBeCloseTo(shelf.depth, 1);
    expect(sampleDepth(m.field, { x: -1, y: 0 })).toBeCloseTo(doc.shell.baseDepth, 1);
  });

  it('sculpt deltas add depth', () => {
    const doc = createFromTemplate('blank');
    const before = sampleDepth(buildModel(doc).field, { x: 0, y: 0 });
    const sculpted = { ...doc, sculpt: { ...doc.sculpt, cells: { '0,0': 0.3 } } };
    expect(sampleDepth(buildModel(sculpted).field, { x: 0, y: 0 }) - before).toBeCloseTo(0.3, 3);
  });
});

describe('beach slope math', () => {
  const shell = { baseDepth: 1.5, wallRun: 0.9, lipWidth: 0.45, deckHeight: 0.12 };
  const sculpt = { cellSize: 0.1, cells: {} };
  // 16 × 6 m rectangle; beach on the west short side (x = 0). Sampled clockwise from (0,0) in y-down
  // plan coords, so u along the west edge is the last quarter-ish of the loop.
  function beachRect(length: number, runLength: number, endDepth: number) {
    const outline = polylineSamples(rect(length, 6), 0.1);
    const perim = outline.length;
    // West edge runs from (0,6) back to (0,0): arc-length [2L+6, 2L+12] of the perimeter.
    const u0 = (2 * length + 6 + 0.5) / perim;
    const u1 = (2 * length + 12 - 0.5) / perim;
    const beach: BeachEntry = {
      kind: 'beachEntry',
      id: 'b',
      name: 'Beach',
      span: { u0, u1 },
      runLength,
      endDepth,
      toeSlope: 0.3,
      taper: 1,
    };
    return computeFloorField({ outline, shell, zones: [beach], sculpt });
  }

  it('slope along the ramp equals endDepth / runLength', () => {
    const f = beachRect(16, 6, 0.8);
    const d1 = sampleDepth(f, { x: 1.5, y: 3 });
    const d2 = sampleDepth(f, { x: 4.5, y: 3 });
    expect((d2 - d1) / 3).toBeCloseTo(0.8 / 6, 3);
    expect(sampleDepth(f, { x: 6, y: 3 })).toBeCloseTo(0.8, 2);
  });

  it('field slope magnitude on the ramp matches the design slope', () => {
    const f = beachRect(16, 6, 0.8);
    const k = Math.round((3 - f.y0) / f.cell) * f.nx + Math.round((3 - f.x0) / f.cell);
    expect(f.region[k]).toBe(Region.Beach);
    expect(f.slope[k]).toBeCloseTo(0.8 / 6, 3);
  });

  it('run compresses when the pool is too short for the beach', () => {
    const f = beachRect(8, 6, 0.8);
    expect(f.beachRun[0]).toBeLessThan(6);
    // Available length ≈ pool length minus a third of the far wall run.
    expect(f.beachRun[0]).toBeGreaterThan((8 - 0.5) * BEACH_ROOM);
    expect(f.beachRun[0]).toBeLessThan(8 * BEACH_ROOM);
    const slope = (sampleDepth(f, { x: 3, y: 3 }) - sampleDepth(f, { x: 1, y: 3 })) / 2;
    expect(slope).toBeCloseTo(0.8 / f.beachRun[0], 2);
  });
});
