import { useEffect } from 'react';
import { getDoc, redo, undo, updateDoc } from '../state/docStore';
import { useUi } from '../state/uiStore';
import { isTyping } from '../ui/hooks';
import { toolByKey } from '../ui/tools';

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
      if (k === '1') return ui.setLayout('split');
      if (k === '2') return ui.setLayout('plan');
      if (k === '3') return ui.setLayout('3d');
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
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
