import { useEffect, useState } from 'react';
import { wheelIndexAt, wheelSlotPosition } from '../controls/toolWheel';
import { useUi } from '../state/uiStore';
import { Icon } from './icons';
import { ALL_TOOLS, TOOL_ICON } from './tools';

const RADIUS = 118;

/** Hold Q: a radial menu of every tool opens at the pointer; point at one and release to pick it. */
export function ToolWheel() {
  const wheel = useUi((s) => s.wheel);
  const tool = useUi((s) => s.tool);
  const [hover, setHover] = useState(-1);

  useEffect(() => {
    if (!wheel) return;
    setHover(-1);
    const move = (e: PointerEvent) => setHover(wheelIndexAt(e.clientX - wheel.x, e.clientY - wheel.y, ALL_TOOLS.length));
    window.addEventListener('pointermove', move);
    return () => window.removeEventListener('pointermove', move);
  }, [wheel]);

  // Releasing Q commits the hovered tool (handled here so the hover state is current).
  useEffect(() => {
    if (!wheel) return;
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'KeyQ') return;
      if (hover >= 0) useUi.getState().setTool(ALL_TOOLS[hover].id);
      useUi.getState().set({ wheel: null });
    };
    window.addEventListener('keyup', up);
    return () => window.removeEventListener('keyup', up);
  }, [wheel, hover]);

  if (!wheel) return null;
  const focus = hover >= 0 ? ALL_TOOLS[hover] : ALL_TOOLS.find((t) => t.id === tool);
  return (
    <div className="tool-wheel" style={{ left: wheel.x, top: wheel.y }} data-testid="tool-wheel" role="menu" aria-label="Tool wheel">
      <div className="tool-wheel-ring" />
      {ALL_TOOLS.map((t, i) => {
        const p = wheelSlotPosition(i, ALL_TOOLS.length, RADIUS);
        return (
          <button
            key={t.id}
            type="button"
            role="menuitem"
            className="tool-wheel-slot"
            data-testid={`wheel-${t.id}`}
            aria-current={i === hover}
            aria-pressed={t.id === tool}
            style={{ transform: `translate(${p.x}px, ${p.y}px)` }}
            onPointerEnter={() => setHover(i)}
            onClick={() => {
              useUi.getState().setTool(t.id);
              useUi.getState().set({ wheel: null });
            }}
          >
            <Icon name={TOOL_ICON[t.id]} size={20} />
          </button>
        );
      })}
      <div className="tool-wheel-center">
        <b>{focus?.label}</b>
        <span>{focus?.key}</span>
      </div>
    </div>
  );
}
