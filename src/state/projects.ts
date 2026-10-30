/**
 * Project lifecycle: list/open/create/duplicate/rename/delete/import/export, plus debounced
 * autosave of the open document through the ProjectRepository interface.
 */
import { create } from 'zustand';
import type { ProjectDoc } from '../model/schema';
import { IndexedDbRepository } from '../persistence/IndexedDbRepository';
import type { ProjectRepository, ProjectSummary } from '../persistence/ProjectRepository';
import { exportFileName, exportProjectJson, importProjectJson } from '../persistence/io';
import { createFromTemplate } from '../templates';
import { getDoc, loadDoc, useDocStore } from './docStore';
import { useUi } from './uiStore';

export type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

interface ProjectsState {
  ready: boolean;
  list: ProjectSummary[];
  currentId: string | null;
  saveState: SaveState;
  galleryOpen: boolean;
  error: string | null;
}

export const useProjects = create<ProjectsState>()(() => ({
  ready: false,
  list: [],
  currentId: null,
  saveState: 'idle',
  galleryOpen: false,
  error: null,
}));

const LAST_KEY = 'nps:lastProject';
const AUTOSAVE_MS = 600;

let repo: ProjectRepository = new IndexedDbRepository();
let timer: ReturnType<typeof setTimeout> | null = null;
let inflight: Promise<void> = Promise.resolve();

function remember(id: string | null) {
  try {
    if (id) localStorage.setItem(LAST_KEY, id);
    else localStorage.removeItem(LAST_KEY);
  } catch {
    /* storage unavailable */
  }
}
function recall(): string | null {
  try {
    return localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
}

async function refreshList() {
  useProjects.setState({ list: await repo.list() });
}

async function saveNow(doc: ProjectDoc) {
  useProjects.setState({ saveState: 'saving' });
  const stamped = { ...doc, meta: { ...doc.meta, updatedAt: new Date().toISOString() } };
  inflight = inflight
    .then(() => repo.save(stamped))
    .then(refreshList)
    .then(() => useProjects.setState({ saveState: timer ? 'pending' : 'saved', error: null }))
    .catch((e: unknown) => useProjects.setState({ saveState: 'error', error: String(e) }));
  return inflight;
}

/** Write any pending change immediately (before switching projects, exporting, …). */
export async function flushSave() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
    if (useProjects.getState().currentId === getDoc().id) await saveNow(getDoc());
  }
  await inflight;
}

function scheduleSave() {
  if (timer) clearTimeout(timer);
  useProjects.setState({ saveState: 'pending' });
  timer = setTimeout(() => {
    timer = null;
    void saveNow(getDoc());
  }, AUTOSAVE_MS);
}

let unsubscribe: (() => void) | null = null;

export async function initProjects(repository?: ProjectRepository) {
  if (repository) repo = repository;
  unsubscribe?.();
  unsubscribe = useDocStore.subscribe((s, prev) => {
    if (s.doc !== prev.doc && s.doc.id === useProjects.getState().currentId) scheduleSave();
  });
  await refreshList();
  const { list } = useProjects.getState();
  const last = recall();
  const target = list.find((p) => p.id === last) ?? list[0];
  if (target) await openProject(target.id);
  useProjects.setState({ ready: true, galleryOpen: !target });
}

export async function openProject(id: string) {
  await flushSave();
  const doc = await repo.get(id);
  if (!doc) return;
  loadDoc(doc);
  useProjects.setState({ currentId: id, saveState: 'saved' });
  useUi.setState({ selection: null });
  useUi.getState().requestFit();
  remember(id);
}

export async function createProject(templateId: string, name?: string) {
  await flushSave();
  const doc = createFromTemplate(templateId, name);
  await repo.save(doc);
  await refreshList();
  await openProject(doc.id);
  useProjects.setState({ galleryOpen: false });
}

export async function duplicateProject(id: string) {
  await flushSave();
  const copy = await repo.duplicate(id);
  await refreshList();
  await openProject(copy.id);
}

export async function renameProject(id: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  await flushSave();
  if (id === getDoc().id) {
    // Rename the open doc through the store so it is undoable and autosaved.
    useDocStore.getState().updateDoc((d) => {
      d.meta.name = trimmed;
    });
    await flushSave();
  } else {
    await repo.rename(id, trimmed);
  }
  await refreshList();
}

export async function deleteProject(id: string) {
  await flushSave();
  await repo.delete(id);
  await refreshList();
  const { list, currentId } = useProjects.getState();
  if (currentId === id) {
    useProjects.setState({ currentId: null });
    remember(null);
    if (list[0]) await openProject(list[0].id);
    else useProjects.setState({ galleryOpen: true });
  }
}

export async function importProject(text: string) {
  const doc = importProjectJson(text);
  await flushSave();
  await repo.save(doc);
  await refreshList();
  await openProject(doc.id);
}

export async function exportCurrent() {
  await flushSave();
  const doc = getDoc();
  const blob = new Blob([exportProjectJson(doc)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = exportFileName(doc);
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const openGallery = (open = true) => useProjects.setState({ galleryOpen: open });
