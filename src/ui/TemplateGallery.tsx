import { useMemo, useState } from 'react';
import { buildModel } from '../model/buildModel';
import { bounds } from '../model/geometry';
import { createProject, openGallery, useProjects } from '../state/projects';
import { TEMPLATES } from '../templates';
import { createFromTemplate } from '../templates';
import { depthColor } from '../editor/heatmap';

function Thumb({ id }: { id: string }) {
  const svg = useMemo(() => {
    const m = buildModel(createFromTemplate(id));
    const pts = [...m.outline.pts];
    if (m.doc.spa) {
      const { position: p, diameter: d } = m.doc.spa;
      pts.push({ x: p.x - d / 2, y: p.y - d / 2 }, { x: p.x + d / 2, y: p.y + d / 2 });
    }
    for (const lay of Object.values(m.rockwork)) for (const r of lay.rocks) pts.push(...r.plan);
    for (const f of m.doc.features) pts.push({ x: f.position.x - f.size.x / 2, y: f.position.y - f.size.y / 2 }, { x: f.position.x + f.size.x / 2, y: f.position.y + f.size.y / 2 });
    const b = bounds(pts);
    const pad = 1;
    const vb = `${b.minX - pad} ${b.minY - pad} ${b.maxX - b.minX + 2 * pad} ${b.maxY - b.minY + 2 * pad}`;
    const path = (ps: Array<{ x: number; y: number }>) => `M${ps.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join('L')}Z`;
    const deep = m.contours.slice().sort((a, b2) => a.level - b2.level);
    const rocks = Object.values(m.rockwork)
      .flatMap((lay) => lay.rocks)
      .sort((a, b) => a.y + a.sy - (b.y + b.sy))
      .map((r) => path(r.plan));
    return { vb, outline: path(m.outline.pts), contours: deep.map((c) => ({ d: path(c.points), fill: depthColor(c.level) })), spa: m.doc.spa, features: m.doc.features, rocks };
  }, [id]);
  const rgb = (c: number[]) => `rgb(${c.map(Math.round).join(',')})`;
  return (
    <svg viewBox={svg.vb} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <path d={svg.outline} fill={rgb(depthColor(0.1))} />
      {svg.contours.map((c, i) => (
        <path key={i} d={c.d} fill={rgb(c.fill)} stroke="rgba(255,255,255,0.35)" strokeWidth={0.04} />
      ))}
      <path d={svg.outline} fill="none" stroke="#efe5cc" strokeWidth={0.12} />
      {svg.rocks.map((d, i) => (
        <path key={i} d={d} fill="#a99274" stroke="rgba(30,24,18,0.7)" strokeWidth={0.04} />
      ))}
      {svg.spa && <circle cx={svg.spa.position.x} cy={svg.spa.position.y} r={svg.spa.diameter / 2} fill="rgba(95,214,205,0.25)" stroke="#9fe" strokeWidth={0.08} strokeDasharray="0.3 0.2" />}
      {svg.features.map((f) =>
        f.polygon ? (
          <path key={f.id} d={`M${f.polygon.map((p) => `${p.x},${p.y}`).join('L')}Z`} fill="rgba(60,120,110,0.4)" stroke="#ccc" strokeWidth={0.08} strokeDasharray="0.3 0.2" />
        ) : (
          <rect key={f.id} x={f.position.x - f.size.x / 2} y={f.position.y - f.size.y / 2} width={f.size.x} height={f.size.y} rx={0.6} fill="rgba(150,140,130,0.4)" stroke="#ccc" strokeWidth={0.08} strokeDasharray="0.3 0.2" />
        ),
      )}
    </svg>
  );
}

export function TemplateGallery() {
  const hasProjects = useProjects((s) => s.list.length > 0);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const pick = async (id: string) => {
    setBusy(true);
    try {
      await createProject(id, name.trim() || undefined);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="gallery-title" data-testid="template-gallery">
      <div className="modal">
        <div className="modal-head">
          <div>
            <h2 id="gallery-title">New pool design</h2>
            <p>Start from a template. Everything stays editable — outline, zones, depths and finish.</p>
          </div>
          {hasProjects && (
            <button className="btn ghost" onClick={() => openGallery(false)} aria-label="Close">
              Cancel
            </button>
          )}
        </div>
        <div className="modal-body">
          <div className="name-row">
            <input
              className="input"
              placeholder="Project name (e.g. Smith residence)"
              value={name}
              data-testid="new-project-name"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
          <div className="template-grid">
            {TEMPLATES.map((t) => (
              <button key={t.id} className="template-card" disabled={busy} data-testid={`template-${t.id}`} onClick={() => pick(t.id)}>
                <Thumb id={t.id} />
                <div className="tc-body">
                  <div className="tc-name">{t.name}</div>
                  <div className="tc-blurb">{t.blurb}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
