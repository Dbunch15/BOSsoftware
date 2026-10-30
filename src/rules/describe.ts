import type { Units } from '../model/schema';
import { formatQuantity } from '../units/format';
import type { Violation } from './types';

export function describeViolation(v: Violation, units: Units): string {
  const measured = formatQuantity(v.quantity, v.measured, units);
  const limit = formatQuantity(v.quantity, v.limit, units);
  return `${measured} — ${v.comparison} ${limit}`;
}
