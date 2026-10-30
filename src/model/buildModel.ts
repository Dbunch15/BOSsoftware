/**
 * buildModel(doc) → Model. Pure and memoized: both the 3D viewport and the 2D plan render from
 * the Model, never from raw doc geometry, which keeps them in lock-step.
 */
import { DEFAULT_SPECS, type SpecTable } from '../specs/naturiSpecs';
import { runRules, type Violation } from '../rules';
import { type Contour, contourLevels, depthContours } from './contours';
import { type FloorField, computeFloorField } from './floorField';
import type { Vec2 } from './geometry';
import type { ProjectDoc } from './schema';
import { type OutlineSamples, extractSpan, sampleOutline } from './spline';
import { type PoolStats, computeStats } from './stats';

export interface Model {
  doc: ProjectDoc;
  outline: OutlineSamples;
  field: FloorField;
  contours: Contour[];
  stats: PoolStats;
  violations: Violation[];
  /** Per field cell: 0 none, 1 warning, 2 critical. */
  cellFlags: Uint8Array;
  /** Per outline sample: 0 none, 1 warning, 2 critical. */
  outlineFlags: Uint8Array;
  /** Sampled zone shapes for display (closed polygons or open spans). */
  zoneShapes: Record<string, Vec2[]>;
  buildMs: number;
}

const outlineCache = new WeakMap<object, OutlineSamples>();
function outlineSamples(doc: ProjectDoc): OutlineSamples {
  let s = outlineCache.get(doc.outline);
  if (!s) {
    s = sampleOutline(doc.outline.points, doc.outline.alpha, 0.1);
    outlineCache.set(doc.outline, s);
  }
  return s;
}

let last: { doc: ProjectDoc; specs: SpecTable; model: Model } | null = null;

export function buildModel(doc: ProjectDoc, specs: SpecTable = DEFAULT_SPECS): Model {
  if (last && last.doc === doc && last.specs === specs) return last.model;
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const outline = outlineSamples(doc);
  const field = computeFloorField({
    outline,
    shell: doc.shell,
    zones: doc.zones,
    sculpt: doc.sculpt,
    alpha: doc.outline.alpha,
    outlineKey: doc.outline,
  });
  const stats = computeStats(field, outline);
  const contours = depthContours(field, field.elev, contourLevels(stats.maxDepth, doc.units));
  const violations = runRules({ doc, field, outline, specs });

  const cellFlags = new Uint8Array(field.elev.length);
  const outlineFlags = new Uint8Array(outline.pts.length);
  for (const v of violations) {
    const level = v.severity === 'critical' ? 2 : 1;
    if (v.cells) for (const k of v.cells) if (cellFlags[k] < level) cellFlags[k] = level;
    if (v.outlineRange) {
      const n = outline.pts.length;
      const [a, b] = v.outlineRange;
      for (let i = a; ; i = (i + 1) % n) {
        if (outlineFlags[i] < level) outlineFlags[i] = level;
        if (i === b) break;
      }
    }
  }

  const zoneShapes: Record<string, Vec2[]> = {};
  for (const z of doc.zones) {
    zoneShapes[z.id] =
      z.kind === 'beachEntry' || z.kind === 'bench'
        ? extractSpan(outline, z.span.u0, z.span.u1)
        : sampleOutline(z.polygon, doc.outline.alpha, 0.1).pts;
  }

  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const model: Model = {
    doc,
    outline,
    field,
    contours,
    stats,
    violations,
    cellFlags,
    outlineFlags,
    zoneShapes,
    buildMs: t1 - t0,
  };
  last = { doc, specs, model };
  return model;
}
