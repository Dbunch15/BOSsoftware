/**
 * Photo-based finish maps. Sources, in priority order:
 *   1. a sample photo a designer imported on this device (IndexedDB),
 *   2. the official set bundled with the app (public/materials/manifest.json),
 *   3. the procedural texture (fallback).
 */
import { type UseStore, createStore, del, entries, set } from 'idb-keyval';
import { create } from 'zustand';
import type { FinishPhoto } from './importPhoto';

export interface FinishMaps {
  origin: 'device' | 'bundled';
  albedo: string;
  normal?: string;
  roughness?: string;
  tileSize: number;
  size?: number;
  mean?: string;
  source: string;
}

interface LibraryState {
  ready: boolean;
  maps: Record<string, FinishMaps>;
  bundled: Record<string, FinishMaps>;
}

export const useFinishLibrary = create<LibraryState>()(() => ({ ready: false, maps: {}, bundled: {} }));

let store: UseStore | null = null;
const photoStore = () => (store ??= createStore('naturi-pool-studio-finishes', 'photos'));

const urlsFor = new Map<string, string[]>();
function toMaps(p: FinishPhoto): FinishMaps {
  for (const u of urlsFor.get(p.finishId) ?? []) URL.revokeObjectURL(u);
  const albedo = URL.createObjectURL(p.albedo);
  const normal = URL.createObjectURL(p.normal);
  const roughness = URL.createObjectURL(p.roughness);
  urlsFor.set(p.finishId, [albedo, normal, roughness]);
  return { origin: 'device', albedo, normal, roughness, tileSize: p.tileSize, size: p.size, mean: p.mean, source: p.sourceName };
}

interface ManifestEntry {
  albedo: string;
  normal?: string;
  roughness?: string;
  tileSize: number;
  source?: string;
}

async function loadBundled(): Promise<Record<string, FinishMaps>> {
  try {
    const base = `${import.meta.env.BASE_URL}materials/`;
    const res = await fetch(`${base}manifest.json`, { cache: 'no-cache' });
    if (!res.ok) return {};
    const json = (await res.json()) as { finishes?: Record<string, ManifestEntry> };
    const out: Record<string, FinishMaps> = {};
    for (const [id, e] of Object.entries(json.finishes ?? {})) {
      out[id] = {
        origin: 'bundled',
        albedo: base + e.albedo,
        normal: e.normal ? base + e.normal : undefined,
        roughness: e.roughness ? base + e.roughness : undefined,
        tileSize: e.tileSize,
        source: e.source ?? 'Bundled photo set',
      };
    }
    return out;
  } catch {
    return {};
  }
}

export async function initFinishLibrary() {
  const [bundled, local] = await Promise.all([
    loadBundled(),
    entries<string, FinishPhoto>(photoStore()).catch(() => [] as Array<[string, FinishPhoto]>),
  ]);
  const maps: Record<string, FinishMaps> = { ...bundled };
  for (const [id, p] of local) maps[id] = toMaps(p);
  useFinishLibrary.setState({ ready: true, maps, bundled });
}

export async function saveFinishPhoto(p: FinishPhoto) {
  await set(p.finishId, p, photoStore());
  useFinishLibrary.setState((s) => ({ maps: { ...s.maps, [p.finishId]: toMaps(p) } }));
}

export async function removeFinishPhoto(finishId: string) {
  await del(finishId, photoStore());
  for (const u of urlsFor.get(finishId) ?? []) URL.revokeObjectURL(u);
  urlsFor.delete(finishId);
  useFinishLibrary.setState((s) => {
    const maps = { ...s.maps };
    if (s.bundled[finishId]) maps[finishId] = s.bundled[finishId];
    else delete maps[finishId];
    return { maps };
  });
}

/** Download a device photo set so it can be committed to public/materials/ for everyone. */
export async function downloadFinishPhoto(finishId: string) {
  const all = await entries<string, FinishPhoto>(photoStore());
  const p = all.find(([id]) => id === finishId)?.[1];
  if (!p) return;
  const save = (blob: Blob, name: string) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  save(p.albedo, `${finishId}-albedo.jpg`);
  save(p.normal, `${finishId}-normal.jpg`);
  save(p.roughness, `${finishId}-roughness.jpg`);
  const entry = {
    albedo: `finishes/${finishId}/albedo.jpg`,
    normal: `finishes/${finishId}/normal.jpg`,
    roughness: `finishes/${finishId}/roughness.jpg`,
    tileSize: p.tileSize,
    source: p.sourceName,
  };
  save(new Blob([JSON.stringify({ [finishId]: entry }, null, 2)], { type: 'application/json' }), `${finishId}-manifest-entry.json`);
}
