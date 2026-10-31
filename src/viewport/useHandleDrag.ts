/** Ground-plane picking and handle dragging shared by the 3D editing components. */
import { type ThreeEvent, useThree } from '@react-three/fiber';
import { useCallback, useRef, useState } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { Vec2 } from '../model/geometry';
import { beginGesture, endGesture, updateDoc } from '../state/docStore';

export type Drag =
  | { kind: 'outline'; index: number }
  | { kind: 'zone'; id: string; index: number }
  | { kind: 'rockPt'; id: string; index: number }
  | { kind: 'rockMove'; id: string; last: Vec2 };

const r3 = (v: number) => Math.round(v * 1000) / 1000;

export function useGroundPicker() {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  return useCallback(
    (clientX: number, clientY: number, y = 0): Vec2 | null => {
      const rect = gl.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, camera);
      const hit = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), new THREE.Vector3());
      return hit ? { x: hit.x, y: hit.z } : null;
    },
    [camera, gl],
  );
}

/** Start a drag from a 3D handle: orbit pauses, the edit is one undo step, and moves follow the cursor. */
export function useHandleDrag() {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const pick = useGroundPicker();
  const [dragging, setDragging] = useState<{ drag: Drag; at: Vec2 } | null>(null);
  const live = useRef<Drag | null>(null);

  const start = useCallback(
    (e: ThreeEvent<PointerEvent>, drag: Drag, planeY: number) => {
      if (e.nativeEvent.button !== 0) return;
      e.stopPropagation();
      live.current = drag;
      if (controls) controls.enabled = false;
      beginGesture();
      document.body.style.cursor = 'grabbing';
      const move = (ev: PointerEvent) => {
        const d = live.current;
        const p = pick(ev.clientX, ev.clientY, planeY);
        if (!d || !p) return;
        const q = { x: r3(p.x), y: r3(p.y) };
        updateDoc((doc) => {
          if (d.kind === 'outline') doc.outline.points[d.index] = q;
          else if (d.kind === 'zone') {
            const z = doc.zones.find((z) => z.id === d.id);
            if (z && 'polygon' in z) z.polygon[d.index] = q;
          } else if (d.kind === 'rockPt') {
            const rw = doc.rockwork.find((r) => r.id === d.id);
            if (rw) rw.path[d.index] = q;
          } else {
            const rw = doc.rockwork.find((r) => r.id === d.id);
            if (rw) {
              const dx = p.x - d.last.x;
              const dy = p.y - d.last.y;
              rw.path = rw.path.map((v) => ({ x: r3(v.x + dx), y: r3(v.y + dy) }));
            }
            d.last = p;
          }
        });
        setDragging({ drag: d, at: q });
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        live.current = null;
        setDragging(null);
        endGesture();
        if (controls) controls.enabled = true;
        document.body.style.cursor = '';
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [controls, pick],
  );
  return { start, dragging };
}

