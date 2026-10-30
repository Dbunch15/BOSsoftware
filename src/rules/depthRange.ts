import { cellCenter } from '../model/floorField';
import { centroid } from '../model/geometry';
import { frameAt } from '../model/spline';
import { argMax, clusterCells } from './cluster';
import { type Rule, type Violation, severityFor } from './types';

/** Max water depth, floor above waterline, general floor min depth, sun shelf and bench seat depth ranges. */
export const depthRange: Rule = ({ doc, field, outline, specs }) => {
  const out: Violation[] = [];
  const N = field.elev.length;

  const maxD = specs.maxDepth.value;
  const deep = new Uint8Array(N);
  const above = new Uint8Array(N);
  for (let k = 0; k < N; k++) {
    if (field.sdf[k] <= 0) continue;
    const d = -field.elev[k];
    if (d > maxD + 1e-4) deep[k] = 1;
    if (field.sdf[k] > 0.3 && d < -1e-4) above[k] = 1;
  }
  clusterCells(field, deep, 1).forEach((cells, n) => {
    const worst = argMax(cells, (k) => -field.elev[k]);
    const measured = -field.elev[worst];
    out.push({
      id: `depthRange:max:${n}`,
      ruleId: 'depthRange',
      severity: severityFor(measured, maxD, 'max', 0.1),
      title: 'Deeper than max depth',
      hint: 'Reduce the deep-zone depth or raise the sculpted area.',
      at: cellCenter(field, worst),
      quantity: 'depth',
      measured,
      limit: maxD,
      comparison: 'max',
      specKey: 'maxDepth',
      cells,
    });
  });
  clusterCells(field, above, 1).forEach((cells, n) => {
    const worst = argMax(cells, (k) => field.elev[k]);
    out.push({
      id: `depthRange:above:${n}`,
      ruleId: 'depthRange',
      severity: 'critical',
      title: 'Floor above waterline',
      hint: 'The floor breaks the water surface here. Deepen it, or model it as an island/feature.',
      at: cellCenter(field, worst),
      quantity: 'depth',
      measured: -field.elev[worst],
      limit: 0,
      comparison: 'min',
      specKey: 'maxDepth',
      cells,
    });
  });

  const minFloor = specs.minFloorDepth.value;
  if (doc.shell.baseDepth < minFloor - 1e-6) {
    out.push({
      id: 'depthRange:baseDepth',
      ruleId: 'depthRange',
      severity: severityFor(doc.shell.baseDepth, minFloor, 'min'),
      title: 'General floor too shallow',
      hint: 'Increase the base floor depth in the Pool inspector.',
      at: centroid(outline.pts),
      quantity: 'depth',
      measured: doc.shell.baseDepth,
      limit: minFloor,
      comparison: 'min',
      specKey: 'minFloorDepth',
    });
  }

  for (const z of doc.zones) {
    if (z.kind === 'sunShelf') {
      const lo = specs.sunShelfMinDepth.value;
      const hi = specs.sunShelfMaxDepth.value;
      if (z.depth < lo - 1e-6 || z.depth > hi + 1e-6) {
        const tooShallow = z.depth < lo;
        out.push({
          id: `depthRange:${z.id}`,
          ruleId: 'depthRange',
          severity: severityFor(z.depth, tooShallow ? lo : hi, tooShallow ? 'min' : 'max'),
          title: tooShallow ? 'Sun shelf too shallow' : 'Sun shelf too deep',
          hint: 'Adjust the shelf depth in the inspector.',
          at: centroid(z.polygon),
          quantity: 'depth',
          measured: z.depth,
          limit: tooShallow ? lo : hi,
          comparison: tooShallow ? 'min' : 'max',
          specKey: tooShallow ? 'sunShelfMinDepth' : 'sunShelfMaxDepth',
          zoneId: z.id,
        });
      }
    } else if (z.kind === 'bench') {
      const lo = specs.benchSeatMinDepth.value;
      const hi = specs.benchSeatMaxDepth.value;
      if (z.seatDepth < lo - 1e-6 || z.seatDepth > hi + 1e-6) {
        const tooShallow = z.seatDepth < lo;
        const mid = frameAt(outline, z.span.u0 + spanMid(z.span.u0, z.span.u1));
        out.push({
          id: `depthRange:${z.id}`,
          ruleId: 'depthRange',
          severity: severityFor(z.seatDepth, tooShallow ? lo : hi, tooShallow ? 'min' : 'max'),
          title: tooShallow ? 'Bench seat too shallow' : 'Bench seat too deep',
          hint: 'Adjust the bench seat depth in the inspector.',
          at: { x: mid.p.x + mid.inward.x * z.width * 0.5, y: mid.p.y + mid.inward.y * z.width * 0.5 },
          quantity: 'depth',
          measured: z.seatDepth,
          limit: tooShallow ? lo : hi,
          comparison: tooShallow ? 'min' : 'max',
          specKey: tooShallow ? 'benchSeatMinDepth' : 'benchSeatMaxDepth',
          zoneId: z.id,
        });
      }
    }
  }
  return out;
};

function spanMid(u0: number, u1: number): number {
  const d = u1 - u0;
  return (d >= 0 ? d : d + 1) / 2;
}
