import { type ProjectDoc, migrateDoc } from '../model/schema';
import { makeDuplicate, nowIso, toStored } from './common';
import { type ProjectRepository, type ProjectSummary, byUpdatedDesc, summarize } from './ProjectRepository';

/** In-memory repository for tests and as a reference implementation. */
export class MemoryRepository implements ProjectRepository {
  private docs = new Map<string, unknown>();

  async list(): Promise<ProjectSummary[]> {
    return [...this.docs.values()].map((d) => summarize(migrateDoc(d))).sort(byUpdatedDesc);
  }
  async get(id: string): Promise<ProjectDoc | undefined> {
    const d = this.docs.get(id);
    return d === undefined ? undefined : migrateDoc(structuredClone(d));
  }
  async save(doc: ProjectDoc): Promise<void> {
    this.docs.set(doc.id, structuredClone(toStored(doc)));
  }
  async duplicate(id: string, name?: string): Promise<ProjectDoc> {
    const doc = await this.get(id);
    if (!doc) throw new Error(`Project ${id} not found`);
    const copy = makeDuplicate(doc, name);
    await this.save(copy);
    return copy;
  }
  async delete(id: string): Promise<void> {
    this.docs.delete(id);
  }
  async rename(id: string, name: string): Promise<void> {
    const doc = await this.get(id);
    if (!doc) throw new Error(`Project ${id} not found`);
    await this.save({ ...doc, meta: { ...doc.meta, name, updatedAt: nowIso() } });
  }
}
