/** Radial tool wheel geometry: slot 0 at the top, going clockwise. */

/** Which slot the pointer offset (dx, dy from the wheel centre, screen px, y down) points at; -1 inside the dead zone. */
export function wheelIndexAt(dx: number, dy: number, count: number, deadZone = 28): number {
  if (count <= 0 || Math.hypot(dx, dy) < deadZone) return -1;
  // Angle measured clockwise from straight up.
  const a = (Math.atan2(dx, -dy) + Math.PI * 2) % (Math.PI * 2);
  const step = (Math.PI * 2) / count;
  return Math.round(a / step) % count;
}

/** Screen offset of slot i's centre at the given radius. */
export function wheelSlotPosition(i: number, count: number, radius: number): { x: number; y: number } {
  const a = (i / count) * Math.PI * 2;
  return { x: Math.sin(a) * radius, y: -Math.cos(a) * radius };
}
