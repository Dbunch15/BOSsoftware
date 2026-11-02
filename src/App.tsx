import { useEffect } from 'react';
import { PlanEditor } from './editor/PlanEditor';
import { useShortcuts } from './editor/useShortcuts';
import { initFinishLibrary } from './materials/finishLibrary';
import { initProjects, useProjects } from './state/projects';
import { useUi } from './state/uiStore';
import { Icon } from './ui/icons';
import { Inspector } from './ui/Inspector';
import { ShortcutsDialog } from './ui/ShortcutsDialog';
import { StatusStrip } from './ui/StatusStrip';
import { TemplateGallery } from './ui/TemplateGallery';
import { ToolRail } from './ui/ToolRail';
import { Hotbar } from './ui/Hotbar';
import { ToolWheel } from './ui/ToolWheel';
import { TopBar } from './ui/TopBar';
import { Viewport3D } from './viewport/Viewport3D';

export default function App() {
  const ready = useProjects((s) => s.ready);
  const galleryOpen = useProjects((s) => s.galleryOpen);
  const hasProject = useProjects((s) => s.currentId !== null);
  const layout = useUi((s) => s.layout);
  useShortcuts();

  useEffect(() => {
    void initProjects();
    void initFinishLibrary();
  }, []);

  return (
    <div className="app" data-testid="app" data-ready={ready && hasProject ? '1' : '0'}>
      <TopBar />
      <ToolRail />
      <main className="center">
        <section className="pane" hidden={layout === '3d'} aria-label="Plan">
          {hasProject && <PlanEditor />}
          <PaneHead title="Plan" maximized={layout === 'plan'} onToggle={() => useUi.getState().setLayout(layout === 'plan' ? 'split' : 'plan')} kind="plan" />
        </section>
        <section className="pane" hidden={layout === 'plan'} aria-label="3D view">
          {hasProject && <Viewport3D />}
          <PaneHead title="3D" maximized={layout === '3d'} onToggle={() => useUi.getState().setLayout(layout === '3d' ? 'split' : '3d')} kind="3d" />
        </section>
      </main>
      <Hotbar />
      <ToolWheel />
      <Inspector />
      <StatusStrip />
      {ready && galleryOpen && <TemplateGallery />}
      <ShortcutsDialog />
    </div>
  );
}

function PaneHead({ title, maximized, onToggle, kind }: { title: string; maximized: boolean; onToggle: () => void; kind: 'plan' | '3d' }) {
  const showHeatmap = useUi((s) => s.showHeatmap);
  const showContours = useUi((s) => s.showContours);
  const showWater = useUi((s) => s.showWater);
  const quality = useUi((s) => s.quality);
  const set = useUi((s) => s.set);
  return (
    <div className="pane-head">
      <span className="pane-title">{title}</span>
      <div className="view-tools">
        {kind === 'plan' ? (
          <>
            <button className="btn sm" aria-pressed={showHeatmap} title="Depth heatmap" onClick={() => set({ showHeatmap: !showHeatmap })}>
              <Icon name="heat" size={15} />
            </button>
            <button className="btn sm" aria-pressed={showContours} title="Contours" onClick={() => set({ showContours: !showContours })}>
              <Icon name="contours" size={15} />
            </button>
          </>
        ) : (
          <>
            <button className="btn sm" aria-pressed={showWater} title="Water (W)" onClick={() => set({ showWater: !showWater })}>
              <Icon name="water" size={15} />
            </button>
            <button className="btn sm" title="Top view (T)" onClick={() => useUi.getState().cameraPreset('top')}>
              <Icon name="top" size={15} />
            </button>
            <button className="btn sm" title="Quality" aria-pressed={quality === 'high'} onClick={() => set({ quality: quality === 'high' ? 'low' : 'high' })}>
              {quality === 'high' ? 'HQ' : 'LQ'}
            </button>
          </>
        )}
        <button className="btn sm" title="Frame the pool (.)" onClick={() => useUi.getState().requestFit()}>
          <Icon name="fit" size={15} />
        </button>
        <button className="btn sm" title={maximized ? 'Back to split view' : 'Full screen'} data-testid={`maximize-${kind}`} onClick={onToggle}>
          <Icon name={maximized ? 'minimize' : 'maximize'} size={15} />
        </button>
      </div>
    </div>
  );
}
