import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createFromTemplate } from '../templates';
import { IndexedDbRepository } from './IndexedDbRepository';
import { MemoryRepository } from './MemoryRepository';
import type { ProjectRepository } from './ProjectRepository';
import { exportProjectJson, importProjectJson } from './io';

let dbCounter = 0;
const impls: Array<[string, () => ProjectRepository]> = [
  ['IndexedDbRepository', () => new IndexedDbRepository(`test-db-${++dbCounter}`, 'projects')],
  ['MemoryRepository', () => new MemoryRepository()],
];

describe.each(impls)('%s', (_name, make) => {
  it('save → get → list → rename → delete', async () => {
    const repo = make();
    expect(await repo.list()).toEqual([]);
    const doc = createFromTemplate('lagoon', 'Smith backyard', '2026-01-01T00:00:00.000Z');
    await repo.save(doc);
    const got = await repo.get(doc.id);
    expect(got).toEqual(doc);
    expect((await repo.list()).map((s) => s.name)).toEqual(['Smith backyard']);

    await repo.rename(doc.id, 'Smith — revised');
    expect((await repo.get(doc.id))!.meta.name).toBe('Smith — revised');

    await repo.delete(doc.id);
    expect(await repo.get(doc.id)).toBeUndefined();
    expect(await repo.list()).toEqual([]);
  });

  it('save overwrites and list sorts by most recently updated', async () => {
    const repo = make();
    const a = createFromTemplate('lagoon', 'A', '2026-01-01T00:00:00.000Z');
    const b = createFromTemplate('kidney-spa', 'B', '2026-02-01T00:00:00.000Z');
    await repo.save(a);
    await repo.save(b);
    expect((await repo.list()).map((s) => s.name)).toEqual(['B', 'A']);
    await repo.save({ ...a, meta: { ...a.meta, updatedAt: '2026-03-01T00:00:00.000Z' } });
    expect((await repo.list()).map((s) => s.name)).toEqual(['A', 'B']);
    expect(await repo.list()).toHaveLength(2);
  });

  it('duplicate makes an independent copy with a new id', async () => {
    const repo = make();
    const doc = createFromTemplate('plunge-shelf', 'Original');
    await repo.save(doc);
    const copy = await repo.duplicate(doc.id);
    expect(copy.id).not.toBe(doc.id);
    expect(copy.meta.name).toBe('Original (copy)');
    expect(copy.outline).toEqual(doc.outline);
    await repo.rename(copy.id, 'Copy renamed');
    expect((await repo.get(doc.id))!.meta.name).toBe('Original');
    expect(await repo.list()).toHaveLength(2);
    const named = await repo.duplicate(doc.id, 'Option B');
    expect(named.meta.name).toBe('Option B');
  });

  it('rejects invalid docs and errors on missing ids', async () => {
    const repo = make();
    const bad = { ...createFromTemplate('blank'), outline: { points: [], alpha: 0.5 } };
    await expect(repo.save(bad)).rejects.toThrow();
    await expect(repo.duplicate('nope')).rejects.toThrow(/not found/);
    await expect(repo.rename('nope', 'x')).rejects.toThrow(/not found/);
  });
});

describe('JSON import/export', () => {
  it('round-trips with a fresh id', () => {
    const doc = createFromTemplate('koi-pool', 'Koi');
    const back = importProjectJson(exportProjectJson(doc));
    expect(back.id).not.toBe(doc.id);
    expect({ ...back, id: doc.id, meta: { ...back.meta, updatedAt: doc.meta.updatedAt } }).toEqual(doc);
  });
  it('rejects files from a newer version', () => {
    const doc = { ...createFromTemplate('blank'), version: 99 };
    expect(() => importProjectJson(JSON.stringify(doc))).toThrow(/newer/);
  });
});
