/**
 * Hold the right mouse button in 3D to fly: mouse looks around, WASD moves, Space/Shift rise and
 * sink, Ctrl goes faster, scroll changes speed. Releasing hands back to orbit around the point
 * you were looking at.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { type FlyKeys, NO_KEYS, adjustSpeed, flyStep, forwardVector, look, lookAtAngles } from '../controls/flyMath';
import { useUi } from '../state/uiStore';

const KEYMAP: Record<string, keyof FlyKeys> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  Space: 'up',
  KeyE: 'up',
  ShiftLeft: 'down',
  ShiftRight: 'down',
  KeyC: 'down',
  ControlLeft: 'fast',
  ControlRight: 'fast',
};

export function FlyControls() {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const st = useRef({ active: false, yaw: 0, pitch: 0, speed: 4, dist: 10, keys: { ...NO_KEYS } });

  useEffect(() => {
    const el = gl.domElement;
    const s = st.current;
    const start = (e: PointerEvent) => {
      if (e.button !== 2) return;
      e.preventDefault();
      const target = controls?.target ?? new THREE.Vector3();
      const a = lookAtAngles(camera.position.toArray() as [number, number, number], target.toArray() as [number, number, number]);
      s.yaw = a.yaw;
      s.pitch = a.pitch;
      s.dist = Math.max(3, Math.min(40, camera.position.distanceTo(target)));
      s.active = true;
      s.keys = { ...NO_KEYS };
      if (controls) controls.enabled = false;
      el.setPointerCapture(e.pointerId);
      useUi.getState().set({ flight: { speed: s.speed } });
    };
    const move = (e: PointerEvent) => {
      if (!s.active) return;
      const next = look(s.yaw, s.pitch, e.movementX, e.movementY);
      s.yaw = next.yaw;
      s.pitch = next.pitch;
    };
    const stop = (e: PointerEvent) => {
      if (!s.active || (e.type === 'pointerup' && e.button !== 2)) return;
      s.active = false;
      s.keys = { ...NO_KEYS };
      el.releasePointerCapture?.(e.pointerId);
      if (controls) {
        // Orbit around whatever is straight ahead, at the distance we started from.
        const f = forwardVector(s.yaw, s.pitch);
        controls.target.copy(camera.position).add(new THREE.Vector3(...f).multiplyScalar(s.dist));
        controls.enabled = true;
        controls.update();
      }
      useUi.getState().set({ flight: null });
    };
    const wheel = (e: WheelEvent) => {
      if (!s.active) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      s.speed = adjustSpeed(s.speed, e.deltaY || e.deltaX);
      useUi.getState().set({ flight: { speed: s.speed } });
    };
    const key = (down: boolean) => (e: KeyboardEvent) => {
      if (!s.active) return;
      const k = KEYMAP[e.code];
      if (!k) return;
      // Swallow keys while flying so W/S/D etc. don't also switch tools.
      e.preventDefault();
      e.stopImmediatePropagation();
      s.keys = { ...s.keys, [k]: down };
    };
    const kd = key(true);
    const ku = key(false);
    const blur = () => (s.keys = { ...NO_KEYS });
    const noMenu = (e: Event) => e.preventDefault();
    el.addEventListener('pointerdown', start);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', stop);
    el.addEventListener('pointercancel', stop);
    el.addEventListener('lostpointercapture', stop as EventListener);
    el.addEventListener('wheel', wheel, { capture: true, passive: false });
    el.addEventListener('contextmenu', noMenu);
    window.addEventListener('keydown', kd, true);
    window.addEventListener('keyup', ku, true);
    window.addEventListener('blur', blur);
    return () => {
      el.removeEventListener('pointerdown', start);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', stop);
      el.removeEventListener('pointercancel', stop);
      el.removeEventListener('lostpointercapture', stop as EventListener);
      el.removeEventListener('wheel', wheel, { capture: true });
      el.removeEventListener('contextmenu', noMenu);
      window.removeEventListener('keydown', kd, true);
      window.removeEventListener('keyup', ku, true);
      window.removeEventListener('blur', blur);
    };
  }, [camera, gl, controls]);

  useFrame((_, dt) => {
    const s = st.current;
    if (!s.active) return;
    const [x, y, z] = flyStep(s.yaw, s.keys, s.speed, Math.min(dt, 0.1));
    camera.position.x += x;
    camera.position.y = Math.max(-4, camera.position.y + y);
    camera.position.z += z;
    camera.rotation.set(s.pitch, s.yaw, 0, 'YXZ');
  });
  return null;
}
