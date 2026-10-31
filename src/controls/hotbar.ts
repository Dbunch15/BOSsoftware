/** Nine-slot tool hotbar (keys 1–9). Alt+number puts the current tool in a slot. */
import type { Tool } from '../state/uiStore';

export const HOTBAR_SIZE = 9;
export const DEFAULT_HOTBAR: Tool[] = ['select', 'pen', 'beach', 'shelf', 'deep', 'rock', 'deepen', 'raise', 'smooth'];
const KEY = 'nps:hotbar';

const ALL: readonly Tool[] = ['select', 'pen', 'insert', 'remove', 'beach', 'bench', 'shelf', 'deep', 'deepen', 'raise', 'smooth', 'flatten', 'rock', 'pan'];

export function sanitizeHotbar(raw: unknown): Tool[] {
  if (!Array.isArray(raw) || raw.length !== HOTBAR_SIZE) return DEFAULT_HOTBAR.slice();
  return raw.map((t, i) => (ALL.includes(t as Tool) ? (t as Tool) : DEFAULT_HOTBAR[i]));
}

export function loadHotbar(): Tool[] {
  try {
    const s = localStorage.getItem(KEY);
    return sanitizeHotbar(s ? JSON.parse(s) : null);
  } catch {
    return DEFAULT_HOTBAR.slice();
  }
}

export function saveHotbar(slots: Tool[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(slots));
  } catch {
    /* storage unavailable */
  }
}

export function assignSlot(slots: readonly Tool[], index: number, tool: Tool): Tool[] {
  const next = slots.slice();
  // A tool lives in one slot only: swap it out of its old slot.
  const prev = next.indexOf(tool);
  if (prev >= 0 && prev !== index) next[prev] = next[index];
  next[index] = tool;
  return next;
}

/** Slot index for a keyboard event code like "Digit3", or -1. */
export function slotForCode(code: string): number {
  const m = /^(?:Digit|Numpad)([1-9])$/.exec(code);
  return m ? Number(m[1]) - 1 : -1;
}
