/** Plan view of rockwork: each boulder drawn top-down, stacked by height, plus falls and grotto. */
import type { PointerEvent as RPointerEvent } from 'react';
import type { Model } from '../model/buildModel';
import type { Units } from '../model/schema';
import { ROCK_COLORS } from '../rockwork/colors';
import { formatLength } from '../units/format';

const pathOf = (pts: ReadonlyArray<{ x: number; y: number }>, closed: boolean) =>
  pts.length ? `M${pts.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`).join('L')}${closed ? 'Z' : ''}` : '';

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

export function RockworkPlan({
  model,
  scale,
  units,
  selectedId,
  onRockDown,
  onPointDown,
}: {
  model: Model;
  scale: number;
  units: Units;
  selectedId: string | null;
  onRockDown: (e: RPointerEvent, id: string) => void;
  onPointDown: (e: RPointerEvent, id: string, index: number) => void;
}) {
  return (
    <g>
      {model.doc.rockwork.map((rw) => {
        const lay = model.rockwork[rw.id];
        if (!lay) return null;
        const sel = selectedId === rw.id;
        const base = ROCK_COLORS[rw.rockType];
        const ys = lay.rocks.map((r) => r.y + r.sy);
        const lo = Math.min(...ys, 0);
        const hi = Math.max(...ys, 1e-3);
        const order = lay.rocks.map((_, i) => i).sort((a, b) => lay.rocks[a].y + lay.rocks[a].sy - (lay.rocks[b].y + lay.rocks[b].sy));
        const mid = lay.spine[Math.floor(lay.spine.length / 2)];
        const fs = 10 / scale;
        return (
          <g key={rw.id} data-testid="plan-rockwork" data-rocks={lay.rocks.length}>
            {lay.grotto && (
              <path d={pathOf(lay.grotto.outline, true)} fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.6)" strokeDasharray="4 3" strokeWidth={1.2} vectorEffect="non-scaling-stroke" pointerEvents="none" />
            )}
            <g style={{ cursor: 'move' }} onPointerDown={(e) => onRockDown(e, rw.id)}>
              {order.map((i) => {
                const r = lay.rocks[i];
                const t = (r.y + r.sy - lo) / (hi - lo);
                return (
                  <path
                    key={i}
                    d={pathOf(r.plan, true)}
                    fill={shade(base, 0.62 + 0.5 * t)}
                    fillOpacity={r.slab && lay.grotto ? 0.75 : 1}
                    stroke={sel ? 'var(--accent)' : 'rgba(20,16,12,0.7)'}
                    strokeWidth={sel ? 1.2 : 0.8}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </g>
            {lay.falls &&
              lay.falls.columns
                .filter((_, i, a) => i % Math.max(1, Math.round(a.length / 5)) === 0)
                .map((col, i) => {
                  const a = col[0];
                  const b = col[col.length - 1];
                  return (
                    <g key={i} pointerEvents="none">
                      <line x1={a.x} y1={a.z} x2={b.x} y2={b.z} stroke="#8fe3ff" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                      <circle cx={b.x} cy={b.z} r={3 / scale} fill="#8fe3ff" />
                    </g>
                  );
                })}
            <text x={mid.x} y={mid.y} dy={-fs * 1.4} fontSize={fs} fill="#efe4cf" strokeWidth={3 / scale} textAnchor="middle" fontWeight={650} pointerEvents="none">
              {rw.name.toUpperCase()} · {formatLength(rw.height, units)}
            </text>
            {sel && (
              <>
                <path d={pathOf(rw.path, false)} fill="none" stroke="var(--accent)" strokeDasharray="5 4" strokeWidth={1.4} vectorEffect="non-scaling-stroke" pointerEvents="none" />
                {rw.path.map((p, i) => (
                  <circle
                    key={i}
                    data-testid="rock-pt"
                    cx={p.x}
                    cy={p.y}
                    r={6 / scale}
                    fill="#0f1214"
                    stroke="var(--accent)"
                    strokeWidth={1.6}
                    vectorEffect="non-scaling-stroke"
                    style={{ cursor: 'move' }}
                    onPointerDown={(e) => onPointDown(e, rw.id, i)}
                  />
                ))}
              </>
            )}
          </g>
        );
      })}
    </g>
  );
}
