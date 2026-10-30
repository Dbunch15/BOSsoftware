import { benchWidth } from './benchWidth';
import { depthRange } from './depthRange';
import { maxBeachSlope } from './maxBeachSlope';
import { maxFloorSlope } from './maxFloorSlope';
import { minCurveRadius } from './minCurveRadius';
import type { Rule, RuleContext, RuleId, Violation } from './types';

export const RULES: Record<RuleId, Rule> = {
  maxBeachSlope,
  maxFloorSlope,
  depthRange,
  minCurveRadius,
  benchWidth,
};

const SEVERITY_ORDER = { critical: 0, warning: 1 } as const;

export function runRules(ctx: RuleContext): Violation[] {
  return Object.values(RULES)
    .flatMap((rule) => rule(ctx))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

export * from './types';
