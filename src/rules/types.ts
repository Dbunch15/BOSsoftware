import type { Vec2 } from '../model/geometry';
import type { FloorField } from '../model/floorField';
import type { ProjectDoc } from '../model/schema';
import type { OutlineSamples } from '../model/spline';
import type { SpecKey, SpecTable } from '../specs/naturiSpecs';

export type Severity = 'warning' | 'critical';
export type RuleId = 'maxBeachSlope' | 'maxFloorSlope' | 'depthRange' | 'minCurveRadius' | 'benchWidth';
export type Quantity = 'slope' | 'length' | 'depth';

export interface Violation {
  /** Stable-ish id: rule + subject. */
  id: string;
  ruleId: RuleId;
  severity: Severity;
  title: string;
  /** Plain-language guidance, independent of units. */
  hint: string;
  /** Where to point at in plan coordinates. */
  at: Vec2;
  quantity: Quantity;
  measured: number;
  limit: number;
  comparison: 'max' | 'min';
  specKey: SpecKey;
  /** Offending floor-field cells. */
  cells?: Int32Array;
  /** Offending outline samples [start, end] inclusive, may wrap past the end. */
  outlineRange?: [number, number];
  zoneId?: string;
}

export interface RuleContext {
  doc: ProjectDoc;
  field: FloorField;
  outline: OutlineSamples;
  specs: SpecTable;
}

export type Rule = (ctx: RuleContext) => Violation[];

export const RULE_LABELS: Record<RuleId, string> = {
  maxBeachSlope: 'Max beach slope',
  maxFloorSlope: 'Max floor slope',
  depthRange: 'Min/max depth',
  minCurveRadius: 'Min curve radius',
  benchWidth: 'Bench width',
};

export function severityFor(measured: number, limit: number, comparison: 'max' | 'min', tolerance = 0.3): Severity {
  const ratio = comparison === 'max' ? measured / limit : limit / Math.max(measured, 1e-9);
  return ratio > 1 + tolerance ? 'critical' : 'warning';
}
