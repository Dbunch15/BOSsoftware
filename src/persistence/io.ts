/** JSON import/export of a single project. */
import { type ProjectDoc, migrateDoc, newId } from '../model/schema';

export const FILE_EXTENSION = '.naturi.json';

export function exportProjectJson(doc: ProjectDoc): string {
  return JSON.stringify({ format: 'naturi-pool-studio', ...doc }, null, 2);
}

/** Parse + migrate an exported file. Always assigns a fresh id so imports never overwrite. */
export function importProjectJson(text: string, now = new Date().toISOString()): ProjectDoc {
  const raw = JSON.parse(text) as Record<string, unknown>;
  delete raw.format;
  const doc = migrateDoc(raw);
  return { ...doc, id: newId(), meta: { ...doc.meta, updatedAt: now } };
}

export function exportFileName(doc: ProjectDoc): string {
  const slug = doc.meta.name.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'project';
  return slug + FILE_EXTENSION;
}
