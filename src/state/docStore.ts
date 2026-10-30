/**
 * The single undoable ProjectDoc store. All edits go through `updateDoc` (immer recipes).
 * Continuous gestures (drags, strokes, sculpting) are wrapped in begin/endGesture so one gesture
 * becomes one undo step.
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { temporal } from 'zundo';
import { useStore } from 'zustand';
import type { Draft } from 'immer';
import { buildModel, type Model } from '../model/buildModel';
import type { ProjectDoc } from '../model/schema';
import { createFromTemplate } from '../templates';

interface DocState {
  doc: ProjectDoc;
  updateDoc: (recipe: (d: Draft<ProjectDoc>) => void) => void;
}

export const useDocStore = create<DocState>()(
  temporal(
    immer((set) => ({
      doc: createFromTemplate('blank', 'Untitled'),
      updateDoc: (recipe) =>
        set((s) => {
          recipe(s.doc);
        }),
    })),
    {
      partialize: (s) => ({ doc: s.doc }),
      equality: (a, b) => a.doc === b.doc,
      limit: 200,
    },
  ),
);

export const updateDoc = (recipe: (d: Draft<ProjectDoc>) => void) => useDocStore.getState().updateDoc(recipe);
export const getDoc = () => useDocStore.getState().doc;

/** Replace the document without creating history (project open/switch). Clears undo. */
export function loadDoc(doc: ProjectDoc) {
  const t = useDocStore.temporal.getState();
  t.pause();
  useDocStore.setState({ doc });
  t.resume();
  t.clear();
}

let gestureStart: ProjectDoc | null = null;

export function beginGesture() {
  if (gestureStart) return;
  gestureStart = getDoc();
  useDocStore.temporal.getState().pause();
}

export function endGesture() {
  if (!gestureStart) return;
  const start = gestureStart;
  gestureStart = null;
  const t = useDocStore.temporal.getState();
  const final = getDoc();
  if (final === start) {
    t.resume();
    return;
  }
  // Rewind silently, then re-apply the final state once so the gesture is a single undo step.
  useDocStore.setState({ doc: start });
  t.resume();
  useDocStore.setState({ doc: final });
}

export const isGestureActive = () => gestureStart !== null;

export function undo() {
  if (gestureStart) endGesture();
  useDocStore.temporal.getState().undo();
}

export function redo() {
  if (gestureStart) endGesture();
  useDocStore.temporal.getState().redo();
}

export function useHistory() {
  const canUndo = useStore(useDocStore.temporal, (s) => s.pastStates.length > 0);
  const canRedo = useStore(useDocStore.temporal, (s) => s.futureStates.length > 0);
  return { canUndo, canRedo };
}

export function useDoc(): ProjectDoc {
  return useDocStore((s) => s.doc);
}

/** The derived model. buildModel is memoized on the doc reference, so 2D and 3D share one Model. */
export function useModel(): Model {
  return buildModel(useDoc());
}

export const getModel = () => buildModel(getDoc());
