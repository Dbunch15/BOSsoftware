import { describe, expect, it } from 'vitest';
import { NO_KEYS, adjustSpeed, flyStep, forwardVector, look, lookAtAngles, MAX_SPEED, PITCH_LIMIT } from './flyMath';
import { DEFAULT_HOTBAR, HOTBAR_SIZE, assignSlot, sanitizeHotbar, slotForCode } from './hotbar';
import { wheelIndexAt, wheelSlotPosition } from './toolWheel';

describe('hotbar', () => {
  it('maps number keys to slots', () => {
    expect(slotForCode('Digit1')).toBe(0);
    expect(slotForCode('Numpad9')).toBe(8);
    expect(slotForCode('Digit0')).toBe(-1);
    expect(slotForCode('KeyA')).toBe(-1);
  });
  it('assigning a tool moves it rather than duplicating it', () => {
    const next = assignSlot(DEFAULT_HOTBAR, 0, 'pen');
    expect(next[0]).toBe('pen');
    expect(next[1]).toBe('select');
    expect(next.filter((t) => t === 'pen')).toHaveLength(1);
  });
  it('repairs bad stored data', () => {
    expect(sanitizeHotbar(null)).toEqual(DEFAULT_HOTBAR);
    expect(sanitizeHotbar(['nope', ...DEFAULT_HOTBAR.slice(1)])[0]).toBe(DEFAULT_HOTBAR[0]);
    expect(sanitizeHotbar(DEFAULT_HOTBAR)).toHaveLength(HOTBAR_SIZE);
  });
});

describe('tool wheel', () => {
  it('picks the slot the pointer points at, clockwise from the top', () => {
    expect(wheelIndexAt(0, -100, 8)).toBe(0);
    expect(wheelIndexAt(100, 0, 8)).toBe(2);
    expect(wheelIndexAt(0, 100, 8)).toBe(4);
    expect(wheelIndexAt(-100, 0, 8)).toBe(6);
    expect(wheelIndexAt(5, 5, 8)).toBe(-1);
  });
  it('slot positions round-trip through the picker', () => {
    for (let i = 0; i < 13; i++) {
      const p = wheelSlotPosition(i, 13, 120);
      expect(wheelIndexAt(p.x, p.y, 13)).toBe(i);
    }
  });
});

describe('fly camera', () => {
  it('moves forward along the horizontal view direction', () => {
    const [x, y, z] = flyStep(0, { ...NO_KEYS, forward: true }, 2, 0.5);
    expect(x).toBeCloseTo(0);
    expect(y).toBe(0);
    expect(z).toBeCloseTo(-1);
  });
  it('strafes right, rises and descends, and normalises diagonals', () => {
    const [x] = flyStep(0, { ...NO_KEYS, right: true }, 1, 1);
    expect(x).toBeCloseTo(1);
    expect(flyStep(0, { ...NO_KEYS, up: true }, 1, 1)[1]).toBeCloseTo(1);
    expect(flyStep(0, { ...NO_KEYS, down: true }, 1, 1)[1]).toBeCloseTo(-1);
    const d = flyStep(1, { ...NO_KEYS, forward: true, right: true }, 1, 1);
    expect(Math.hypot(...d)).toBeCloseTo(1);
    expect(Math.hypot(...flyStep(0, { ...NO_KEYS, forward: true, fast: true }, 1, 1))).toBeCloseTo(2.5);
  });
  it('mouse look clamps pitch', () => {
    expect(look(0, 0, 0, -1e6).pitch).toBeCloseTo(PITCH_LIMIT);
    expect(look(0, 0, 100, 0).yaw).toBeLessThan(0);
  });
  it('speed scales with the wheel and stays in range', () => {
    expect(adjustSpeed(4, -100)).toBeGreaterThan(4);
    expect(adjustSpeed(4, 100)).toBeLessThan(4);
    expect(adjustSpeed(30, -1e5)).toBe(MAX_SPEED);
  });
  it('lookAtAngles agrees with forwardVector', () => {
    const { yaw, pitch } = lookAtAngles([1, 2, 3], [4, 0, -2]);
    const f = forwardVector(yaw, pitch);
    const d = [3, -2, -5];
    const l = Math.hypot(...d);
    f.forEach((v, i) => expect(v).toBeCloseTo(d[i] / l));
  });
});
