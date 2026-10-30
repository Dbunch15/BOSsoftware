import { useUi } from '../state/uiStore';
import { ALL_TOOLS } from './tools';

const OTHER: Array<[string, string]> = [
  ['Ctrl/⌘ Z', 'Undo'],
  ['Ctrl/⌘ Shift Z · Ctrl Y', 'Redo'],
  ['Delete / Backspace', 'Delete selected point or zone'],
  ['Esc', 'Select tool / clear selection'],
  ['[  ]', 'Brush size'],
  ['Shift [  ]', 'Brush strength'],
  ['Space + drag', 'Pan the plan'],
  ['Scroll / pinch', 'Zoom the plan'],
  ['1 · 2 · 3', 'Split · plan · 3D layout'],
  ['.', 'Frame the pool'],
  ['T', '3D top view'],
  ['W', 'Toggle water'],
  ['U', 'Toggle ft-in / m'],
  ['?', 'This help'],
];

export function ShortcutsDialog() {
  const open = useUi((s) => s.helpOpen);
  if (!open) return null;
  const close = () => useUi.getState().set({ helpOpen: false });
  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className="modal" style={{ width: 'min(760px, 100%)' }} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
        <div className="modal-head">
          <div>
            <h2>Keyboard shortcuts</h2>
            <p>Tools work in the plan; sculpt brushes also work directly on the 3D model (right-drag orbits while sculpting).</p>
          </div>
          <button className="btn ghost" onClick={close}>
            Close
          </button>
        </div>
        <div className="modal-body">
          <div className="shortcut-grid">
            {ALL_TOOLS.map((t) => (
              <div key={t.id}>
                <span>{t.label}</span>
                <span className="kbd">{t.key}</span>
              </div>
            ))}
            {OTHER.map(([k, l]) => (
              <div key={k}>
                <span>{l}</span>
                <span className="kbd">{k}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
