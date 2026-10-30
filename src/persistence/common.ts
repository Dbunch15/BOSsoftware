import { type ProjectDoc, ProjectDocSchema, newId } from '../model/schema';

export const nowIso = () => new Date().toISOString();

export function makeDuplicate(doc: ProjectDoc, name?: string): ProjectDoc {
  const now = nowIso();
  const copy = structuredClone(doc) as ProjectDoc;
  return {
    ...copy,
    id: newId(),
    meta: { ...copy.meta, name: name ?? `${doc.meta.name} (copy)`, createdAt: now, updatedAt: now },
  };
}

/** Validate before storing so a bad doc never reaches persistence. */
export function toStored(doc: ProjectDoc): ProjectDoc {
  return ProjectDocSchema.parse(doc);
}
