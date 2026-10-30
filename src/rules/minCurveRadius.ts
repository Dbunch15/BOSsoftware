import { curvatureRadii } from '../model/spline';
import { type Rule, type Violation, severityFor } from './types';

/** Outline curves tighter than the minimum radius are hard to trowel and waterproof. */
export const minCurveRadius: Rule = ({ outline, specs }) => {
  const limit = specs.minCurveRadius.value;
  const radii = curvatureRadii(outline, Math.max(0.25, limit / 2));
  const n = radii.length;
  const bad = (i: number) => radii[(i + n) % n] < limit;
  const out: Violation[] = [];
  if (n === 0) return out;
  // Start scanning at a sample that is not in violation so runs don't straddle the seam.
  let start = 0;
  while (start < n && bad(start)) start++;
  if (start === n) start = 0;
  let i = 0;
  while (i < n) {
    const idx = (start + i) % n;
    if (!bad(idx)) {
      i++;
      continue;
    }
    const runStart = idx;
    let worst = idx;
    let len = 0;
    while (i < n && bad((start + i) % n)) {
      const k = (start + i) % n;
      if (radii[k] < radii[worst]) worst = k;
      len++;
      i++;
    }
    if (len < 2) continue;
    const measured = radii[worst];
    out.push({
      id: `minCurveRadius:${out.length}`,
      ruleId: 'minCurveRadius',
      severity: severityFor(measured, limit, 'min', 0.6),
      title: 'Curve too tight',
      hint: 'Spread the nearby control points apart or delete one to open up the curve.',
      at: outline.pts[worst],
      quantity: 'length',
      measured,
      limit,
      comparison: 'min',
      specKey: 'minCurveRadius',
      outlineRange: [runStart, (runStart + len - 1) % n],
    });
  }
  return out;
};
