import { type UseStore, createStore, del, entries, get, set } from 'idb-keyval';
import { type ProjectDoc, migrateDoc } from '../model/schema';
import { makeDuplicate, nowIso, toStored } from './common';
import { type ProjectRepository, type ProjectSummary, byUpdatedDesc, summarize } from './ProjectRepository';

export class IndexedDbRepository implements ProjectRepository {
  private store: UseStore;

  constructor(dbName = 'naturi-pool-studio', storeName = 'projects') {
    this.store = createStore(dbName, storeName);
  }

  async list(): Promise<ProjectSummary[]> {
    const all = await entries<string, unknown>(this.store);
    const out: ProjectSummary[] = [];
    for (const [, raw] of all) {
      try {
        out.push(summarize(migrateDoc(raw)));
      } catch {
        // Skip unreadable records rather than breaking the project list.
      }
    }
    return out.sort(byUpdatedDesc);
  }

  async get(id: string): Promise<ProjectDoc | undefined> {
    const raw = await get<unknown>(id, this.store);
    return raw === undefined ? undefined : migrateDoc(raw);
  }

  async save(doc: ProjectDoc): Promise<void> {
    await set(doc.id, toStored(doc), this.store);
  }

  async duplicate(id: string, name?: string): Promise<ProjectDoc> {
    const doc = await this.get(id);
    if (!doc) throw new Error(`Project ${id} not found`);
    const copy = makeDuplicate(doc, name);
    await this.save(copy);
    return copy;
  }

  async delete(id: string): Promise<void> {
    await del(id, this.store);
  }

  async rename(id: string, name: string): Promise<void> {
    const doc = await this.get(id);
    if (!doc) throw new Error(`Project ${id} not found`);
    await this.save({ ...doc, meta: { ...doc.meta, name, updatedAt: nowIso() } });
  }
}
