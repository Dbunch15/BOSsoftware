import { create } from 'zustand';
import type { Vec2 } from '../model/geometry';
import type { BrushShape } from '../editor/sculpt';
import { loadHotbar, saveHotbar } from '../controls/hotbar';

export type Tool =
  | 'select'
  | 'pen'
  | 'insert'
  | 'remove'
  | 'beach'
  | 'bench'
  | 'shelf'
  | 'deep'
  | 'deepen'
  | 'raise'
  | 'smooth'
  | 'flatten'
  | 'rock'
  | 'pan';

export const SCULPT_TOOLS = ['deepen', 'raise', 'smooth', 'flatten'] as const;
export type SculptTool = (typeof SCULPT_TOOLS)[number];
export const isSculptTool = (t: Tool): t is SculptTool => (SCULPT_TOOLS as readonly string[]).includes(t);

export type Selection =
  | { kind: 'point'; index: number }
  | { kind: 'zone'; id: string }
  | { kind: 'feature'; id: string }
  | { kind: 'spa' }
  | { kind: 'violation'; id: string }
  | { kind: 'rockwork'; id: string }
  | null;

export type Layout = 'split' | 'plan' | '3d';
export type RockPreset = 'wall' | 'waterfall' | 'grotto';

export interface BrushSettings {
  /** Radius in meters. */
  radius: number;
  /** 0..1 */
  strength: number;
  /** Target depth for flatten (m). */
  flattenDepth: number;
  usePressure: boolean;
  shape: BrushShape;
}

interface UiState {
  tool: Tool;
  selection: Selection;
  layout: Layout;
  brush: BrushSettings;
  rockPreset: RockPreset;
  /** Nine hotbar slots (keys 1–9). */
  hotbar: Tool[];
  /** Radial tool wheel, open while Q is held. */
  wheel: { x: number; y: number } | null;
  /** 3D fly camera status while right mouse is held. */
  flight: { speed: number } | null;
  showWater: boolean;
  showHeatmap: boolean;
  showContours: boolean;
  quality: 'high' | 'low';
  /** Plan cursor readout. */
  cursor: Vec2 | null;
  /** Bumped to ask views to frame something. */
  focus: { at: Vec2 | null; nonce: number };
  fitNonce: number;
  camPreset: { preset: 'persp' | 'top'; nonce: number };
  helpOpen: boolean;
  setTool: (t: Tool) => void;
  select: (s: Selection) => void;
  setLayout: (l: Layout) => void;
  setBrush: (b: Partial<BrushSettings>) => void;
  set: (p: Partial<Omit<UiState, 'set'>>) => void;
  focusOn: (at: Vec2 | null) => void;
  requestFit: () => void;
  cameraPreset: (preset: 'persp' | 'top') => void;
  setHotbar: (slots: Tool[]) => void;
}

/** `?quality=low` starts with the cheap render path (handy for slow GPUs and automated tests). */
function initialQuality(): 'high' | 'low' {
  try {
    return new URLSearchParams(window.location.search).get('quality') === 'low' ? 'low' : 'high';
  } catch {
    return 'high';
  }
}

export const useUi = create<UiState>()((set) => ({
  tool: 'select',
  selection: null,
  layout: 'split',
  brush: { radius: 0.9, strength: 0.5, flattenDepth: 1.2, usePressure: true, shape: 'round' },
  hotbar: loadHotbar(),
  wheel: null,
  flight: null,
  rockPreset: 'waterfall',
  showWater: true,
  showHeatmap: true,
  showContours: true,
  quality: initialQuality(),
  cursor: null,
  focus: { at: null, nonce: 0 },
  fitNonce: 0,
  camPreset: { preset: 'persp', nonce: 0 },
  helpOpen: false,
  setTool: (tool) => set({ tool }),
  select: (selection) => set({ selection }),
  setLayout: (layout) => set({ layout }),
  setBrush: (b) => set((s) => ({ brush: { ...s.brush, ...b } })),
  set: (p) => set(p),
  focusOn: (at) => set((s) => ({ focus: { at, nonce: s.focus.nonce + 1 } })),
  requestFit: () => set((s) => ({ fitNonce: s.fitNonce + 1, camPreset: { preset: 'persp', nonce: s.camPreset.nonce + 1 } })),
  cameraPreset: (preset) => set((s) => ({ camPreset: { preset, nonce: s.camPreset.nonce + 1 } })),
  setHotbar: (hotbar) => {
    saveHotbar(hotbar);
    set({ hotbar });
  },
}));
