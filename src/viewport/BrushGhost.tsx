/** Translucent preview of where the floor will end up after a few dabs, drawn under the cursor. */
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Model } from '../model/buildModel';
import { sampleDepth } from '../model/floorField';
import { predictDelta } from '../editor/sculpt';
import type { BrushSettings, SculptTool } from '../state/uiStore';

const RINGS = 14;
const SEGS = 48;
/** The ghost shows the effect of this many dabs so a single pass is visible. */
const GHOST_DABS = 6;

export function BrushGhost({ model, at, tool, brush }: { model: Model; at: { x: number; z: number }; tool: SculptTool; brush: BrushSettings }) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((RINGS * SEGS + 1) * 3), 3));
    const idx: number[] = [];
    for (let s = 0; s < SEGS; s++) idx.push(0, 1 + ((s + 1) % SEGS), 1 + s);
    for (let r = 0; r < RINGS - 1; r++)
      for (let s = 0; s < SEGS; s++) {
        const a = 1 + r * SEGS + s;
        const b = 1 + r * SEGS + ((s + 1) % SEGS);
        const c = a + SEGS;
        const d = b + SEGS;
        idx.push(a, b, c, b, d, c);
      }
    g.setIndex(idx);
    return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useMemo(() => {
    const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
    const f = model.field;
    const center = { x: at.x, y: at.z };
    const R = brush.radius;
    let avg = 0;
    let n = 0;
    for (let k = 0; k < 24; k++) {
      const p = { x: center.x + Math.cos(k) * R * 0.6, y: center.y + Math.sin(k) * R * 0.6 };
      avg += sampleDepth(f, p);
      n++;
    }
    avg /= n;
    const dab = { mode: tool, center, radius: R, strength: brush.strength, pressure: 1, flattenDepth: brush.flattenDepth, shape: brush.shape };
    const put = (i: number, p: { x: number; y: number }) => {
      const d = sampleDepth(f, p);
      const next = d + predictDelta(dab, p, d, avg) * GHOST_DABS;
      pos.setXYZ(i, p.x, -next + 0.015, p.y);
    };
    put(0, center);
    for (let r = 0; r < RINGS; r++)
      for (let s = 0; s < SEGS; s++) {
        const rr = (R * (r + 1)) / RINGS;
        const a = (s / SEGS) * Math.PI * 2;
        put(1 + r * SEGS + s, { x: center.x + Math.cos(a) * rr, y: center.y + Math.sin(a) * rr });
      }
    pos.needsUpdate = true;
    geometry.computeBoundingSphere();
  }, [geometry, model.field, at.x, at.z, tool, brush]);

  const color = tool === 'raise' ? '#ffcf70' : tool === 'flatten' ? '#c5a3ff' : '#5fd6cd';
  return (
    <group>
      <mesh geometry={geometry} renderOrder={6}>
        <meshBasicMaterial color={color} transparent opacity={0.28} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh geometry={geometry} renderOrder={7}>
        <meshBasicMaterial color={color} wireframe transparent opacity={0.35} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}
