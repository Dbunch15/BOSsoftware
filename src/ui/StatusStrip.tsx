import { sampleDepth } from '../model/floorField';
import { useModel } from '../state/docStore';
import { useUi } from '../state/uiStore';
import { formatArea, formatLength, formatVolume } from '../units/format';

export function StatusStrip() {
  const model = useModel();
  const cursor = useUi((s) => s.cursor);
  const units = model.doc.units;
  const { stats, violations } = model;
  const crit = violations.filter((v) => v.severity === 'critical').length;
  const warn = violations.length - crit;
  const inside = cursor && sampleDepth(model.field, cursor) > -0.001 && model.field.sdf[cellAt(model, cursor)] > 0;
  return (
    <footer className="status" data-testid="status">
      <span className="stat">
        Area<b data-testid="stat-area">{formatArea(stats.area, units)}</b>
      </span>
      <span className="stat">
        Volume<b data-testid="stat-volume">{formatVolume(stats.volume, units)}</b>
      </span>
      <span className="stat">
        Perimeter<b>{formatLength(stats.perimeter, units)}</b>
      </span>
      <span className="stat">
        Max depth<b data-testid="stat-maxdepth">{formatLength(stats.maxDepth, units)}</b>
      </span>
      <span className={`stat ${crit ? 'stat-crit' : warn ? 'stat-warn' : 'stat-ok'}`}>
        Warnings<b data-testid="stat-warnings">{violations.length ? `${violations.length}${crit ? ` (${crit} critical)` : ''}` : 'none'}</b>
      </span>
      <span style={{ flex: 1 }} />
      {cursor && (
        <span className="mono">
          {formatLength(cursor.x, units)}, {formatLength(cursor.y, units)}
          {inside ? ` · depth ${formatLength(sampleDepth(model.field, cursor), units)}` : ''}
        </span>
      )}
      <span className="mono" title="Floor field resolution and rebuild time">
        grid {Math.round(model.field.cell * 100)} cm · {model.buildMs.toFixed(0)} ms
      </span>
    </footer>
  );
}

function cellAt(model: ReturnType<typeof useModel>, p: { x: number; y: number }) {
  const f = model.field;
  const i = Math.min(f.nx - 1, Math.max(0, Math.round((p.x - f.x0) / f.cell)));
  const j = Math.min(f.ny - 1, Math.max(0, Math.round((p.y - f.y0) / f.cell)));
  return j * f.nx + i;
}
