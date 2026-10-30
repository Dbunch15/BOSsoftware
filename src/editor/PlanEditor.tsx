/**
 * 2D plan editor (SVG). Renders exclusively from the derived Model; edits go to the doc store.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import type { Model } from '../model/buildModel';
import { sampleDepth } from '../model/floorField';
import { type Vec2, bounds, centroid, dist } from '../model/geometry';
import type { Units, Zone } from '../model/schema';
import { extractSpan, frameAt, insertionFor, nearestOnOutline, spanFraction } from '../model/spline';
import { beginGesture, endGesture, getModel, updateDoc, useModel } from '../state/docStore';
import { type Tool, isSculptTool, useUi } from '../state/uiStore';
import { formatLength, formatSlope, gridSpacing } from '../units/format';
import { useElementSize, useSpaceHeld } from '../ui/hooks';
import { OUTLINE_FIT, ZONE_FIT, fitClosedStroke } from './fitStroke';
import { depthColor, heatmapDataUrl } from './heatmap';
import { applyDab } from './sculpt';
import { newBeach, newBench, newDeep, newRockwork, newShelf } from './zoneFactory';
import { RockworkPlan } from './RockworkPlan';

interface View {
  scale: number; // px per meter
  tx: number;
  ty: number;
}

type Drag =
  | { kind: 'pan'; sx: number; sy: number; tx: number; ty: number }
  | { kind: 'outlinePt'; index: number }
  | { kind: 'zonePt'; zoneId: string; index: number }
  | { kind: 'spanEnd'; zoneId: string; end: 'u0' | 'u1' }
  | { kind: 'stroke'; purpose: 'outline' | 'sunShelf' | 'deepZone'; pts: Vec2[] }
  | { kind: 'span'; zoneKind: 'beachEntry' | 'bench'; start: number; last: number; acc: number }
  | { kind: 'sculpt'; last: Vec2 }
  | { kind: 'move'; target: { feature: string } | 'spa'; offset: Vec2 }
  | { kind: 'rockPt'; id: string; index: number }
  | { kind: 'rockMove'; id: string; last: Vec2 };

type Preview = { kind: 'stroke'; pts: Vec2[] } | { kind: 'span'; pts: Vec2[] };

const HANDLE = 6;
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const round = (p: Vec2): Vec2 => ({ x: r3(p.x), y: r3(p.y) });
const wrapDelta = (d: number) => (d > 0.5 ? d - 1 : d < -0.5 ? d + 1 : d);
const pathOf = (pts: readonly Vec2[], closed: boolean) =>
  pts.length ? `M${pts.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`).join('L')}${closed ? 'Z' : ''}` : '';

const CURSOR: Partial<Record<Tool, string>> = {
  pen: 'crosshair',
  shelf: 'crosshair',
  deep: 'crosshair',
  beach: 'crosshair',
  bench: 'crosshair',
  insert: 'copy',
  remove: 'not-allowed',
  pan: 'grab',
  rock: 'crosshair',
  deepen: 'none',
  raise: 'none',
  smooth: 'none',
  flatten: 'none',
};

export function PlanEditor() {
  const model = useModel();
  const { doc, outline } = model;
  const units = doc.units;
  const tool = useUi((s) => s.tool);
  const selection = useUi((s) => s.selection);
  const brush = useUi((s) => s.brush);
  const showHeatmap = useUi((s) => s.showHeatmap);
  const showContours = useUi((s) => s.showContours);
  const fitNonce = useUi((s) => s.fitNonce);
  const focus = useUi((s) => s.focus);
  const [wrapRef, size] = useElementSize<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<View>({ scale: 30, tx: 0, ty: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const modelRef = useRef(model);
  modelRef.current = model;
  const drag = useRef<Drag | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [brushAt, setBrushAt] = useState<Vec2 | null>(null);
  const space = useSpaceHeld();
  const rockPreset = useUi((s) => s.rockPreset);
  const [rockDraft, setRockDraft] = useState<Vec2[] | null>(null);
  const [rockHover, setRockHover] = useState<Vec2 | null>(null);
  useEffect(() => {
    if (tool !== 'rock') setRockDraft(null);
  }, [tool]);
  const finishRock = useCallback(() => {
    setRockDraft((draft) => {
      if (!draft) return null;
      const pts = draft.filter((p, i) => i === 0 || dist(p, draft[i - 1]) > 0.15);
      if (pts.length >= 2) {
        const rw = newRockwork(pts, useUi.getState().rockPreset);
        updateDoc((d) => {
          d.rockwork.push(rw);
        });
        useUi.getState().select({ kind: 'rockwork', id: rw.id });
      }
      return null;
    });
  }, []);
  useEffect(() => {
    if (!rockDraft) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        finishRock();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        e.stopImmediatePropagation();
        setRockDraft((d) => (d && d.length > 1 ? d.slice(0, -1) : null));
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [rockDraft, finishRock]);
  const [panning, setPanning] = useState(false);

  // ---- view fitting -------------------------------------------------------------------
  const fit = useCallback(() => {
    if (!size.w || !size.h) return;
    const m = modelRef.current;
    const pts = [...m.outline.pts, ...Object.values(m.rockwork).flatMap((l) => l.rocks.flatMap((r) => r.plan))];
    for (const f of m.doc.features) pts.push({ x: f.position.x - f.size.x / 2, y: f.position.y - f.size.y / 2 }, { x: f.position.x + f.size.x / 2, y: f.position.y + f.size.y / 2 });
    if (m.doc.spa) {
      const { position: c, diameter: d } = m.doc.spa;
      pts.push({ x: c.x - d / 2, y: c.y - d / 2 }, { x: c.x + d / 2, y: c.y + d / 2 });
    }
    const b = bounds(pts);
    const pad = 2.2;
    const w = b.maxX - b.minX + pad * 2;
    const h = b.maxY - b.minY + pad * 2;
    const scale = Math.min(size.w / w, (size.h - 30) / h);
    setView({
      scale,
      tx: size.w / 2 - ((b.minX + b.maxX) / 2) * scale,
      ty: (size.h + 30) / 2 - ((b.minY + b.maxY) / 2) * scale,
    });
  }, [size.w, size.h]);

  useEffect(() => {
    if (size.w) fit();
  }, [fitNonce, fit, size.w]);

  useEffect(() => {
    if (!focus.at || !size.w) return;
    const at = focus.at;
    setView((v) => ({ ...v, tx: size.w / 2 - at.x * v.scale, ty: size.h / 2 - at.y * v.scale }));
  }, [focus, size.w, size.h]);

  // Non-passive wheel listener so pinch/scroll zoom doesn't scroll or zoom the page.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      if (e.shiftKey) {
        setView((v) => ({ ...v, tx: v.tx - e.deltaY, ty: v.ty - e.deltaX }));
        return;
      }
      const k = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
      setView((v) => {
        const scale = Math.min(400, Math.max(3, v.scale * k));
        const f = scale / v.scale;
        return { scale, tx: mx - (mx - v.tx) * f, ty: my - (my - v.ty) * f };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const toWorld = useCallback((clientX: number, clientY: number): Vec2 => {
    const rect = svgRef.current!.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (clientX - rect.left - v.tx) / v.scale, y: (clientY - rect.top - v.ty) / v.scale };
  }, []);

  // ---- editing helpers ---------------------------------------------------------------
  const sculptDab = useCallback(
    (p: Vec2, pressure: number) => {
      if (!isSculptTool(tool)) return;
      const m = getModel();
      updateDoc((d) => {
        applyDab(d.sculpt.cells, d.sculpt.cellSize, m, {
          mode: tool,
          center: p,
          radius: brush.radius,
          strength: brush.strength,
          pressure,
          flattenDepth: brush.flattenDepth,
        });
      });
    },
    [tool, brush],
  );

  const pressureOf = (e: PointerEvent | RPointerEvent) => (e.pointerType === 'pen' && brush.usePressure ? Math.max(0.05, e.pressure) : 1);

  const startPan = (e: RPointerEvent) => {
    const v = viewRef.current;
    drag.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, tx: v.tx, ty: v.ty };
    setPanning(true);
  };

  const capture = (e: RPointerEvent) => {
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  // ---- background pointer handling -----------------------------------------------------
  const onPointerDown = (e: RPointerEvent<SVGSVGElement>) => {
    capture(e);
    if (e.button === 1 || e.button === 2 || space || tool === 'pan') {
      startPan(e);
      return;
    }
    if (e.button !== 0) return;
    const p = toWorld(e.clientX, e.clientY);
    const tol = 14 / viewRef.current.scale;
    switch (tool) {
      case 'pen':
        drag.current = { kind: 'stroke', purpose: 'outline', pts: [p] };
        setPreview({ kind: 'stroke', pts: [p] });
        return;
      case 'shelf':
      case 'deep':
        drag.current = { kind: 'stroke', purpose: tool === 'shelf' ? 'sunShelf' : 'deepZone', pts: [p] };
        setPreview({ kind: 'stroke', pts: [p] });
        return;
      case 'insert': {
        const ins = insertionFor(doc.outline.points, doc.outline.alpha, p);
        if (ins.d > tol) return;
        beginGesture();
        updateDoc((d) => {
          d.outline.points.splice(ins.index, 0, round(ins.point));
        });
        useUi.getState().select({ kind: 'point', index: ins.index });
        drag.current = { kind: 'outlinePt', index: ins.index };
        return;
      }
      case 'beach':
      case 'bench': {
        const near = nearestOnOutline(outline, p);
        if (near.d > tol * 1.5) return;
        drag.current = { kind: 'span', zoneKind: tool === 'beach' ? 'beachEntry' : 'bench', start: near.u, last: near.u, acc: 0 };
        setPreview({ kind: 'span', pts: [near.point] });
        return;
      }
      case 'deepen':
      case 'raise':
      case 'smooth':
      case 'flatten':
        if (e.altKey && tool === 'flatten') {
          useUi.getState().setBrush({ flattenDepth: Math.max(0, r3(sampleDepth(model.field, p))) });
          return;
        }
        beginGesture();
        sculptDab(p, pressureOf(e));
        drag.current = { kind: 'sculpt', last: p };
        return;
      case 'rock':
        setRockDraft((d) => [...(d ?? []), round(p)]);
        return;
      case 'select':
      case 'remove':
      default:
        useUi.getState().select(null);
        startPan(e);
    }
  };

  const cursorRaf = useRef(0);
  const onPointerMove = (e: RPointerEvent<SVGSVGElement>) => {
    const p = toWorld(e.clientX, e.clientY);
    if (!cursorRaf.current) {
      cursorRaf.current = requestAnimationFrame(() => {
        cursorRaf.current = 0;
        useUi.getState().set({ cursor: p });
      });
    }
    if (isSculptTool(tool)) setBrushAt(p);
    if (rockDraft) setRockHover(p);
    const d = drag.current;
    if (!d) return;
    switch (d.kind) {
      case 'pan':
        setView((v) => ({ ...v, tx: d.tx + e.clientX - d.sx, ty: d.ty + e.clientY - d.sy }));
        return;
      case 'outlinePt':
        updateDoc((doc) => {
          doc.outline.points[d.index] = round(p);
        });
        return;
      case 'zonePt':
        updateDoc((doc) => {
          const z = doc.zones.find((z) => z.id === d.zoneId);
          if (z && 'polygon' in z) z.polygon[d.index] = round(p);
        });
        return;
      case 'spanEnd': {
        const u = r3(nearestOnOutline(outline, p).u);
        updateDoc((doc) => {
          const z = doc.zones.find((z) => z.id === d.zoneId);
          if (z && 'span' in z) z.span[d.end] = u;
        });
        return;
      }
      case 'move':
        updateDoc((doc) => {
          const pos = round({ x: p.x - d.offset.x, y: p.y - d.offset.y });
          if (d.target === 'spa') {
            if (doc.spa) doc.spa.position = pos;
          } else {
            const target = d.target;
            const f = doc.features.find((f) => f.id === target.feature);
            if (f) {
              const dx = pos.x - f.position.x;
              const dy = pos.y - f.position.y;
              f.position = pos;
              if (f.polygon) f.polygon = f.polygon.map((q) => round({ x: q.x + dx, y: q.y + dy }));
            }
          }
        });
        return;
      case 'stroke': {
        const events = 'getCoalescedEvents' in e.nativeEvent ? e.nativeEvent.getCoalescedEvents() : [];
        const pts = events.length ? events.map((ev) => toWorld(ev.clientX, ev.clientY)) : [p];
        for (const q of pts) if (dist(q, d.pts[d.pts.length - 1]) > 0.04) d.pts.push(q);
        setPreview({ kind: 'stroke', pts: d.pts.slice() });
        return;
      }
      case 'span': {
        const u = nearestOnOutline(outline, p).u;
        d.acc += wrapDelta(u - d.last);
        d.last = u;
        const [u0, u1] = d.acc >= 0 ? [d.start, u] : [u, d.start];
        setPreview({ kind: 'span', pts: Math.abs(d.acc) > 0.002 ? extractSpan(outline, u0, u1) : [] });
        return;
      }
      case 'rockPt':
        updateDoc((doc) => {
          const rw = doc.rockwork.find((r) => r.id === d.id);
          if (rw) rw.path[d.index] = round(p);
        });
        return;
      case 'rockMove': {
        const dx = p.x - d.last.x;
        const dy = p.y - d.last.y;
        d.last = p;
        updateDoc((doc) => {
          const rw = doc.rockwork.find((r) => r.id === d.id);
          if (rw) rw.path = rw.path.map((q) => round({ x: q.x + dx, y: q.y + dy }));
        });
        return;
      }
      case 'sculpt': {
        const spacing = Math.max(0.05, brush.radius * 0.22);
        let last = d.last;
        let guard = 0;
        while (dist(last, p) >= spacing && guard++ < 50) {
          const t = spacing / dist(last, p);
          last = { x: last.x + (p.x - last.x) * t, y: last.y + (p.y - last.y) * t };
          sculptDab(last, pressureOf(e));
        }
        d.last = last;
        return;
      }
    }
  };

  const onPointerUp = (e: RPointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    drag.current = null;
    setPanning(false);
    svgRef.current?.releasePointerCapture?.(e.pointerId);
    if (!d) return;
    switch (d.kind) {
      case 'stroke': {
        setPreview(null);
        const ctrl = fitClosedStroke(d.pts, d.purpose === 'outline' ? OUTLINE_FIT : ZONE_FIT);
        if (!ctrl) return;
        if (d.purpose === 'outline') {
          updateDoc((doc) => {
            doc.outline.points = ctrl;
          });
          useUi.getState().select(null);
        } else {
          const z = d.purpose === 'sunShelf' ? newShelf(ctrl) : newDeep(ctrl);
          updateDoc((doc) => {
            doc.zones.push(z);
          });
          useUi.getState().select({ kind: 'zone', id: z.id });
        }
        return;
      }
      case 'span': {
        setPreview(null);
        if (Math.abs(d.acc) < 0.01) return;
        const [u0, u1] = d.acc >= 0 ? [d.start, d.last] : [d.last, d.start];
        const z = d.zoneKind === 'beachEntry' ? newBeach(r3(u0), r3(u1)) : newBench(r3(u0), r3(u1));
        updateDoc((doc) => {
          doc.zones.push(z);
        });
        useUi.getState().select({ kind: 'zone', id: z.id });
        return;
      }
      case 'pan':
        return;
      default:
        endGesture();
    }
  };

  // ---- handle interactions ------------------------------------------------------------
  const onPointDown = (e: RPointerEvent, index: number) => {
    if (e.button !== 0 || space) return;
    e.stopPropagation();
    if (tool === 'remove') {
      if (doc.outline.points.length > 4)
        updateDoc((d) => {
          d.outline.points.splice(index, 1);
        });
      return;
    }
    if (tool !== 'select' && tool !== 'insert') return;
    capture(e);
    beginGesture();
    useUi.getState().select({ kind: 'point', index });
    drag.current = { kind: 'outlinePt', index };
  };

  const onZonePointDown = (e: RPointerEvent, zoneId: string, index: number) => {
    if (e.button !== 0 || space) return;
    e.stopPropagation();
    const z = doc.zones.find((z) => z.id === zoneId);
    if (tool === 'remove' && z && 'polygon' in z) {
      if (z.polygon.length > 3)
        updateDoc((d) => {
          const dz = d.zones.find((q) => q.id === zoneId);
          if (dz && 'polygon' in dz) dz.polygon.splice(index, 1);
        });
      return;
    }
    capture(e);
    beginGesture();
    drag.current = { kind: 'zonePt', zoneId, index };
  };

  const onSpanEndDown = (e: RPointerEvent, zoneId: string, end: 'u0' | 'u1') => {
    if (e.button !== 0 || space) return;
    e.stopPropagation();
    capture(e);
    beginGesture();
    drag.current = { kind: 'spanEnd', zoneId, end };
  };

  const onZoneDown = (e: RPointerEvent, id: string) => {
    if (tool !== 'select' || e.button !== 0 || space) return;
    e.stopPropagation();
    useUi.getState().select({ kind: 'zone', id });
  };

  const onMoveDown = (e: RPointerEvent, target: { feature: string } | 'spa', at: Vec2) => {
    if (tool !== 'select' || e.button !== 0 || space) return;
    e.stopPropagation();
    capture(e);
    const p = toWorld(e.clientX, e.clientY);
    useUi.getState().select(target === 'spa' ? { kind: 'spa' } : { kind: 'feature', id: target.feature });
    beginGesture();
    drag.current = { kind: 'move', target, offset: { x: p.x - at.x, y: p.y - at.y } };
  };

  const onOutlineDoubleClick = (e: React.MouseEvent) => {
    if (tool !== 'select') return;
    const p = toWorld(e.clientX, e.clientY);
    const ins = insertionFor(doc.outline.points, doc.outline.alpha, p);
    if (ins.d > 14 / viewRef.current.scale) return;
    updateDoc((d) => {
      d.outline.points.splice(ins.index, 0, round(ins.point));
    });
    useUi.getState().select({ kind: 'point', index: ins.index });
  };

  // ---- derived drawing data -----------------------------------------------------------
  const heatmap = useMemo(() => heatmapDataUrl(model), [model]);
  const contourSig = useMemo(() => {
    let sx = 0;
    let n = 0;
    for (const c of model.contours) for (const p of c.points) {
      sx += p.x + p.y * 0.37;
      n++;
    }
    return `${model.contours.length}:${n}:${sx.toFixed(3)}`;
  }, [model.contours]);

  const s = view.scale;
  const px = (n: number) => n / s;
  const selZone = selection?.kind === 'zone' ? doc.zones.find((z) => z.id === selection.id) : undefined;
  const outlinePath = useMemo(() => pathOf(outline.pts, true), [outline]);
  const flagged = useMemo(() => flaggedRuns(model), [model]);

  return (
    <div ref={wrapRef} style={{ position: 'absolute', inset: 0 }}>
      <svg
        ref={svgRef}
        className="plan-svg"
        data-testid="plan-svg"
        data-contour-sig={contourSig}
        data-outline-points={doc.outline.points.length}
        style={{ cursor: space || panning ? (panning ? 'grabbing' : 'grab') : (CURSOR[tool] ?? 'default') }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => setBrushAt(null)}
        onDoubleClick={() => tool === 'rock' && finishRock()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <Grid view={view} w={size.w} h={size.h} units={units} />
        <g transform={`translate(${view.tx},${view.ty}) scale(${s})`}>
          {/* deck surround */}
          <rect
            x={model.field.x0}
            y={model.field.y0}
            width={(model.field.nx - 1) * model.field.cell}
            height={(model.field.ny - 1) * model.field.cell}
            fill="rgba(230,219,193,0.035)"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
            rx={0.3}
          />
          {showHeatmap ? (
            <image
              href={heatmap}
              x={model.field.x0 - model.field.cell / 2}
              y={model.field.y0 - model.field.cell / 2}
              width={model.field.nx * model.field.cell}
              height={model.field.ny * model.field.cell}
              preserveAspectRatio="none"
              style={{ imageRendering: 'auto' }}
              pointerEvents="none"
            />
          ) : (
            <path d={outlinePath} fill="rgba(95,214,205,0.08)" pointerEvents="none" />
          )}
          {showContours && <Contours model={model} scale={s} units={units} />}
          <Placeholders model={model} scale={s} onMoveDown={onMoveDown} selection={selection} />
          {doc.zones.map((z) => (
            <ZoneShape key={z.id} zone={z} model={model} scale={s} selected={selZone?.id === z.id} onDown={onZoneDown} units={units} />
          ))}
          <path
            d={outlinePath}
            fill="none"
            stroke="#e9dfc6"
            strokeWidth={2.4}
            vectorEffect="non-scaling-stroke"
            data-testid="plan-outline"
            onDoubleClick={onOutlineDoubleClick}
            style={{ pointerEvents: 'stroke' }}
          />
          {flagged.map((f, i) => (
            <path
              key={i}
              d={pathOf(f.pts, false)}
              fill="none"
              stroke={f.level === 2 ? 'var(--crit)' : 'var(--warn)'}
              strokeWidth={5}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          ))}
          <Dimensions model={model} scale={s} units={units} />

          <RockworkPlan
            model={model}
            scale={s}
            units={units}
            selectedId={selection?.kind === 'rockwork' ? selection.id : null}
            onRockDown={(e, id) => {
              if (tool !== 'select' || e.button !== 0 || space) return;
              e.stopPropagation();
              capture(e);
              useUi.getState().select({ kind: 'rockwork', id });
              beginGesture();
              drag.current = { kind: 'rockMove', id, last: toWorld(e.clientX, e.clientY) };
            }}
            onPointDown={(e, id, index) => {
              if (e.button !== 0 || space) return;
              e.stopPropagation();
              if (tool === 'remove') {
                updateDoc((d) => {
                  const rw = d.rockwork.find((r) => r.id === id);
                  if (rw && rw.path.length > 2) rw.path.splice(index, 1);
                });
                return;
              }
              capture(e);
              beginGesture();
              drag.current = { kind: 'rockPt', id, index };
            }}
          />
          {/* selected zone handles */}
          {selZone && 'polygon' in selZone &&
            selZone.polygon.map((p, i) => (
              <rect
                key={i}
                data-testid="zone-pt"
                x={p.x - px(HANDLE - 1)}
                y={p.y - px(HANDLE - 1)}
                width={px((HANDLE - 1) * 2)}
                height={px((HANDLE - 1) * 2)}
                fill="#0f1214"
                stroke="var(--accent)"
                strokeWidth={1.6}
                vectorEffect="non-scaling-stroke"
                style={{ cursor: tool === 'remove' ? 'not-allowed' : 'move' }}
                onPointerDown={(e) => onZonePointDown(e, selZone.id, i)}
              />
            ))}
          {selZone && 'span' in selZone &&
            (['u0', 'u1'] as const).map((end) => {
              const p = frameAt(outline, selZone.span[end]).p;
              return (
                <circle
                  key={end}
                  data-testid="span-end"
                  cx={p.x}
                  cy={p.y}
                  r={px(HANDLE + 1)}
                  fill="var(--accent)"
                  stroke="#0f1214"
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                  style={{ cursor: 'ew-resize' }}
                  onPointerDown={(e) => onSpanEndDown(e, selZone.id, end)}
                />
              );
            })}

          {/* outline control points */}
          {(tool === 'select' || tool === 'insert' || tool === 'remove' || tool === 'pen') &&
            doc.outline.points.map((p, i) => {
              const sel = selection?.kind === 'point' && selection.index === i;
              return (
                <circle
                  key={i}
                  data-testid="ctrl-pt"
                  data-index={i}
                  cx={p.x}
                  cy={p.y}
                  r={px(sel ? HANDLE + 1.5 : HANDLE)}
                  fill={sel ? 'var(--accent)' : '#0f1214'}
                  stroke={sel ? '#0f1214' : '#f3ead4'}
                  strokeWidth={sel ? 2 : 1.6}
                  vectorEffect="non-scaling-stroke"
                  style={{ cursor: tool === 'remove' ? 'not-allowed' : 'move' }}
                  onPointerDown={(e) => onPointDown(e, i)}
                />
              );
            })}

          {rockDraft && (
            <g pointerEvents="none" data-testid="rock-draft">
              <path
                d={pathOf(rockHover ? [...rockDraft, rockHover] : rockDraft, false)}
                fill="none"
                stroke="var(--accent)"
                strokeWidth={2}
                strokeDasharray="6 4"
                vectorEffect="non-scaling-stroke"
              />
              {rockDraft.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={px(4)} fill="var(--accent)" />
              ))}
              <text x={(rockHover ?? rockDraft[rockDraft.length - 1]).x} y={(rockHover ?? rockDraft[rockDraft.length - 1]).y - px(12)} fontSize={px(11)} fill="var(--accent)" strokeWidth={px(3)} textAnchor="middle">
                {rockPreset === 'wall' ? 'Rock wall' : rockPreset === 'waterfall' ? 'Waterfall' : 'Grotto'} · double-click or Enter to finish
              </text>
            </g>
          )}
          <ViolationMarkers model={model} scale={s} />

          {preview?.kind === 'stroke' && (
            <path
              d={pathOf(preview.pts, false)}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={2}
              strokeDasharray="4 3"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          )}
          {preview?.kind === 'span' && (
            <path
              d={pathOf(preview.pts, false)}
              fill="none"
              stroke="var(--accent)"
              strokeOpacity={0.8}
              strokeWidth={10}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          )}
          {brushAt && isSculptTool(tool) && (
            <g pointerEvents="none">
              <circle cx={brushAt.x} cy={brushAt.y} r={brush.radius} fill="none" stroke="#fff" strokeOpacity={0.85} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
              <circle cx={brushAt.x} cy={brushAt.y} r={brush.radius * 0.5} fill="none" stroke="#fff" strokeOpacity={0.35} strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
              <circle cx={brushAt.x} cy={brushAt.y} r={px(1.5)} fill="#fff" />
            </g>
          )}
        </g>
      </svg>
      <Legend />
    </div>
  );
}

// ---- layers ---------------------------------------------------------------------------

const Grid = memo(function Grid({ view, w, h, units }: { view: View; w: number; h: number; units: Units }) {
  const [minor, major] = gridSpacing(units);
  if (!w || !h) return null;
  const x0 = -view.tx / view.scale;
  const y0 = -view.ty / view.scale;
  const x1 = (w - view.tx) / view.scale;
  const y1 = (h - view.ty) / view.scale;
  const lines = (step: number) => {
    if (step * view.scale < 6) return '';
    let d = '';
    for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) {
      const sx = x * view.scale + view.tx;
      d += `M${sx.toFixed(1)},0V${h}`;
    }
    for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) {
      const sy = y * view.scale + view.ty;
      d += `M0,${sy.toFixed(1)}H${w}`;
    }
    return d;
  };
  return (
    <g pointerEvents="none">
      <path d={lines(minor)} stroke="rgba(255,255,255,0.035)" strokeWidth={1} />
      <path d={lines(major)} stroke="rgba(255,255,255,0.075)" strokeWidth={1} />
    </g>
  );
});

function Contours({ model, scale, units }: { model: Model; scale: number; units: Units }) {
  const fs = 10.5 / scale;
  return (
    <g pointerEvents="none" data-testid="plan-contours">
      {model.contours.map((c, i) => {
        let top = c.points[0];
        for (const p of c.points) if (p.y < top.y) top = p;
        return (
          <g key={i}>
            <path
              d={pathOf(c.points, c.closed)}
              fill="none"
              stroke="rgba(255,255,255,0.55)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            {c.points.length > 30 && (
              <text x={top.x} y={top.y} fontSize={fs} fill="rgba(255,255,255,0.85)" strokeWidth={3 / scale} textAnchor="middle" dy={fs * 0.35}>
                {formatLength(c.level, units, { inchStep: 1, decimals: 2 })}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

const ZONE_COLOR: Record<Zone['kind'], string> = {
  beachEntry: '#f2d797',
  bench: '#c5a3ff',
  sunShelf: '#ffcf70',
  deepZone: '#7fb2ff',
};

function ZoneShape({
  zone,
  model,
  scale,
  selected,
  onDown,
  units,
}: {
  zone: Zone;
  model: Model;
  scale: number;
  selected: boolean;
  onDown: (e: RPointerEvent, id: string) => void;
  units: Units;
}) {
  const pts = model.zoneShapes[zone.id] ?? [];
  const color = selected ? 'var(--accent)' : ZONE_COLOR[zone.kind];
  const fs = 10 / scale;
  const label = zoneLabel(zone, model, units);
  if (zone.kind === 'beachEntry' || zone.kind === 'bench') {
    if (pts.length < 2) return null;
    const mid = frameAt(model.outline, zone.span.u0 + spanFraction(zone.span.u0, zone.span.u1) / 2);
    const reach = zone.kind === 'beachEntry' ? model.field.beachRun[model.doc.zones.filter((z) => z.kind === 'beachEntry').indexOf(zone)] ?? zone.runLength : zone.width;
    const tip = { x: mid.p.x + mid.inward.x * reach, y: mid.p.y + mid.inward.y * reach };
    const labAt = zone.kind === 'beachEntry' ? reach * 0.45 : reach + 0.5;
    const lab = { x: mid.p.x + mid.inward.x * labAt, y: mid.p.y + mid.inward.y * labAt };
    return (
      <g data-testid={`zone-${zone.kind}`}>
        <path
          d={pathOf(pts, false)}
          fill="none"
          stroke={color}
          strokeOpacity={selected ? 0.9 : 0.55}
          strokeWidth={zone.kind === 'beachEntry' ? 12 : 8}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
          onPointerDown={(e) => onDown(e, zone.id)}
        />
        {zone.kind === 'beachEntry' && (
          <g pointerEvents="none" opacity={0.8}>
            <line x1={mid.p.x} y1={mid.p.y} x2={tip.x} y2={tip.y} stroke={color} strokeWidth={1.2} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
            <circle cx={tip.x} cy={tip.y} r={3 / scale} fill={color} />
          </g>
        )}
        <text x={lab.x} y={lab.y} fontSize={fs} fill={color} strokeWidth={3 / scale} textAnchor="middle" fontWeight={650} pointerEvents="none">
          {label}
        </text>
      </g>
    );
  }
  const c = centroid(pts);
  return (
    <g data-testid={`zone-${zone.kind}`}>
      <path
        d={pathOf(pts, true)}
        fill={zone.kind === 'sunShelf' ? 'rgba(255,207,112,0.16)' : 'rgba(127,178,255,0.06)'}
        stroke={color}
        strokeWidth={selected ? 2 : 1.4}
        strokeDasharray={zone.kind === 'deepZone' ? '6 4' : '3 3'}
        vectorEffect="non-scaling-stroke"
        style={{ cursor: 'pointer' }}
        onPointerDown={(e) => onDown(e, zone.id)}
      />
      <text x={c.x} y={c.y} fontSize={fs} fill={color} strokeWidth={3 / scale} textAnchor="middle" fontWeight={650} pointerEvents="none">
        {label}
      </text>
    </g>
  );
}

function zoneLabel(z: Zone, model: Model, units: Units): string {
  switch (z.kind) {
    case 'beachEntry': {
      const idx = model.doc.zones.filter((q) => q.kind === 'beachEntry').indexOf(z);
      const run = model.field.beachRun[idx] ?? z.runLength;
      return `BEACH ${formatSlope(z.endDepth / run).split(' ')[0]} · ${formatLength(run, units)}`;
    }
    case 'bench':
      return `BENCH ${formatLength(z.seatDepth, units)}`;
    case 'sunShelf':
      return `SUN SHELF ${formatLength(z.depth, units)}`;
    case 'deepZone':
      return `DEEP ${formatLength(z.depth, units)}`;
  }
}

function Placeholders({
  model,
  scale,
  onMoveDown,
  selection,
}: {
  model: Model;
  scale: number;
  onMoveDown: (e: RPointerEvent, t: { feature: string } | 'spa', at: Vec2) => void;
  selection: ReturnType<typeof useUi.getState>['selection'];
}) {
  const { spa, features } = model.doc;
  const fs = 9.5 / scale;
  return (
    <g>
      {spa && (
        <g data-testid="plan-spa" style={{ cursor: 'move' }} onPointerDown={(e) => onMoveDown(e, 'spa', spa.position)}>
          <circle
            cx={spa.position.x}
            cy={spa.position.y}
            r={spa.diameter / 2}
            fill="rgba(95,214,205,0.12)"
            stroke={selection?.kind === 'spa' ? 'var(--accent)' : 'rgba(95,214,205,0.8)'}
            strokeDasharray="5 4"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
          <text x={spa.position.x} y={spa.position.y} fontSize={fs} fill="#bdeee9" textAnchor="middle" strokeWidth={3 / scale} dy={fs * 0.35}>
            SPA · placeholder
          </text>
        </g>
      )}
      {features.map((f) => {
        const sel = selection?.kind === 'feature' && selection.id === f.id;
        const stroke = sel ? 'var(--accent)' : 'rgba(255,255,255,0.55)';
        const shape = f.polygon ? (
          <path d={pathOf(f.polygon, true)} fill={f.kind === 'koiPond' ? 'rgba(60,120,110,0.25)' : 'rgba(255,255,255,0.05)'} stroke={stroke} strokeDasharray="5 4" strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
        ) : (
          <rect
            x={f.position.x - f.size.x / 2}
            y={f.position.y - f.size.y / 2}
            width={f.size.x}
            height={f.size.y}
            rx={Math.min(f.size.x, f.size.y) * 0.3}
            transform={`rotate(${f.rotation} ${f.position.x} ${f.position.y})`}
            fill="rgba(160,150,140,0.16)"
            stroke={stroke}
            strokeDasharray="5 4"
            strokeWidth={1.4}
            vectorEffect="non-scaling-stroke"
          />
        );
        return (
          <g key={f.id} data-testid={`plan-feature-${f.kind}`} style={{ cursor: 'move' }} onPointerDown={(e) => onMoveDown(e, { feature: f.id }, f.position)}>
            {shape}
            <text x={f.position.x} y={f.position.y} fontSize={fs} fill="#ddd" textAnchor="middle" strokeWidth={3 / scale} dy={fs * 0.35}>
              {f.name.toUpperCase()} · placeholder
            </text>
          </g>
        );
      })}
    </g>
  );
}

function Dimensions({ model, scale, units }: { model: Model; scale: number; units: Units }) {
  const b = bounds(model.outline.pts);
  const off = 0.9;
  const tick = 6 / scale;
  const fs = 10.5 / scale;
  const yTop = b.minY - off;
  const xLeft = b.minX - off;
  const stroke = { stroke: 'rgba(230,219,193,0.7)', strokeWidth: 1, vectorEffect: 'non-scaling-stroke' as const };
  return (
    <g pointerEvents="none" data-testid="plan-dimensions">
      <line x1={b.minX} y1={yTop} x2={b.maxX} y2={yTop} {...stroke} />
      <line x1={b.minX} y1={yTop - tick} x2={b.minX} y2={yTop + tick} {...stroke} />
      <line x1={b.maxX} y1={yTop - tick} x2={b.maxX} y2={yTop + tick} {...stroke} />
      <text x={(b.minX + b.maxX) / 2} y={yTop - 5 / scale} fontSize={fs} fill="#e6dbc1" textAnchor="middle" strokeWidth={3 / scale}>
        {formatLength(b.maxX - b.minX, units)}
      </text>
      <line x1={xLeft} y1={b.minY} x2={xLeft} y2={b.maxY} {...stroke} />
      <line x1={xLeft - tick} y1={b.minY} x2={xLeft + tick} y2={b.minY} {...stroke} />
      <line x1={xLeft - tick} y1={b.maxY} x2={xLeft + tick} y2={b.maxY} {...stroke} />
      <text
        x={xLeft - 5 / scale}
        y={(b.minY + b.maxY) / 2}
        fontSize={fs}
        fill="#e6dbc1"
        textAnchor="middle"
        strokeWidth={3 / scale}
        transform={`rotate(-90 ${xLeft - 5 / scale} ${(b.minY + b.maxY) / 2})`}
      >
        {formatLength(b.maxY - b.minY, units)}
      </text>
    </g>
  );
}

function ViolationMarkers({ model, scale }: { model: Model; scale: number }) {
  const selection = useUi((s) => s.selection);
  return (
    <g>
      {model.violations.map((v) => {
        const sel = selection?.kind === 'violation' && selection.id === v.id;
        return (
          <g
            key={v.id}
            data-testid="plan-warning"
            data-rule={v.ruleId}
            data-severity={v.severity}
            transform={`translate(${v.at.x},${v.at.y}) scale(${1 / scale})`}
            style={{ cursor: 'pointer' }}
            onPointerDown={(e) => {
              e.stopPropagation();
              useUi.getState().select({ kind: 'violation', id: v.id });
            }}
          >
            <title>{v.title}</title>
            {sel && <circle r={16} fill="none" stroke="#fff" strokeOpacity={0.7} strokeWidth={1.5} />}
            <circle r={10} fill={v.severity === 'critical' ? 'var(--crit)' : 'var(--warn)'} stroke="#0f1214" strokeWidth={2} />
            <text y={4} fontSize={13} fontWeight={800} textAnchor="middle" fill="#14100a" stroke="none">
              !
            </text>
          </g>
        );
      })}
    </g>
  );
}

function Legend() {
  const stops = [0, 0.45, 0.9, 1.5, 2.1, 2.6];
  const grad = `linear-gradient(90deg, ${stops.map((d, i) => `rgb(${depthColor(d).map(Math.round).join(',')}) ${(i / (stops.length - 1)) * 100}%`).join(',')})`;
  const units = useModel().doc.units;
  return (
    <div className="legend">
      <span>{formatLength(0, units)}</span>
      <div className="ramp" style={{ background: grad }} />
      <span>{formatLength(2.6, units)}</span>
      <span style={{ marginLeft: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <i style={{ width: 9, height: 9, background: 'var(--warn)', borderRadius: 2 }} /> review
        <i style={{ width: 9, height: 9, background: 'var(--crit)', borderRadius: 2, marginLeft: 4 }} /> critical
      </span>
    </div>
  );
}

function flaggedRuns(model: Model): Array<{ level: number; pts: Vec2[] }> {
  const flags = model.outlineFlags;
  const n = flags.length;
  const out: Array<{ level: number; pts: Vec2[] }> = [];
  let start = 0;
  while (start < n && flags[start]) start++;
  if (start === n) return flags[0] ? [{ level: flags[0], pts: model.outline.pts.concat([model.outline.pts[0]]) }] : [];
  for (let i = 0; i < n; i++) {
    const k = (start + i) % n;
    if (!flags[k]) continue;
    const level = flags[k];
    const pts: Vec2[] = [];
    while (i < n && flags[(start + i) % n]) {
      pts.push(model.outline.pts[(start + i) % n]);
      i++;
    }
    out.push({ level, pts });
  }
  return out;
}
