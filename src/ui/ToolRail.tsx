import { useUi } from '../state/uiStore';
import { Icon } from './icons';
import { TOOL_GROUPS } from './tools';

const ICON: Record<string, string> = {
  select: 'select',
  pen: 'pen',
  insert: 'insert',
  remove: 'remove',
  beach: 'beach',
  bench: 'bench',
  shelf: 'shelf',
  deep: 'deep',
  deepen: 'deepen',
  raise: 'raise',
  smooth: 'smooth',
  flatten: 'flatten',
  pan: 'pan',
};

export function ToolRail() {
  const tool = useUi((s) => s.tool);
  const setTool = useUi((s) => s.setTool);
  return (
    <nav className="rail" aria-label="Tools">
      {TOOL_GROUPS.map((g, gi) => (
        <div key={g.label} style={{ display: 'contents' }}>
          {gi > 0 && <div className="rail-sep" />}
          <div className="rail-label">{g.label}</div>
          {g.tools.map((t) => (
            <button
              key={t.id}
              type="button"
              className="tool-btn"
              aria-pressed={tool === t.id}
              aria-label={t.label}
              title={`${t.label} (${t.key}) — ${t.hint}`}
              data-testid={`tool-${t.id}`}
              onClick={() => setTool(t.id)}
            >
              <Icon name={ICON[t.id]} />
              <span className="kbd-hint">{t.key}</span>
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}
