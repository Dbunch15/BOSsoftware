/** Floor sculpt brushes. They edit the sparse `sculpt.cells` delta layer (meters, + is deeper). */
import type { Model } from '../model/buildModel';
import { sampleDepth } from '../model/floorField';
import type { Vec2 } from '../model/geometry';
import { clamp } from '../model/geometry';
import type { SculptTool } from '../state/uiStore';

export interface BrushDab {
  mode: SculptTool;
  center: Vec2;
  radius: number;
  strength: number;
  /** 0..1, 1 for mouse. */
  pressure: number;
  flattenDepth: number;
}

/** Max depth change per dab at full strength/pressure (m). */
export const DAB_DEPTH = 0.035;

const key = (i: number, j: number) => `${i},${j}`;

/**
 * Apply one dab to `cells` (mutated in place; pass an immer draft). Reads current depths from the
 * model so smooth/flatten act on the shape the designer sees.
 */
export function applyDab(cells: Record<string, number>, cellSize: number, model: Model, dab: BrushDab) {
  const { center, radius } = dab;
  const f = model.field;
  const amount = clamp(dab.strength, 0, 1) * clamp(dab.pressure, 0.05, 1);
  const i0 = Math.floor((center.x - radius) / cellSize);
  const i1 = Math.ceil((center.x + radius) / cellSize);
  const j0 = Math.floor((center.y - radius) / cellSize);
  const j1 = Math.ceil((center.y + radius) / cellSize);

  let avg = 0;
  if (dab.mode === 'smooth') {
    // Mean depth over the brush footprint (coarse sampling is enough).
    let n = 0;
    for (let a = 0; a < 12; a++) {
      for (const r of [0.33, 0.66, 1]) {
        const p = { x: center.x + Math.cos(a) * radius * r, y: center.y + Math.sin(a) * radius * r };
        if (sdfAt(model, p) > 0.05) {
          avg += sampleDepth(f, p);
          n++;
        }
      }
    }
    if (!n) return;
    avg /= n;
  }

  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const p = { x: i * cellSize, y: j * cellSize };
      const r = Math.hypot(p.x - center.x, p.y - center.y) / radius;
      if (r >= 1) continue;
      if (sdfAt(model, p) <= 0.05) continue; // only sculpt inside the waterline
      const fall = (1 - r * r) ** 2;
      const k = key(i, j);
      const cur = sampleDepth(f, p);
      let delta = 0;
      switch (dab.mode) {
        case 'deepen':
          delta = DAB_DEPTH * amount * fall;
          break;
        case 'raise':
          delta = -DAB_DEPTH * amount * fall;
          break;
        case 'smooth':
          delta = (avg - cur) * 0.5 * amount * fall;
          break;
        case 'flatten':
          delta = (dab.flattenDepth - cur) * 0.35 * amount * fall;
          break;
      }
      const next = Math.round(((cells[k] ?? 0) + delta) * 10000) / 10000;
      if (Math.abs(next) < 1e-4) delete cells[k];
      else cells[k] = next;
    }
  }
}

function sdfAt(model: Model, p: Vec2): number {
  const f = model.field;
  const i = Math.round((p.x - f.x0) / f.cell);
  const j = Math.round((p.y - f.y0) / f.cell);
  if (i < 0 || j < 0 || i >= f.nx || j >= f.ny) return -1;
  return f.sdf[j * f.nx + i];
}
