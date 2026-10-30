import { Region, cellCenter } from '../model/floorField';
import { argMax, clusterCells } from './cluster';
import { type Rule, type Violation, severityFor } from './types';

/** General floor (excluding walls, beach ramps, benches and shelf steps) must not exceed the max floor slope. */
export const maxFloorSlope: Rule = ({ doc, field, specs }) => {
  const limit = specs.floorMaxSlope.value;
  const guard = doc.shell.wallRun + field.cell * 2;
  const mask = new Uint8Array(field.elev.length);
  for (let k = 0; k < mask.length; k++) {
    const r = field.region[k];
    if (r !== Region.Floor && r !== Region.BeachToe) continue;
    if (field.sdf[k] < guard) continue;
    if (field.slope[k] > limit * 1.0001) mask[k] = 1;
  }
  const out: Violation[] = [];
  clusterCells(field, mask).forEach((cells, n) => {
    const worst = argMax(cells, (k) => field.slope[k]);
    const measured = field.slope[worst];
    out.push({
      id: `maxFloorSlope:${n}`,
      ruleId: 'maxFloorSlope',
      severity: severityFor(measured, limit, 'max'),
      title: 'Floor too steep',
      hint: 'Soften the transition: widen the deep-zone blend, or smooth the sculpted area.',
      at: cellCenter(field, worst),
      quantity: 'slope',
      measured,
      limit,
      comparison: 'max',
      specKey: 'floorMaxSlope',
      cells,
    });
  });
  return out;
};
