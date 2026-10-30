import type { Vec2 } from '../model/geometry';
import { type Zone, newId } from '../model/schema';

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
