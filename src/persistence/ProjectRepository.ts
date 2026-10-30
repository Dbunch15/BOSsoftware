import type { ProjectDoc } from '../model/schema';

export interface ProjectSummary {
  id: string;
  name: string;
  client: string;
  templateId?: string;
  updatedAt: string;
  createdAt: string;
}

/**
 * Storage boundary for projects. The app only talks to this interface so a server-backed
 * implementation (REST, Supabase, …) can replace IndexedDB later without touching the UI.
 */
export interface ProjectRepository {
  list(): Promise<ProjectSummary[]>;
  get(id: string): Promise<ProjectDoc | undefined>;
  /** Insert or replace. */
  save(doc: ProjectDoc): Promise<void>;
  duplicate(id: string, name?: string): Promise<ProjectDoc>;
  delete(id: string): Promise<void>;
  rename(id: string, name: string): Promise<void>;
}

export function summarize(doc: ProjectDoc): ProjectSummary {
  return {
    id: doc.id,
    name: doc.meta.name,
    client: doc.meta.client,
    templateId: doc.meta.templateId,
    updatedAt: doc.meta.updatedAt,
    createdAt: doc.meta.createdAt,
  };
}

export const byUpdatedDesc = (a: ProjectSummary, b: ProjectSummary) => b.updatedAt.localeCompare(a.updatedAt);
