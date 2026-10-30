import type { FloorField } from './floorField';
import { polygonArea } from './geometry';
import type { OutlineSamples } from './spline';

export interface PoolStats {
  /** Water surface area (m²). */
  area: number;
  /** Water volume (m³). */
  volume: number;
  /** Waterline perimeter (m). */
  perimeter: number;
  maxDepth: number;
  /** Mean depth over the water surface. */
  meanDepth: number;
}

export function computeStats(field: FloorField, outline: OutlineSamples): PoolStats {
  const cellArea = field.cell * field.cell;
  let volume = 0;
  let maxDepth = 0;
  for (let k = 0; k < field.elev.length; k++) {
    if (field.sdf[k] <= 0) continue;
    const d = -field.elev[k];
    if (d > 0) volume += d * cellArea;
    if (d > maxDepth) maxDepth = d;
  }
  const area = polygonArea(outline.pts);
  return { area, volume, perimeter: outline.length, maxDepth, meanDepth: area > 0 ? volume / area : 0 };
}
