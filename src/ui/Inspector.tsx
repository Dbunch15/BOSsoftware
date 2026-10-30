import type { ReactNode } from 'react';
import { ZONE_LABEL } from '../editor/zoneFactory';
import type { Zone } from '../model/schema';
import { FINISHES, finishById } from '../specs/finishes';
import { updateDoc, useDoc } from '../state/docStore';
import { renameProject, useProjects } from '../state/projects';
import { isSculptTool, useUi } from '../state/uiStore';
import { formatLength } from '../units/format';
import { Field, LengthInput, Slider, TextInput } from './controls';
import { WarningsPanel } from './WarningsPanel';

export function Inspector() {
  return (
    <aside className="inspector" aria-label="Inspector">
      <div className="inspector-scroll">
        <ToolPanel />
        <SelectionPanel />
        <PoolPanel />
        <ZonesPanel />
        <FinishPanel />
        <ProjectPanel />
      </div>
      <div className="inspector-warnings">
        <WarningsPanel />
      </div>
    </aside>
  );
}

function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="section">
      <h3 className="section-title">
        {title}
        {right}
      </h3>
      {children}
    </section>
  );
}

function ToolPanel() {
  const tool = useUi((s) => s.tool);
  const brush = useUi((s) => s.brush);
  const setBrush = useUi((s) => s.setBrush);
  const doc = useDoc();
  const units = doc.units;
  if (!isSculptTool(tool)) return null;
  const cells = Object.keys(doc.sculpt.cells).length;
  return (
    <Section title={`Brush · ${tool}`}>
      <Field label="Size" full>
        <Slider label="Brush size" min={0.2} max={3} step={0.05} value={brush.radius} onChange={(radius) => setBrush({ radius })} format={(v) => formatLength(v * 2, units)} />
      </Field>
      <Field label="Strength" full>
        <Slider label="Brush strength" min={0.05} max={1} step={0.05} value={brush.strength} onChange={(strength) => setBrush({ strength })} format={(v) => `${Math.round(v * 100)}%`} />
      </Field>
      {tool === 'flatten' && (
        <Field label="Target depth">
          <LengthInput units={units} value={brush.flattenDepth} min={0} max={4} onChange={(flattenDepth) => setBrush({ flattenDepth })} />
        </Field>
      )}
      <label className="check">
        <input type="checkbox" checked={brush.usePressure} onChange={(e) => setBrush({ usePressure: e.target.checked })} />
        Pen pressure controls strength
      </label>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
        <span className="tiny">{cells.toLocaleString()} sculpted cells · [ ] size</span>
        <button
          className="btn sm"
          disabled={!cells}
          onClick={() =>
            updateDoc((d) => {
              d.sculpt.cells = {};
            })
          }
        >
          Reset sculpt
        </button>
      </div>
    </Section>
  );
}

function SelectionPanel() {
  const selection = useUi((s) => s.selection);
  const doc = useDoc();
  const units = doc.units;
  if (!selection) return null;

  if (selection.kind === 'point') {
    const p = doc.outline.points[selection.index];
    if (!p) return null;
    return (
      <Section title={`Control point ${selection.index + 1}`}>
        <Field label="X">
          <LengthInput units={units} value={p.x} onChange={(x) => updateDoc((d) => void (d.outline.points[selection.index].x = x))} />
        </Field>
        <Field label="Y">
          <LengthInput units={units} value={p.y} onChange={(y) => updateDoc((d) => void (d.outline.points[selection.index].y = y))} />
        </Field>
        <button
          className="btn sm danger"
          disabled={doc.outline.points.length <= 4}
          onClick={() => {
            updateDoc((d) => void d.outline.points.splice(selection.index, 1));
            useUi.getState().select(null);
          }}
        >
          Delete point
        </button>
      </Section>
    );
  }

  if (selection.kind === 'zone') {
    const z = doc.zones.find((q) => q.id === selection.id);
    if (!z) return null;
    return <ZoneEditor zone={z} />;
  }

  if (selection.kind === 'spa' && doc.spa) {
    const spa = doc.spa;
    return (
      <Section title="Spa · placeholder">
        <Field label="Diameter">
          <LengthInput units={units} value={spa.diameter} min={1} max={5} onChange={(v) => updateDoc((d) => void (d.spa && (d.spa.diameter = v)))} />
        </Field>
        <Field label="Depth">
          <LengthInput units={units} value={spa.depth} min={0.3} max={1.5} onChange={(v) => updateDoc((d) => void (d.spa && (d.spa.depth = v)))} />
        </Field>
        <label className="check">
          <input type="checkbox" checked={spa.spillover} onChange={(e) => updateDoc((d) => void (d.spa && (d.spa.spillover = e.target.checked)))} />
          Spillover into pool
        </label>
        <p className="tiny">Full spa modelling (dam wall, seats, spillover) arrives in phase 2.</p>
      </Section>
    );
  }

  if (selection.kind === 'feature') {
    const f = doc.features.find((q) => q.id === selection.id);
    if (!f) return null;
    const idx = doc.features.indexOf(f);
    return (
      <Section title={`${f.name} · placeholder`}>
        <Field label="Name">
          <TextInput value={f.name} onChange={(v) => updateDoc((d) => void (d.features[idx].name = v))} />
        </Field>
        <Field label="Width">
          <LengthInput units={units} value={f.size.x} min={0.3} onChange={(v) => updateDoc((d) => void (d.features[idx].size.x = v))} />
        </Field>
        <Field label="Depth">
          <LengthInput units={units} value={f.size.y} min={0.3} onChange={(v) => updateDoc((d) => void (d.features[idx].size.y = v))} />
        </Field>
        <button
          className="btn sm danger"
          onClick={() => {
            updateDoc((d) => void d.features.splice(idx, 1));
            useUi.getState().select(null);
          }}
        >
          Remove placeholder
        </button>
      </Section>
    );
  }
  return null;
}

function ZoneEditor({ zone }: { zone: Zone }) {
  const units = useDoc().units;
  const edit = (fn: (z: Zone) => void) =>
    updateDoc((d) => {
      const z = d.zones.find((q) => q.id === zone.id);
      if (z) fn(z as Zone);
    });
  return (
    <Section title={ZONE_LABEL[zone.kind]}>
      <Field label="Name">
        <TextInput value={zone.name} onChange={(v) => edit((z) => void (z.name = v))} />
      </Field>
      {zone.kind === 'beachEntry' && (
        <>
          <Field label="Run length">
            <LengthInput testId="beach-run" units={units} value={zone.runLength} min={0.5} max={20} onChange={(v) => edit((z) => void (z.kind === 'beachEntry' && (z.runLength = v)))} />
          </Field>
          <Field label="End depth">
            <LengthInput testId="beach-end-depth" units={units} value={zone.endDepth} min={0.05} max={2} onChange={(v) => edit((z) => void (z.kind === 'beachEntry' && (z.endDepth = v)))} />
          </Field>
          <Field label="Toe slope">
            <Slider
              label="Toe slope"
              min={0.1}
              max={0.6}
              step={0.01}
              value={zone.toeSlope}
              onChange={(v) => edit((z) => void (z.kind === 'beachEntry' && (z.toeSlope = v)))}
              format={(v) => `${Math.round(v * 100)}%`}
            />
          </Field>
          <Field label="Side taper">
            <LengthInput units={units} value={zone.taper} min={0} max={5} onChange={(v) => edit((z) => void (z.kind === 'beachEntry' && (z.taper = v)))} />
          </Field>
          <p className="tiny">Drag the round handles on the waterline to change the span. If the pool is too short the run compresses and the slope rule flags it.</p>
        </>
      )}
      {zone.kind === 'bench' && (
        <>
          <Field label="Seat width">
            <LengthInput units={units} value={zone.width} min={0.1} max={1.5} onChange={(v) => edit((z) => void (z.kind === 'bench' && (z.width = v)))} />
          </Field>
          <Field label="Seat depth">
            <LengthInput units={units} value={zone.seatDepth} min={0.1} max={1.2} onChange={(v) => edit((z) => void (z.kind === 'bench' && (z.seatDepth = v)))} />
          </Field>
        </>
      )}
      {(zone.kind === 'sunShelf' || zone.kind === 'deepZone') && (
        <>
          <Field label="Depth">
            <LengthInput units={units} value={zone.depth} min={0} max={4} onChange={(v) => edit((z) => void ((z.kind === 'sunShelf' || z.kind === 'deepZone') && (z.depth = v)))} />
          </Field>
          <Field label="Blend">
            <LengthInput units={units} value={zone.blend} min={0.1} max={6} onChange={(v) => edit((z) => void ((z.kind === 'sunShelf' || z.kind === 'deepZone') && (z.blend = v)))} />
          </Field>
          <p className="tiny">Drag the square handles to reshape. Remove-point tool (X) deletes a handle.</p>
        </>
      )}
      <button
        className="btn sm danger"
        style={{ marginTop: 6 }}
        onClick={() => {
          updateDoc((d) => void (d.zones = d.zones.filter((q) => q.id !== zone.id)));
          useUi.getState().select(null);
        }}
      >
        Delete zone
      </button>
    </Section>
  );
}

function PoolPanel() {
  const doc = useDoc();
  const units = doc.units;
  const s = doc.shell;
  return (
    <Section title="Pool shell">
      <Field label="Base floor depth">
        <LengthInput testId="base-depth" units={units} value={s.baseDepth} min={0.3} max={4} onChange={(v) => updateDoc((d) => void (d.shell.baseDepth = v))} />
      </Field>
      <Field label="Wall run">
        <LengthInput units={units} value={s.wallRun} min={0.05} max={4} onChange={(v) => updateDoc((d) => void (d.shell.wallRun = v))} />
      </Field>
      <Field label="Sand lip width">
        <LengthInput units={units} value={s.lipWidth} min={0} max={2} onChange={(v) => updateDoc((d) => void (d.shell.lipWidth = v))} />
      </Field>
      <Field label="Deck above water">
        <LengthInput units={units} value={s.deckHeight} min={0} max={0.6} onChange={(v) => updateDoc((d) => void (d.shell.deckHeight = v))} />
      </Field>
    </Section>
  );
}

function ZonesPanel() {
  const doc = useDoc();
  const selection = useUi((s) => s.selection);
  return (
    <Section title="Zones" right={<span className="count">{doc.zones.length}</span>}>
      {doc.zones.length === 0 && <p className="tiny">Use the zone tools (B, N, S, D) to add a beach, bench, sun shelf or deep zone.</p>}
      {doc.zones.map((z) => (
        <button
          key={z.id}
          className="menu-item"
          aria-current={selection?.kind === 'zone' && selection.id === z.id}
          onClick={() => useUi.getState().select({ kind: 'zone', id: z.id })}
        >
          {z.name}
          <span className="meta">{ZONE_LABEL[z.kind]}</span>
        </button>
      ))}
      {doc.spa && (
        <button className="menu-item" aria-current={selection?.kind === 'spa'} onClick={() => useUi.getState().select({ kind: 'spa' })}>
          Spa<span className="meta">placeholder</span>
        </button>
      )}
      {doc.features.map((f) => (
        <button key={f.id} className="menu-item" aria-current={selection?.kind === 'feature' && selection.id === f.id} onClick={() => useUi.getState().select({ kind: 'feature', id: f.id })}>
          {f.name}
          <span className="meta">placeholder</span>
        </button>
      ))}
    </Section>
  );
}

function FinishPanel() {
  const doc = useDoc();
  const current = finishById(doc.finish.id);
  return (
    <Section title="Finish">
      <div className="finish-grid" role="radiogroup" aria-label="Naturi finish">
        {FINISHES.map((f) => (
          <button
            key={f.id}
            role="radio"
            aria-checked={f.id === current.id}
            aria-pressed={f.id === current.id}
            aria-label={f.name}
            title={`${f.name}${f.confirmed ? '' : ' — unconfirmed'}`}
            className={`swatch${f.confirmed ? '' : ' tbc'}`}
            data-testid={`finish-${f.id}`}
            style={{
              background: `radial-gradient(circle at 30% 30%, ${f.grains[0].color} 0 18%, transparent 19%), radial-gradient(circle at 70% 60%, ${f.grains[1]?.color ?? f.base} 0 14%, transparent 15%), ${f.base}`,
            }}
            onClick={() => updateDoc((d) => void (d.finish.id = f.id))}
          />
        ))}
      </div>
      <div className="finish-name">{current.name}</div>
      <div className="tiny">{current.description}</div>
      <div className="tiny" style={{ marginTop: 4 }}>
        Render color is approximate — confirm against a physical Naturi sample.
      </div>
    </Section>
  );
}

function ProjectPanel() {
  const doc = useDoc();
  const currentId = useProjects((s) => s.currentId);
  const m = doc.meta;
  return (
    <Section title="Project">
      <Field label="Name" full>
        <TextInput value={m.name} onChange={(v) => currentId && v.trim() && renameProject(currentId, v)} />
      </Field>
      <Field label="Client" full>
        <TextInput value={m.client} placeholder="Client name" onChange={(v) => updateDoc((d) => void (d.meta.client = v))} />
      </Field>
      <Field label="Site address" full>
        <TextInput value={m.address} placeholder="Street, town" multiline onChange={(v) => updateDoc((d) => void (d.meta.address = v))} />
      </Field>
      <Field label="Designer" full>
        <TextInput value={m.designer} placeholder="Designer" onChange={(v) => updateDoc((d) => void (d.meta.designer = v))} />
      </Field>
      <h4 className="section-title" style={{ marginTop: 12 }}>
        Revisions
        <button
          className="btn sm"
          onClick={() =>
            updateDoc((d) => {
              const last = d.meta.revisions[d.meta.revisions.length - 1]?.rev ?? '@';
              const next = /^[A-Y]$/.test(last) ? String.fromCharCode(last.charCodeAt(0) + 1) : `${d.meta.revisions.length + 1}`;
              d.meta.revisions.push({ rev: next, date: new Date().toISOString().slice(0, 10), by: d.meta.designer, note: '' });
            })
          }
        >
          + Rev
        </button>
      </h4>
      {m.revisions.map((r, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '28px 82px 1fr', gap: 6, alignItems: 'center', margin: '4px 0' }}>
          <b>{r.rev}</b>
          <span className="tiny">{r.date}</span>
          <TextInput value={r.note} placeholder="Change note" onChange={(v) => updateDoc((d) => void (d.meta.revisions[i].note = v))} />
        </div>
      ))}
    </Section>
  );
}
