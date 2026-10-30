import { describe, expect, it } from 'vitest';
import { formatArea, formatLength, formatSlope, formatVolume, parseLength } from './format';

describe('units', () => {
  it('formats ft-in and metric', () => {
    expect(formatLength(1.6764, 'imperial')).toBe(`5' 6"`);
    expect(formatLength(0.3048, 'imperial')).toBe(`1' 0"`);
    expect(formatLength(0.1524, 'imperial')).toBe(`6"`);
    expect(formatLength(3.6576 - 0.001, 'imperial')).toBe(`12' 0"`);
    expect(formatLength(1.6764, 'metric')).toBe('1.68 m');
  });
  it('formats area, volume, slope', () => {
    expect(formatArea(10, 'imperial')).toBe('108 ft²');
    expect(formatArea(10, 'metric')).toBe('10.0 m²');
    expect(formatVolume(1, 'imperial')).toBe('260 gal');
    expect(formatVolume(1, 'metric')).toBe('1.0 m³');
    expect(formatSlope(0.125)).toBe('12.5% (1:8)');
  });
  it('parses lengths in many forms', () => {
    const ft = 0.3048;
    expect(parseLength(`5'6"`, 'imperial')).toBeCloseTo(5.5 * ft);
    expect(parseLength(`5' 6"`, 'metric')).toBeCloseTo(5.5 * ft);
    expect(parseLength('5ft 6in', 'imperial')).toBeCloseTo(5.5 * ft);
    expect(parseLength(`66"`, 'imperial')).toBeCloseTo(5.5 * ft);
    expect(parseLength('5.5', 'imperial')).toBeCloseTo(5.5 * ft);
    expect(parseLength('1.2', 'metric')).toBeCloseTo(1.2);
    expect(parseLength('120cm', 'imperial')).toBeCloseTo(1.2);
    expect(parseLength('1200 mm', 'imperial')).toBeCloseTo(1.2);
    expect(parseLength('abc', 'imperial')).toBeNull();
  });
});
