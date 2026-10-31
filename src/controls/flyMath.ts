/** First-person fly camera maths (creative-mode style flight): pure, so it is unit-tested. */

export interface FlyKeys {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  fast: boolean;
}

export const NO_KEYS: FlyKeys = { forward: false, back: false, left: false, right: false, up: false, down: false, fast: false };

export const MIN_SPEED = 0.5;
export const MAX_SPEED = 40;
export const PITCH_LIMIT = Math.PI / 2 - 0.02;

/** Mouse look: yaw turns left/right, pitch looks up/down (clamped short of straight up/down). */
export function look(yaw: number, pitch: number, dx: number, dy: number, sensitivity = 0.0032): { yaw: number; pitch: number } {
  const p = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch - dy * sensitivity));
  return { yaw: yaw - dx * sensitivity, pitch: p };
}

/** Forward unit vector for yaw/pitch (three.js axes: -Z forward at yaw 0, +Y up). */
export function forwardVector(yaw: number, pitch: number): [number, number, number] {
  const c = Math.cos(pitch);
  return [-Math.sin(yaw) * c, Math.sin(pitch), -Math.cos(yaw) * c];
}

/**
 * Displacement for one frame. Forward/back follow the view on the horizontal plane (like walking
 * in creative flight), strafing is sideways, and Space/Shift move straight up/down.
 */
export function flyStep(yaw: number, keys: FlyKeys, speed: number, dt: number): [number, number, number] {
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);
  let x = 0;
  let y = 0;
  let z = 0;
  const fb = (keys.forward ? 1 : 0) - (keys.back ? 1 : 0);
  const lr = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  x += fx * fb + rx * lr;
  z += fz * fb + rz * lr;
  if (keys.up) y += 1;
  if (keys.down) y -= 1;
  const len = Math.hypot(x, y, z);
  if (!len) return [0, 0, 0];
  const d = (speed * (keys.fast ? 2.5 : 1) * dt) / len;
  return [x * d, y * d, z * d];
}

/** Scroll while flying changes speed geometrically. */
export function adjustSpeed(speed: number, wheelDeltaY: number): number {
  const next = speed * Math.exp(-wheelDeltaY * 0.0025);
  return Math.max(MIN_SPEED, Math.min(MAX_SPEED, next));
}

/** Yaw/pitch that look from `from` toward `to`. */
export function lookAtAngles(from: [number, number, number], to: [number, number, number]): { yaw: number; pitch: number } {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
}
