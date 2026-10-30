import { describe, expect, it } from 'vitest';
import { buildModel } from '../model/buildModel';
import { createFromTemplate } from '../templates';
import { tweak } from '../test/helpers';
import type { RuleId } from './types';

const ids = (doc: Parameters<typeof buildModel>[0], rule: RuleId) =>
  buildModel(doc).violations.filter((v) => v.ruleId === rule);

describe('rule: max beach slope', () => {
  it('passes on the lagoon template', () => {
    expect(ids(createFromTemplate('lagoon'), 'maxBeachSlope')).toHaveLength(0);
  });
  it('fails when end depth is too deep for the run', () => {
    const v = ids(tweak('lagoon', (d) => void ((d.zones[0] as { endDepth: number }).endDepth = 1.2)), 'maxBeachSlope');
    expect(v.length).toBeGreaterThan(0);
    expect(v[0].measured).toBeCloseTo(1.2 / 5.5, 1);
    expect(v[0].severity).toBe('critical');
    expect(v[0].cells!.length).toBeGreaterThan(50);
  });
  it('fails when the far end is dragged in and the beach has to compress', () => {
    const v = ids(tweak('lagoon', (d) => void (d.outline.points[0] = { x: 0.5, y: 0.2 })), 'maxBeachSlope');
    expect(v.length).toBeGreaterThan(0);
  });
});

describe('rule: max floor slope', () => {
  it('passes on the blank template', () => {
    expect(ids(createFromTemplate('blank'), 'maxFloorSlope')).toHaveLength(0);
  });
  it('fails for an abrupt deep-zone transition', () => {
    const v = ids(
      tweak('blank', (d) =>
        d.zones.push({
          kind: 'deepZone',
          id: 'dz',
          name: 'Pit',
          polygon: [
            { x: -1, y: -0.8 },
            { x: 1, y: -0.8 },
            { x: 1, y: 0.8 },
            { x: -1, y: 0.8 },
          ],
          depth: 2.2,
          blend: 0.4,
        }),
      ),
      'maxFloorSlope',
    );
    expect(v.length).toBeGreaterThan(0);
    expect(v[0].measured).toBeGreaterThan(1);
  });
});

describe('rule: min/max depth', () => {
  it('passes on the kidney template', () => {
    expect(ids(createFromTemplate('kidney-spa'), 'depthRange')).toHaveLength(0);
  });
  it('fails for a too-deep zone', () => {
    const v = ids(tweak('kidney-spa', (d) => void ((d.zones[1] as { depth: number }).depth = 3)), 'depthRange');
    expect(v.some((x) => x.title === 'Deeper than max depth')).toBe(true);
  });
  it('fails for a sun shelf outside its depth range', () => {
    const v = ids(tweak('plunge-shelf', (d) => void ((d.zones[0] as { depth: number }).depth = 0.8)), 'depthRange');
    expect(v.map((x) => x.title)).toContain('Sun shelf too deep');
  });
  it('fails when sculpting raises the floor above the waterline', () => {
    const v = ids(
      tweak('blank', (d) => {
        for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) d.sculpt.cells[`${i},${j}`] = -1.6;
      }),
      'depthRange',
    );
    expect(v.map((x) => x.title)).toContain('Floor above waterline');
    expect(v.find((x) => x.title === 'Floor above waterline')!.severity).toBe('critical');
  });
  it('fails when the general floor is too shallow', () => {
    const v = ids(tweak('blank', (d) => void (d.shell.baseDepth = 0.6)), 'depthRange');
    expect(v.map((x) => x.title)).toContain('General floor too shallow');
  });
});

describe('rule: min curve radius', () => {
  it('passes on the lagoon template', () => {
    expect(ids(createFromTemplate('lagoon'), 'minCurveRadius')).toHaveLength(0);
  });
  it('fails for a sharp notch in the outline', () => {
    const v = ids(
      tweak('blank', (d) => {
        // Pull one point far inward to make a tight cusp.
        d.outline.points.splice(1, 0, { x: 3.2, y: 0.3 }, { x: 1.2, y: 0.9 }, { x: 3.0, y: 1.4 });
      }),
      'minCurveRadius',
    );
    expect(v.length).toBeGreaterThan(0);
    expect(v[0].measured).toBeLessThan(0.6);
    expect(v[0].outlineRange).toBeDefined();
  });
});

describe('rule: bench width', () => {
  it('passes on the kidney template', () => {
    expect(ids(createFromTemplate('kidney-spa'), 'benchWidth')).toHaveLength(0);
  });
  it('fails for a too-narrow bench', () => {
    const v = ids(tweak('kidney-spa', (d) => void ((d.zones[0] as { width: number }).width = 0.2)), 'benchWidth');
    expect(v).toHaveLength(1);
    expect(v[0].title).toBe('Bench too narrow');
  });
  it('fails for a too-wide bench', () => {
    const v = ids(tweak('kidney-spa', (d) => void ((d.zones[0] as { width: number }).width = 0.9)), 'benchWidth');
    expect(v).toHaveLength(1);
    expect(v[0].title).toBe('Bench too wide');
  });
});
