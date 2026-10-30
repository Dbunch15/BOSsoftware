import { redo, undo, updateDoc, useDoc, useHistory } from '../state/docStore';
import { useProjects } from '../state/projects';
import { type Layout, useUi } from '../state/uiStore';
import { Segmented } from './controls';
import { Icon } from './icons';
import { ProjectMenu } from './ProjectMenu';

const SAVE_LABEL = { idle: '', pending: 'Unsaved changes', saving: 'Saving…', saved: 'All changes saved', error: 'Save failed' } as const;

export function TopBar() {
  const doc = useDoc();
  const { canUndo, canRedo } = useHistory();
  const layout = useUi((s) => s.layout);
  const saveState = useProjects((s) => s.saveState);
  return (
    <header className="topbar">
      <div className="brand" title="Bunch Outdoor Services · Prestige Pools division">
        <span className="brand-mark">BUNCH OUTDOOR SERVICES</span>
        <span className="brand-app">
          Naturi Pool Studio <span>· Prestige Pools</span>
        </span>
      </div>
      <ProjectMenu />
      <div style={{ display: 'flex', gap: 2 }}>
        <button className="btn ghost icon" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo" data-testid="undo">
          <Icon name="undo" />
        </button>
        <button className="btn ghost icon" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo" data-testid="redo">
          <Icon name="redo" />
        </button>
      </div>
      <span className="tiny" data-testid="save-status" data-state={saveState} style={{ minWidth: 110 }}>
        {SAVE_LABEL[saveState]}
      </span>
      <div className="spacer" />
      <Segmented<Layout>
        label="Layout"
        value={layout}
        onChange={(l) => useUi.getState().setLayout(l)}
        options={[
          { value: 'split', label: <Icon name="split" size={15} />, title: 'Split view (1)' },
          { value: 'plan', label: <Icon name="plan" size={15} />, title: 'Plan only (2)' },
          { value: '3d', label: <Icon name="cube" size={15} />, title: '3D only (3)' },
        ]}
      />
      <Segmented
        label="Units"
        value={doc.units}
        onChange={(u) =>
          updateDoc((d) => {
            d.units = u;
          })
        }
        options={[
          { value: 'imperial', label: 'ft-in', testId: 'units-imperial' },
          { value: 'metric', label: 'm', testId: 'units-metric' },
        ]}
      />
      <button className="btn ghost icon" title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts" onClick={() => useUi.getState().set({ helpOpen: true })}>
        <Icon name="help" />
      </button>
    </header>
  );
}
