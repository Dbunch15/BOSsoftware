import { frameAt, spanFraction } from '../model/spline';
import { type Rule, type Violation, severityFor } from './types';

/** Bench seats must fall within the seat width range. */
export const benchWidth: Rule = ({ doc, outline, specs }) => {
  const lo = specs.benchMinWidth.value;
  const hi = specs.benchMaxWidth.value;
  const out: Violation[] = [];
  for (const z of doc.zones) {
    if (z.kind !== 'bench') continue;
    if (z.width >= lo - 1e-6 && z.width <= hi + 1e-6) continue;
    const narrow = z.width < lo;
    const mid = frameAt(outline, z.span.u0 + spanFraction(z.span.u0, z.span.u1) / 2);
    out.push({
      id: `benchWidth:${z.id}`,
      ruleId: 'benchWidth',
      severity: severityFor(z.width, narrow ? lo : hi, narrow ? 'min' : 'max'),
      title: narrow ? 'Bench too narrow' : 'Bench too wide',
      hint: narrow ? 'Widen the seat so it is usable.' : 'Narrow the seat, or use a sun shelf instead.',
      at: { x: mid.p.x + mid.inward.x * z.width * 0.5, y: mid.p.y + mid.inward.y * z.width * 0.5 },
      quantity: 'length',
      measured: z.width,
      limit: narrow ? lo : hi,
      comparison: narrow ? 'min' : 'max',
      specKey: narrow ? 'benchMinWidth' : 'benchMaxWidth',
      zoneId: z.id,
    });
  }
  return out;
};
