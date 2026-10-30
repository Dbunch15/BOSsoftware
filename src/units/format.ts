/** Display formatting & parsing. Values are always meters internally. */
import type { Units } from '../model/schema';

export const M_PER_FT = 0.3048;
export const M_PER_IN = 0.0254;
export const GAL_PER_M3 = 264.172052;
export const FT2_PER_M2 = 10.7639104;

export interface LengthFormat {
  /** Imperial inch rounding step (default 1"). */
  inchStep?: number;
  /** Metric decimals (default 2). */
  decimals?: number;
}

export function formatLength(m: number, units: Units, opts: LengthFormat = {}): string {
  if (!Number.isFinite(m)) return '—';
  if (units === 'metric') {
    const dec = opts.decimals ?? 2;
    return `${m.toFixed(dec)} m`;
  }
  const step = opts.inchStep ?? 1;
  const sign = m < 0 ? '-' : '';
  let inches = Math.round(Math.abs(m) / M_PER_IN / step) * step;
  let feet = Math.floor(inches / 12 + 1e-9);
  inches = inches - feet * 12;
  if (inches >= 12 - 1e-9) {
    feet += 1;
    inches = 0;
  }
  const inStr = Number.isInteger(inches) ? `${inches}` : inches.toFixed(1);
  if (feet === 0) return `${sign}${inStr}"`;
  return `${sign}${feet}' ${inStr}"`;
}

export function formatArea(m2: number, units: Units): string {
  if (units === 'metric') return `${m2.toFixed(1)} m²`;
  return `${Math.round(m2 * FT2_PER_M2).toLocaleString('en-US')} ft²`;
}

export function formatVolume(m3: number, units: Units): string {
  if (units === 'metric') return `${m3.toFixed(1)} m³`;
  const gal = m3 * GAL_PER_M3;
  return `${(Math.round(gal / 10) * 10).toLocaleString('en-US')} gal`;
}

/** Slope as percent plus a 1:N ratio, e.g. "12.5% (1:8)". */
export function formatSlope(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio <= 0) return '0%';
  const n = 1 / ratio;
  const nStr = n >= 10 ? n.toFixed(0) : n.toFixed(1).replace(/\.0$/, '');
  return `${(ratio * 100).toFixed(1)}% (1:${nStr})`;
}

export function formatQuantity(q: 'slope' | 'length' | 'depth', v: number, units: Units): string {
  return q === 'slope' ? formatSlope(v) : formatLength(v, units);
}

/**
 * Parse a user-typed length. Accepts 5'6", 5' 6", 5ft 6in, 5.5', 66", 66in, 1.2m, 120cm, 1200mm.
 * A bare number is read in the current units (feet for imperial, meters for metric).
 */
export function parseLength(input: string, units: Units): number | null {
  const s = input.trim().toLowerCase().replace(/[′’]/g, "'").replace(/[″”]/g, '"').replace(/,/g, '.');
  if (!s) return null;
  const num = '(-?\\d+(?:\\.\\d+)?|-?\\.\\d+)';
  let m: RegExpMatchArray | null;
  if ((m = s.match(new RegExp(`^${num}\\s*(mm|cm|m)$`)))) {
    const v = parseFloat(m[1]);
    return m[2] === 'mm' ? v / 1000 : m[2] === 'cm' ? v / 100 : v;
  }
  m = s.match(new RegExp(`^(?:${num}\\s*(?:'|ft|feet|foot))?\\s*(?:${num}\\s*(?:"|in|inch|inches))?$`));
  if (m && (m[1] !== undefined || m[2] !== undefined)) {
    const ft = m[1] !== undefined ? parseFloat(m[1]) : 0;
    const inch = m[2] !== undefined ? parseFloat(m[2]) : 0;
    const sign = ft < 0 || (m[1] === undefined && inch < 0) ? -1 : 1;
    return sign * (Math.abs(ft) * M_PER_FT + Math.abs(inch) * M_PER_IN);
  }
  if ((m = s.match(new RegExp(`^${num}$`)))) {
    const v = parseFloat(m[1]);
    return units === 'imperial' ? v * M_PER_FT : v;
  }
  return null;
}

/** Plan grid spacing: [minor, major] in meters. */
export function gridSpacing(units: Units): [number, number] {
  return units === 'imperial' ? [M_PER_FT, 5 * M_PER_FT] : [0.5, 1];
}
