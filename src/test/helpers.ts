import type { Vec2 } from '../model/geometry';
import type { ProjectDoc } from '../model/schema';
import { createFromTemplate } from '../templates';

export function circle(r: number, n: number, cx = 0, cy = 0): Vec2[] {
  return Array.from({ length: n }, (_, k) => ({
    x: cx + r * Math.cos((2 * Math.PI * k) / n),
    y: cy + r * Math.sin((2 * Math.PI * k) / n),
  }));
}

export function rect(w: number, h: number, x0 = 0, y0 = 0): Vec2[] {
  return [
    { x: x0, y: y0 },
    { x: x0 + w, y: y0 },
    { x: x0 + w, y: y0 + h },
    { x: x0, y: y0 + h },
  ];
}

/** A template doc with a structural tweak applied (docs are plain objects in tests). */
export function tweak(id: string, fn: (d: ProjectDoc) => void): ProjectDoc {
  const d = structuredClone(createFromTemplate(id));
  fn(d);
  return d;
}
