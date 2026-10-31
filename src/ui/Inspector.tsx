import { type ReactNode, useState } from 'react';
import { ZONE_LABEL } from '../editor/zoneFactory';
import type { Zone } from '../model/schema';
import { FINISHES, finishById } from '../specs/finishes';
import { updateDoc, useDoc } from '../state/docStore';
import { renameProject, useProjects } from '../state/projects';
import { type RockPreset, isSculptTool, useUi } from '../state/uiStore';
import type { BrushShape } from '../editor/sculpt';
import { formatLength } from '../units/format';
import { Field, LengthInput, Segmented, Slider, TextInput } from './controls';
import { ROCK_TYPES, type Rockwork } from '../model/schema';
import { ROCK_COLORS, ROCK_LABELS } from '../rockwork/colors';
import { WarningsPanel } from './WarningsPanel';
import { PhotoImportDialog } from './PhotoImportDialog';
import { downloadFinishPhoto, removeFinishPhoto, useFinishLibrary } from '../materials/finishLibrary';

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
  const rockPreset = useUi((s) => s.rockPreset);
  const doc = useDoc();
  const units = doc.units;
  if (tool === 'rock') {
    return (
      <Section title="Rockwork">
        <Segmented<RockPreset>
          label="Rockwork preset"
          value={rockPreset}
          onChange={(v) => useUi.getState().set({ rockPreset: v })}
          options={[
            { value: 'wall', label: 'Rock wall', testId: 'preset-wall' },
            { value: 'waterfall', label: 'Waterfall', testId: 'preset-waterfall' },
            { value: 'grotto', label: 'Grotto', testId: 'preset-grotto' },
          ]}
        />
        <p className="tiny" style={{ marginTop: 8 }}>
          Click points along the line of the rockwork — usually just outside the waterline so the face meets the pool. Double-click or press
          Enter to finish, Backspace removes the last point.
        </p>
      </Section>
    );
  }
  if (!isSculptTool(tool)) return null;
  const cells = Object.keys(doc.sculpt.cells).length;
  return (
    <Section title={`Brush · ${tool}`}>
      <Field label="Size" full>
        <Slider label="Brush size" min={0.2} max={3} step={0.05} value={brush.radius} onChange={(radius) => setBrush({ radius })} format={(v) => formatLength(v * 2, units)} />
      </Field>
      <Field label="Shape" full>
        <Segmented<BrushShape>
          label="Brush shape"
          value={brush.shape}
          onChange={(shape) => setBrush({ shape })}
          options={[
            { value: 'round', label: 'Round', testId: 'shape-round' },
            { value: 'flat', label: 'Flat', testId: 'shape-flat' },
            { value: 'noise', label: 'Noise', testId: 'shape-noise' },
          ]}
        />
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
        <span className="tiny">{cells.toLocaleString()} sculpted cells · scroll or [ ] size</span>
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

  if (selection.kind === 'rockwork') {
    const rw = doc.rockwork.find((r) => r.id === selection.id);
    return rw ? <RockworkEditor rw={rw} /> : null;
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

function RockworkEditor({ rw }: { rw: Rockwork }) {
  const units = useDoc().units;
  const edit = (fn: (r: Rockwork) => void) =>
    updateDoc((d) => {
      const r = d.rockwork.find((q) => q.id === rw.id);
      if (r) fn(r as Rockwork);
    });
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  return (
    <Section title="Rockwork">
      <Field label="Name">
        <TextInput value={rw.name} onChange={(v) => edit((r) => void (r.name = v))} />
      </Field>
      <Field label="Height above deck">
        <LengthInput testId="rock-height" units={units} value={rw.height} min={0.3} max={5} onChange={(v) => edit((r) => void (r.height = v))} />
      </Field>
      <Field label="Depth (front to back)">
        <LengthInput units={units} value={rw.thickness} min={0.4} max={5} onChange={(v) => edit((r) => void (r.thickness = v))} />
      </Field>
      <Field label="Boulder size">
        <LengthInput units={units} value={rw.boulderSize} min={0.25} max={2} onChange={(v) => edit((r) => void (r.boulderSize = v))} />
      </Field>
      <Field label="Character" full>
        <Slider label="Jaggedness" min={0} max={1} step={0.05} value={rw.jaggedness} onChange={(v) => edit((r) => void (r.jaggedness = v))} format={(v) => (v < 0.34 ? 'River rock' : v < 0.67 ? 'Natural' : 'Quarried')} />
      </Field>
      <div className="rock-types" role="radiogroup" aria-label="Rock type">
        {ROCK_TYPES.map((t) => (
          <button key={t} role="radio" aria-checked={rw.rockType === t} aria-pressed={rw.rockType === t} className="rock-type" onClick={() => edit((r) => void (r.rockType = t))}>
            <i style={{ background: ROCK_COLORS[t] }} />
            {ROCK_LABELS[t]}
          </button>
        ))}
      </div>
      <button className="btn sm" style={{ margin: '8px 0 4px' }} onClick={() => edit((r) => void (r.seed = Math.floor(Math.random() * 1e6)))} data-testid="rock-reshuffle">
        Reshuffle boulders
      </button>

      <h4 className="section-title" style={{ marginTop: 14 }}>
        Waterfall
        <input type="checkbox" aria-label="Waterfall" checked={rw.waterfall.enabled} onChange={(e) => edit((r) => void (r.waterfall.enabled = e.target.checked))} data-testid="rock-waterfall" />
      </h4>
      {rw.waterfall.enabled && (
        <>
          <Segmented
            label="Waterfall type"
            value={rw.waterfall.type}
            onChange={(v) => edit((r) => void (r.waterfall.type = v))}
            options={[
              { value: 'sheet', label: 'Sheet spill' },
              { value: 'cascade', label: 'Cascade' },
            ]}
          />
          <Field label="Starts at" full>
            <Slider label="Waterfall start" min={0} max={1} step={0.01} value={rw.waterfall.span.t0} onChange={(v) => edit((r) => void (r.waterfall.span.t0 = Math.min(v, r.waterfall.span.t1 - 0.05)))} format={pct} />
          </Field>
          <Field label="Ends at" full>
            <Slider label="Waterfall end" min={0} max={1} step={0.01} value={rw.waterfall.span.t1} onChange={(v) => edit((r) => void (r.waterfall.span.t1 = Math.max(v, r.waterfall.span.t0 + 0.05)))} format={pct} />
          </Field>
        </>
      )}

      <h4 className="section-title" style={{ marginTop: 14 }}>
        Grotto
        <input type="checkbox" aria-label="Grotto" checked={rw.grotto.enabled} onChange={(e) => edit((r) => void (r.grotto.enabled = e.target.checked))} data-testid="rock-grotto" />
      </h4>
      {rw.grotto.enabled && (
        <>
          <Field label="Opening height">
            <LengthInput units={units} value={rw.grotto.openingHeight} min={0.5} max={3} onChange={(v) => edit((r) => void (r.grotto.openingHeight = v))} />
          </Field>
          <Field label="Opening from" full>
            <Slider label="Grotto start" min={0} max={1} step={0.01} value={rw.grotto.span.t0} onChange={(v) => edit((r) => void (r.grotto.span.t0 = Math.min(v, r.grotto.span.t1 - 0.05)))} format={pct} />
          </Field>
          <Field label="Opening to" full>
            <Slider label="Grotto end" min={0} max={1} step={0.01} value={rw.grotto.span.t1} onChange={(v) => edit((r) => void (r.grotto.span.t1 = Math.max(v, r.grotto.span.t0 + 0.05)))} format={pct} />
          </Field>
          {rw.height < rw.grotto.openingHeight + rw.boulderSize * 0.7 && <p className="tiny">The roof rises above the wall height to clear the opening.</p>}
        </>
      )}
      <p className="tiny">Drag the rocks to move the whole feature; drag the round handles to reshape its line. Remove-point (X) deletes a handle.</p>
      <button
        className="btn sm danger"
        style={{ marginTop: 6 }}
        onClick={() => {
          updateDoc((d) => void (d.rockwork = d.rockwork.filter((q) => q.id !== rw.id)));
          useUi.getState().select(null);
        }}
      >
        Delete rockwork
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
      {doc.rockwork.map((rw) => (
        <button key={rw.id} className="menu-item" aria-current={selection?.kind === 'rockwork' && selection.id === rw.id} onClick={() => useUi.getState().select({ kind: 'rockwork', id: rw.id })}>
          {rw.name}
          <span className="meta">rockwork</span>
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
  const maps = useFinishLibrary((s) => s.maps);
  const [importing, setImporting] = useState(false);
  const photo = maps[current.id];
  return (
    <Section title="Finish">
      <div className="finish-grid" role="radiogroup" aria-label="Naturi finish">
        {FINISHES.map((f) => {
          const m = maps[f.id];
          return (
            <button
              key={f.id}
              role="radio"
              aria-checked={f.id === current.id}
              aria-pressed={f.id === current.id}
              aria-label={f.name}
              title={`${f.name}${f.confirmed ? '' : ' — unconfirmed'}${m ? ' · photo' : ''}`}
              className={`swatch${f.confirmed ? '' : ' tbc'}${m ? ' photo' : ''}`}
              data-testid={`finish-${f.id}`}
              style={{
                background: m
                  ? `url(${m.albedo}) center / 300% repeat`
                  : `radial-gradient(circle at 30% 30%, ${f.grains[0].color} 0 18%, transparent 19%), radial-gradient(circle at 70% 60%, ${f.grains[1]?.color ?? f.base} 0 14%, transparent 15%), ${f.base}`,
              }}
              onClick={() => updateDoc((d) => void (d.finish.id = f.id))}
            />
          );
        })}
      </div>
      <div className="finish-name">{current.name}</div>
      <div className="tiny">{current.description}</div>
      <div className="photo-status" data-testid="finish-source">
        {photo ? (
          <>
            <b>{photo.origin === 'device' ? 'Your sample photo' : 'Bundled photo'}</b> · {photo.size ? `${photo.size} px · ` : ''}
            {formatLength(photo.tileSize, doc.units)} tile
            <div className="tiny">{photo.source}</div>
          </>
        ) : (
          <>
            <b>Procedural preview</b>
            <div className="tiny">Approximate color — import a photo of a physical sample for a true match.</div>
          </>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button className="btn sm" onClick={() => setImporting(true)} data-testid="import-photo">
          Import sample photo…
        </button>
        {photo?.origin === 'device' && (
          <>
            <button className="btn sm" onClick={() => downloadFinishPhoto(current.id)}>
              Download maps
            </button>
            <button className="btn sm danger" onClick={() => removeFinishPhoto(current.id)}>
              Remove photo
            </button>
          </>
        )}
      </div>
      {importing && <PhotoImportDialog finish={current} onClose={() => setImporting(false)} />}
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
