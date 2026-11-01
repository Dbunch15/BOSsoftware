import type { Vec2 } from '../model/geometry';
import { type Rockwork, type Zone, RockworkSchema, newId } from '../model/schema';
import type { RockPreset } from '../state/uiStore';

export function newBeach(u0: number, u1: number): Zone {
  return { kind: 'beachEntry', id: newId(), name: 'Beach entry', span: { u0, u1 }, runLength: 4.5, endDepth: 0.6, toeSlope: 0.3, taper: 1.2 };
}
export function newBench(u0: number, u1: number): Zone {
  return { kind: 'bench', id: newId(), name: 'Bench', span: { u0, u1 }, width: 0.45, seatDepth: 0.5 };
}
export function newShelf(polygon: Vec2[]): Zone {
  return { kind: 'sunShelf', id: newId(), name: 'Sun shelf', polygon, depth: 0.3, blend: 0.4 };
}
export function newDeep(polygon: Vec2[]): Zone {
  return { kind: 'deepZone', id: newId(), name: 'Deep zone', polygon, depth: 1.85, blend: 2.6 };
}

export const ZONE_LABEL: Record<Zone['kind'], string> = {
  beachEntry: 'Beach entry',
  bench: 'Bench',
  sunShelf: 'Sun shelf',
  deepZone: 'Deep zone',
};

export const ROCK_PRESET_LABEL: Record<RockPreset, string> = {
  wall: 'Rock wall',
  waterfall: 'Rock waterfall',
  grotto: 'Grotto',
};

export function newRockwork(path: Vec2[], preset: RockPreset): Rockwork {
  const base = { id: newId(), name: ROCK_PRESET_LABEL[preset], path, seed: Math.floor(Math.random() * 1e6) };
  switch (preset) {
    case 'wall':
      return RockworkSchema.parse({ ...base, height: 1.0, thickness: 1.2, boulderSize: 0.7 });
    case 'waterfall':
      return RockworkSchema.parse({ ...base, height: 1.4, thickness: 1.5, boulderSize: 0.75, waterfall: { enabled: true, span: { t0: 0.32, t1: 0.68 }, type: 'sheet' } });
    case 'grotto':
      return RockworkSchema.parse({
        ...base,
        height: 2.1,
        thickness: 2.2,
        boulderSize: 0.85,
        grotto: { enabled: true, span: { t0: 0.25, t1: 0.75 }, openingHeight: 1.25 },
      });
  }
}
