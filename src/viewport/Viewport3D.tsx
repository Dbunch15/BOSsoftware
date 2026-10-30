/**
 * 3D viewport. Renders from the derived Model only (shell mesh from floorField, water from the
 * sampled outline, warnings from model.violations).
 */
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Environment, Html, OrbitControls, SoftShadows } from '@react-three/drei';
import { EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { Model } from '../model/buildModel';
import { LAWN_DROP, sampleDepth } from '../model/floorField';
import { bounds } from '../model/geometry';
import { applyDab } from '../editor/sculpt';
import { beginGesture, endGesture, getModel, updateDoc, useModel } from '../state/docStore';
import { isSculptTool, useUi } from '../state/uiStore';
import { RULE_LABELS } from '../rules';
import { formatQuantity } from '../units/format';
import { LAWN_TINT, ShellMesh } from './ShellMesh';
import { Water } from './Water';
import { grassTexture } from './textures';

const HDRI = `${import.meta.env.BASE_URL}hdri/rooitou_park_1k.hdr`;
const SUN_DIR = new THREE.Vector3(-0.55, 0.78, 0.42).normalize();

export function Viewport3D() {
  const ref = useRef<HTMLDivElement>(null);
  const [supported] = useState(() => hasWebGL());
  const quality = useUi((s) => s.quality);
  const onBuilt = useCallback((sig: string) => {
    ref.current?.setAttribute('data-mesh-sig', sig);
  }, []);
  return (
    <div ref={ref} className="viewport3d" data-testid="viewport3d">
      {supported ? (
        <GLBoundary>
          <Canvas
            shadows
            flat
            dpr={quality === 'high' ? [1, 2] : 1}
            camera={{ fov: 38, near: 0.1, far: 600, position: [10, 9, 14] }}
            gl={{ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
            onCreated={({ gl }) => {
              gl.toneMapping = THREE.NoToneMapping;
              ref.current?.setAttribute('data-ready', '1');
            }}
          >
            <Scene onBuilt={onBuilt} />
          </Canvas>
        </GLBoundary>
      ) : (
        <div className="fallback3d">3D preview needs WebGL 2. The plan view and all tools still work.</div>
      )}
    </div>
  );
}

function Scene({ onBuilt }: { onBuilt: (sig: string) => void }) {
  const model = useModel();
  const tool = useUi((s) => s.tool);
  const quality = useUi((s) => s.quality);
  const showWater = useUi((s) => s.showWater);
  const brush = useUi((s) => s.brush);
  const sculpting = useRef(false);
  const [brushAt, setBrushAt] = useState<THREE.Vector3 | null>(null);
  const sculptMode = isSculptTool(tool);

  const dab = (e: ThreeEvent<PointerEvent>) => {
    if (!isSculptTool(tool)) return;
    const m = getModel();
    const pressure = e.nativeEvent.pointerType === 'pen' && brush.usePressure ? Math.max(0.05, e.nativeEvent.pressure) : 1;
    updateDoc((d) => {
      applyDab(d.sculpt.cells, d.sculpt.cellSize, m, {
        mode: tool,
        center: { x: e.point.x, y: e.point.z },
        radius: brush.radius,
        strength: brush.strength,
        pressure,
        flattenDepth: brush.flattenDepth,
      });
    });
  };

  const handlers = sculptMode
    ? {
        onPointerDown: (e: ThreeEvent<PointerEvent>) => {
          if (e.nativeEvent.button !== 0) return;
          e.stopPropagation();
          (e.target as Element | null)?.setPointerCapture?.(e.pointerId);
          sculpting.current = true;
          beginGesture();
          dab(e);
        },
        onPointerMove: (e: ThreeEvent<PointerEvent>) => {
          setBrushAt(e.point.clone());
          if (sculpting.current) dab(e);
        },
        onPointerUp: () => {
          if (!sculpting.current) return;
          sculpting.current = false;
          endGesture();
        },
      }
    : {};

  const b = useMemo(() => bounds(model.outline.pts), [model.outline]);
  const center = useMemo(() => new THREE.Vector3((b.minX + b.maxX) / 2, 0, (b.minY + b.maxY) / 2), [b]);
  const radius = Math.max(b.maxX - b.minX, b.maxY - b.minY) / 2 + 2;

  return (
    <>
      <Suspense fallback={null}>
        <Environment files={HDRI} background backgroundBlurriness={0.015} environmentIntensity={1} />
      </Suspense>
      {quality === 'high' && <SoftShadows size={22} samples={10} focus={0.5} />}
      <Sun center={center} radius={radius} shadows={quality === 'high'} />
      <ShellMesh model={model} onBuilt={onBuilt} caustics={showWater ? 0.22 : 0} {...handlers} />
      {showWater && <Water model={model} quality={quality} />}
      <Ground model={model} />
      <Placeholders3D model={model} />
      <Markers model={model} />
      {sculptMode && brushAt && <BrushRing at={brushAt} radius={brush.radius} />}
      <CameraRig center={center} radius={radius} />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        maxPolarAngle={Math.PI * 0.495}
        minDistance={2}
        maxDistance={120}
        mouseButtons={{
          LEFT: (sculptMode ? -1 : THREE.MOUSE.ROTATE) as THREE.MOUSE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: (sculptMode ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN) as THREE.MOUSE,
        }}
      />
      <EffectComposer multisampling={0} enableNormalPass={false}>
        {quality === 'high' ? (
          <N8AO aoRadius={1.1} distanceFalloff={0.9} intensity={2.2} halfRes quality="medium" />
        ) : (
          <></>
        )}
        <SMAA />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Vignette eskil={false} offset={0.22} darkness={0.42} />
      </EffectComposer>
    </>
  );
}

function Sun({ center, radius, shadows }: { center: THREE.Vector3; radius: number; shadows: boolean }) {
  const light = useRef<THREE.DirectionalLight>(null);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const l = light.current;
    if (!l) return;
    l.position.copy(center).addScaledVector(SUN_DIR, radius * 3 + 10);
    l.target.position.copy(center);
    scene.add(l.target);
    const cam = l.shadow.camera;
    const r = radius + 3;
    cam.left = -r;
    cam.right = r;
    cam.top = r;
    cam.bottom = -r;
    cam.near = 1;
    cam.far = radius * 6 + 30;
    cam.updateProjectionMatrix();
    return () => {
      scene.remove(l.target);
    };
  }, [center, radius, scene]);
  return (
    <directionalLight
      ref={light}
      castShadow={shadows}
      intensity={2.6}
      color="#fff4e2"
      shadow-mapSize={[2048, 2048]}
      shadow-bias={-0.0004}
      shadow-normalBias={0.02}
    />
  );
}

/** Lawn around the deck, with a hole matching the heightfield extents. */
function Ground({ model }: { model: Model }) {
  const f = model.field;
  const deck = model.doc.shell.deckHeight;
  const geometry = useMemo(() => {
    const x0 = f.x0;
    const y0 = f.y0;
    const x1 = f.x0 + (f.nx - 1) * f.cell;
    const y1 = f.y0 + (f.ny - 1) * f.cell;
    const R = 160;
    const shape = new THREE.Shape([
      new THREE.Vector2(-R, -R),
      new THREE.Vector2(R, -R),
      new THREE.Vector2(R, R),
      new THREE.Vector2(-R, R),
    ]);
    shape.holes.push(new THREE.Path([new THREE.Vector2(x0, y0), new THREE.Vector2(x0, y1), new THREE.Vector2(x1, y1), new THREE.Vector2(x1, y0)]));
    const g = new THREE.ShapeGeometry(shape);
    // ShapeGeometry is in XY; map (x, y) → (x, deck, y) and face up.
    g.rotateX(Math.PI / 2);
    g.translate(0, deck - LAWN_DROP - 0.001, 0);
    const uv = g.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2.5, uv.getY(i) / 2.5);
    g.computeVertexNormals();
    const n = g.getAttribute('normal') as THREE.BufferAttribute;
    if (n.getY(0) < 0) {
      const idx = g.getIndex();
      if (idx) for (let i = 0; i < idx.count; i += 3) {
        const a = idx.getX(i + 1);
        idx.setX(i + 1, idx.getX(i + 2));
        idx.setX(i + 2, a);
      }
      g.computeVertexNormals();
    }
    return g;
  }, [f.x0, f.y0, f.nx, f.ny, f.cell, deck]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 0.95, color: LAWN_TINT, envMapIntensity: 0.6 }), []);
  return <mesh geometry={geometry} material={material} receiveShadow />;
}

function Placeholders3D({ model }: { model: Model }) {
  const { spa, features, shell } = model.doc;
  const ghost = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#a7e3dc', transparent: true, opacity: 0.32, roughness: 0.3, depthWrite: false }),
    [],
  );
  const rock = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8b8279', roughness: 0.95, flatShading: true }), []);
  const pond = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1f3d37', roughness: 0.08, metalness: 0.1 }), []);
  return (
    <group>
      {spa && (
        <group position={[spa.position.x, shell.deckHeight, spa.position.y]}>
          <mesh material={ghost} position={[0, 0.2, 0]}>
            <cylinderGeometry args={[spa.diameter / 2, spa.diameter / 2, 0.4, 48, 1, true]} />
          </mesh>
          <mesh material={ghost} position={[0, 0.38, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[spa.diameter / 2 - 0.15, 48]} />
          </mesh>
          <Html position={[0, 0.9, 0]} zIndexRange={[20, 0]}>
            <div className="label3d">Spa · placeholder</div>
          </Html>
        </group>
      )}
      {features.map((f) => (
        <group key={f.id} position={[f.position.x, shell.deckHeight, f.position.y]} rotation={[0, (-f.rotation * Math.PI) / 180, 0]}>
          {f.kind === 'koiPond' && f.polygon ? (
            <KoiPond polygon={f.polygon} origin={f.position} material={pond} />
          ) : (
            <mesh material={rock} position={[0, 0.7, 0]} scale={[f.size.x / 2, 0.9, f.size.y / 2]} castShadow receiveShadow>
              <dodecahedronGeometry args={[1, 1]} />
            </mesh>
          )}
          <Html position={[0, 1.9, 0]} zIndexRange={[20, 0]}>
            <div className="label3d">{f.name} · placeholder</div>
          </Html>
        </group>
      ))}
    </group>
  );
}

function KoiPond({ polygon, origin, material }: { polygon: Array<{ x: number; y: number }>; origin: { x: number; y: number }; material: THREE.Material }) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape(polygon.map((p) => new THREE.Vector2(p.x - origin.x, p.y - origin.y)));
    const g = new THREE.ShapeGeometry(shape, 24);
    g.rotateX(Math.PI / 2);
    g.computeVertexNormals();
    return g;
  }, [polygon, origin]);
  return <mesh geometry={geometry} material={material} position={[0, -0.04, 0]} receiveShadow />;
}

function Markers({ model }: { model: Model }) {
  const units = model.doc.units;
  // Only the first of several nearby badges carries a text label; the rest collapse to a dot.
  const labelled: Array<{ x: number; y: number }> = [];
  return (
    <group>
      {model.violations.map((v) => {
        const d = sampleDepth(model.field, v.at);
        const crowded = labelled.some((p) => Math.hypot(p.x - v.at.x, p.y - v.at.y) < 3);
        if (!crowded) labelled.push(v.at);
        return (
          <Html key={v.id} position={[v.at.x, Math.max(-d, 0) + 0.35, v.at.y]} zIndexRange={[30, 10]}>
            <div className={`badge3d ${v.severity}`} data-testid="3d-warning" data-rule={v.ruleId} data-severity={v.severity} title={v.title}>
              <span className="dot">!</span>
              {!crowded && (
                <>
                  {RULE_LABELS[v.ruleId].replace('Max ', '').replace('Min ', '')} · {formatQuantity(v.quantity, v.measured, units).split(' (')[0]}
                </>
              )}
            </div>
          </Html>
        );
      })}
    </group>
  );
}

function BrushRing({ at, radius }: { at: THREE.Vector3; radius: number }) {
  return (
    <mesh position={[at.x, at.y + 0.03, at.z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={5}>
      <ringGeometry args={[radius * 0.96, radius, 64]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.85} depthTest={false} toneMapped={false} />
    </mesh>
  );
}

function CameraRig({ center, radius }: { center: THREE.Vector3; radius: number }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const fitNonce = useUi((s) => s.fitNonce);
  const camPreset = useUi((s) => s.camPreset);
  const focus = useUi((s) => s.focus);
  const targetGoal = useRef<THREE.Vector3 | null>(null);
  const centerRef = useRef(center);
  centerRef.current = center;

  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  const userMoved = useRef(false);
  const lastFit = useRef({ fit: -1, cam: -1 });
  useEffect(() => {
    if (!controls) return;
    const onStart = () => void (userMoved.current = true);
    controls.addEventListener('start', onStart);
    return () => controls.removeEventListener('start', onStart);
  }, [controls]);
  useEffect(() => {
    if (!controls) return;
    // Pane resizes re-frame the pool only until the designer starts orbiting.
    const explicit = lastFit.current.fit !== fitNonce || lastFit.current.cam !== camPreset.nonce;
    if (!explicit && userMoved.current) return;
    lastFit.current = { fit: fitNonce, cam: camPreset.nonce };
    if (explicit) userMoved.current = false;
    const c = centerRef.current;
    // Distance that fits a sphere of `radius` in both the vertical and horizontal field of view.
    const vfov = ((camera as THREE.PerspectiveCamera).fov * Math.PI) / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
    const dist = (radius / Math.sin(Math.min(vfov, hfov) / 2)) * 0.74;
    const dir = camPreset.preset === 'top' ? new THREE.Vector3(0, 1, 0.001) : new THREE.Vector3(0.42, 0.34, 0.9);
    camera.position.copy(c).addScaledVector(dir.normalize(), dist);
    controls.target.set(c.x, -0.5, c.z);
    controls.update();
    targetGoal.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitNonce, camPreset.nonce, controls, aspect]);

  useEffect(() => {
    if (focus.at) targetGoal.current = new THREE.Vector3(focus.at.x, -0.5, focus.at.y);
  }, [focus]);

  useFrame(() => {
    if (!controls || !targetGoal.current) return;
    controls.target.lerp(targetGoal.current, 0.12);
    if (controls.target.distanceTo(targetGoal.current) < 0.01) targetGoal.current = null;
    controls.update();
  });
  return null;
}

class GLBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <div className="fallback3d">The 3D preview failed to start on this device. The plan view still works.</div> : this.props.children;
  }
}

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}
