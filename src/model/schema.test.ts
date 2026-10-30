import { describe, expect, it } from 'vitest';
import { createFromTemplate } from '../templates';
import { DOC_VERSION, migrateDoc } from './schema';

describe('doc schema migrations', () => {
  it('upgrades a v1 doc (no rockwork) to the current version', () => {
    const current = createFromTemplate('kidney-spa');
    const { rockwork: _drop, ...rest } = current;
    const v1 = { ...rest, version: 1 };
    const doc = migrateDoc(JSON.parse(JSON.stringify(v1)));
    expect(doc.version).toBe(DOC_VERSION);
    expect(doc.rockwork).toEqual([]);
    expect(doc.outline).toEqual(current.outline);
  });

  it('fills rockwork defaults', () => {
    const doc = createFromTemplate('blank');
    const raw = JSON.parse(JSON.stringify({ ...doc, rockwork: [{ id: 'r', path: [{ x: 0, y: 0 }, { x: 2, y: 0 }] }] }));
    const r = migrateDoc(raw).rockwork[0];
    expect(r.height).toBeGreaterThan(0);
    expect(r.waterfall.enabled).toBe(false);
    expect(r.grotto.enabled).toBe(false);
    expect(r.rockType).toBe('sandstone');
  });
});
