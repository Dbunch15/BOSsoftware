import { useEffect } from 'react';
import { getDoc, redo, undo, updateDoc } from '../state/docStore';
import { useUi } from '../state/uiStore';
import { isTyping } from '../ui/hooks';
import { toolByKey } from '../ui/tools';
import { assignSlot, slotForCode } from '../controls/hotbar';

const lastPointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      const ui = useUi.getState();
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key;
      if (mod && k.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && k.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      // Hotbar: 1–9 pick a slot; Alt+1–9 stores the current tool there; Shift+1/2/3 switch layout.
      const slot = slotForCode(e.code);
      if (slot >= 0 && !mod) {
        e.preventDefault();
        if (e.shiftKey) {
          if (slot === 0) ui.setLayout('split');
          if (slot === 1) ui.setLayout('plan');
          if (slot === 2) ui.setLayout('3d');
        } else if (e.altKey) ui.setHotbar(assignSlot(ui.hotbar, slot, ui.tool));
        else ui.setTool(ui.hotbar[slot]);
        return;
      }
      if (e.code === 'KeyQ' && !mod && !e.altKey) {
        e.preventDefault();
        if (!e.repeat && !ui.wheel) ui.set({ wheel: { x: lastPointer.x, y: lastPointer.y } });
        return;
      }
      if (mod || e.altKey) return;

      if (k === 'Escape') {
        ui.set({ tool: 'select', selection: null, helpOpen: false });
        return;
      }
      if (k === 'Delete' || k === 'Backspace') {
        const sel = ui.selection;
        if (sel?.kind === 'point' && getDoc().outline.points.length > 4) {
          updateDoc((d) => void d.outline.points.splice(sel.index, 1));
          ui.select(null);
        } else if (sel?.kind === 'zone') {
          updateDoc((d) => void (d.zones = d.zones.filter((z) => z.id !== sel.id)));
          ui.select(null);
        } else if (sel?.kind === 'rockwork') {
          updateDoc((d) => void (d.rockwork = d.rockwork.filter((r) => r.id !== sel.id)));
          ui.select(null);
        } else if (sel?.kind === 'feature') {
          updateDoc((d) => void (d.features = d.features.filter((f) => f.id !== sel.id)));
          ui.select(null);
        }
        e.preventDefault();
        return;
      }
      if (k === '[' || k === ']' || k === '{' || k === '}') {
        const up = k === ']' || k === '}';
        if (e.shiftKey) ui.setBrush({ strength: Math.min(1, Math.max(0.05, ui.brush.strength + (up ? 0.05 : -0.05))) });
        else ui.setBrush({ radius: Math.min(3, Math.max(0.2, ui.brush.radius * (up ? 1.15 : 1 / 1.15))) });
        return;
      }
      if (k === '.') return ui.requestFit();
      if (k === '?') return ui.set({ helpOpen: !ui.helpOpen });
      if (k.toLowerCase() === 't') return ui.cameraPreset('top');
      if (k.toLowerCase() === 'w') return ui.set({ showWater: !ui.showWater });
      if (k.toLowerCase() === 'u') {
        updateDoc((d) => void (d.units = d.units === 'imperial' ? 'metric' : 'imperial'));
        return;
      }
      const tool = toolByKey(k);
      if (tool) ui.setTool(tool.id);
    };
    const onPointer = (e: PointerEvent) => {
      lastPointer.x = e.clientX;
      lastPointer.y = e.clientY;
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointermove', onPointer, { passive: true });
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointermove', onPointer);
    };
  }, []);
}
