import { HOTBAR_SIZE } from '../controls/hotbar';
import { useDoc } from '../state/docStore';
import { isSculptTool, useUi } from '../state/uiStore';
import { formatLength } from '../units/format';
import { Icon } from './icons';
import { ALL_TOOLS, TOOL_ICON } from './tools';

const SHAPE_LABEL = { round: 'Round', flat: 'Flat', noise: 'Noise' } as const;

/** Bottom-centre hotbar: keys 1–9 pick a slot, Alt+number stores the current tool, scroll over it cycles. */
export function Hotbar() {
  const slots = useUi((s) => s.hotbar);
  const tool = useUi((s) => s.tool);
  const brush = useUi((s) => s.brush);
  const units = useDoc().units;
  const active = slots.indexOf(tool);
  return (
    <div className="hotbar-wrap">
      {isSculptTool(tool) && (
        <div className="brush-pill" data-testid="brush-pill">
          <b>{formatLength(brush.radius * 2, units)}</b>
          <span>{Math.round(brush.strength * 100)}%</span>
          <span>{SHAPE_LABEL[brush.shape]}</span>
          <span className="tiny">scroll size · Ctrl+scroll strength</span>
        </div>
      )}
      <div
        className="hotbar"
        role="toolbar"
        aria-label="Hotbar"
        data-testid="hotbar"
        onWheel={(e) => {
          const i = active < 0 ? 0 : (active + (e.deltaY > 0 ? 1 : -1) + HOTBAR_SIZE) % HOTBAR_SIZE;
          useUi.getState().setTool(slots[i]);
        }}
      >
        {slots.map((t, i) => {
          const info = ALL_TOOLS.find((x) => x.id === t);
          return (
            <button
              key={i}
              type="button"
              className="hotbar-slot"
              aria-pressed={t === tool}
              data-testid={`hotbar-${i + 1}`}
              data-tool={t}
              title={`${info?.label ?? t} — ${i + 1} (Alt+${i + 1} puts the current tool here)`}
              onClick={() => useUi.getState().setTool(t)}
            >
              <Icon name={TOOL_ICON[t]} size={20} />
              <span className="hotbar-key">{i + 1}</span>
            </button>
          );
        })}
      </div>
      <div className="hotbar-label">{ALL_TOOLS.find((x) => x.id === tool)?.label}</div>
    </div>
  );
}
