import { Region, cellCenter } from '../model/floorField';
import { argMax, clusterCells, mergeNearby } from './cluster';
import { type Rule, type Violation, severityFor } from './types';

/** Walkable beach ramp must not exceed the max beach slope. */
export const maxBeachSlope: Rule = ({ doc, field, specs }) => {
  const limit = specs.beachMaxSlope.value;
  const beaches = doc.zones.filter((z) => z.kind === 'beachEntry');
  const mask = new Uint8Array(field.elev.length);
  const edgeGuard = field.cell * 1.5;
  const { nx, ny } = field;
  // Only the walkable ramp interior: skip cells touching walls, wings or the waterline lip.
  const isBeach = (k: number) => field.region[k] === Region.Beach;
  for (let k = 0; k < mask.length; k++) {
    if (field.region[k] !== Region.Beach || field.sdf[k] < edgeGuard) continue;
    const i = k % nx;
    const j = (k - i) / nx;
    if (i === 0 || j === 0 || i === nx - 1 || j === ny - 1) continue;
    if (!isBeach(k - 1) || !isBeach(k + 1) || !isBeach(k - nx) || !isBeach(k + nx)) continue;
    if (field.slope[k] > limit * 1.0001) mask[k] = 1;
  }
  const out: Violation[] = [];
  mergeNearby(field, clusterCells(field, mask, 6), (k) => field.slope[k], 2.5).forEach((cells, n) => {
    const worst = argMax(cells, (k) => field.slope[k]);
    const measured = field.slope[worst];
    const zone = beaches[field.beachZone[worst]];
    out.push({
      id: `maxBeachSlope:${zone?.id ?? 'beach'}:${n}`,
      ruleId: 'maxBeachSlope',
      severity: severityFor(measured, limit, 'max'),
      title: 'Beach too steep',
      hint: 'Lengthen the beach run, reduce its end depth, or move deep areas further from the beach.',
      at: cellCenter(field, worst),
      quantity: 'slope',
      measured,
      limit,
      comparison: 'max',
      specKey: 'beachMaxSlope',
      cells,
      zoneId: zone?.id,
    });
  });
  return out;
};
