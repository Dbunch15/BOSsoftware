import { useUi } from '../state/uiStore';
import { Icon } from './icons';
import { TOOL_GROUPS, TOOL_ICON } from './tools';


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
              <Icon name={TOOL_ICON[t.id]} />
              <span className="kbd-hint">{t.key}</span>
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}
