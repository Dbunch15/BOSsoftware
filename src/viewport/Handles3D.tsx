/**
 * Direct editing in 3D: grab outline control points, the selected zone's shape points and the
 * selected rockwork's line points, and drag them across the ground plane. Rockwork itself can be
 * picked and slid around. The plan and 3D share the same undoable edits.
 */
import { Html } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { useState } from 'react';
import { type Model, rockEnv } from '../model/buildModel';
import { updateDoc } from '../state/docStore';
import { useHandleDrag } from './useHandleDrag';
import type { Vec2 } from '../model/geometry';

const ACCENT = '#5fd6cd';
const SAND = '#f3ead4';
import { useUi } from '../state/uiStore';
import { formatLength } from '../units/format';

function Handle({
  at,
  y,
  selected,
  square,
  onDown,
  testId,
}: {
  at: Vec2;
  y: number;
  selected?: boolean;
  square?: boolean;
  onDown: (e: ThreeEvent<PointerEvent>) => void;
  testId?: string;
}) {
  const [hover, setHover] = useState(false);
  const s = hover || selected ? 1.5 : 1;
  return (
    <mesh
      position={[at.x, y, at.y]}
      scale={s}
      renderOrder={20}
      userData={{ testId }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
        document.body.style.cursor = 'grab';
      }}
      onPointerOut={() => {
        setHover(false);
        document.body.style.cursor = '';
      }}
      onPointerDown={onDown}
    >
      {square ? <boxGeometry args={[0.2, 0.2, 0.2]} /> : <sphereGeometry args={[0.12, 20, 14]} />}
      <meshBasicMaterial color={hover || selected ? ACCENT : SAND} depthTest={false} transparent opacity={0.95} toneMapped={false} />
    </mesh>
  );
}

export function Handles3D({ model }: { model: Model }) {
  const tool = useUi((s) => s.tool);
  const selection = useUi((s) => s.selection);
  const { start, dragging } = useHandleDrag();
  const units = model.doc.units;
  const editing = tool === 'select' || tool === 'insert' || tool === 'remove';
  if (!editing) return null;
  const env = rockEnv(model.field);
  const selZone = selection?.kind === 'zone' ? model.doc.zones.find((z) => z.id === selection.id) : undefined;
  const selRock = selection?.kind === 'rockwork' ? model.doc.rockwork.find((r) => r.id === selection.id) : undefined;
  return (
    <group>
      {model.doc.outline.points.map((p, i) => (
        <Handle
          key={`o${i}`}
          at={p}
          y={0.06}
          testId={`h3-outline-${i}`}
          selected={selection?.kind === 'point' && selection.index === i}
          onDown={(e) => {
            if (tool === 'remove') {
              e.stopPropagation();
              if (model.doc.outline.points.length > 4) updateDoc((d) => void d.outline.points.splice(i, 1));
              return;
            }
            useUi.getState().select({ kind: 'point', index: i });
            start(e, { kind: 'outline', index: i }, 0);
          }}
        />
      ))}
      {selZone &&
        'polygon' in selZone &&
        selZone.polygon.map((p, i) => (
          <Handle key={`z${i}`} at={p} y={0.06} square selected onDown={(e) => start(e, { kind: 'zone', id: selZone.id, index: i }, 0)} />
        ))}
      {selRock &&
        selRock.path.map((p, i) => {
          const y = env.groundAt(p) + 0.08;
          return <Handle key={`r${i}`} at={p} y={y} selected onDown={(e) => start(e, { kind: 'rockPt', id: selRock.id, index: i }, y - 0.08)} />;
        })}
      {dragging && (
        <Html position={[dragging.at.x, 0.5, dragging.at.y]} center zIndexRange={[40, 30]}>
          <div className="badge3d drag-readout">
            {formatLength(dragging.at.x, units)}, {formatLength(dragging.at.y, units)}
          </div>
        </Html>
      )}
    </group>
  );
}
