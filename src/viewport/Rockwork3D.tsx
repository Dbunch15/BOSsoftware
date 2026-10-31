/**
 * 3D rockwork: instanced displaced-boulder meshes from model.rockwork layouts, triplanar rock
 * shading, and an animated waterfall sheet with foam and mist.
 */
import { type ThreeEvent, useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Model } from '../model/buildModel';
import type { Rockwork } from '../model/schema';
import { ROCK_COLORS } from '../rockwork/colors';
import { type FallSheet, type RockLayout, ROCK_VARIANTS } from '../rockwork/buildRockwork';
import { rockTexture } from './textures';

// ---- boulder geometry --------------------------------------------------------------------

function hash3(x: number, y: number, z: number, seed: number) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647) ^ Math.imul(seed, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function noise3(x: number, y: number, z: number, seed: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = x - xi;
  const yf = y - yi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const w = zf * zf * (3 - 2 * zf);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  const c = (dx: number, dy: number, dz: number) => hash3(xi + dx, yi + dy, zi + dz, seed);
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v),
    l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  );
}

const geoCache = new Map<string, THREE.BufferGeometry>();

/** A unit boulder: displaced icosphere, flattened underneath, sharper facets as jaggedness rises. */
function rockGeometry(variant: number, jaggedness: number): THREE.BufferGeometry {
  const jag = Math.round(jaggedness * 4) / 4;
  const key = `${variant}:${jag}`;
  const hit = geoCache.get(key);
  if (hit) return hit;
  const g = new THREE.IcosahedronGeometry(1, jag >= 0.75 ? 2 : 3);
  const v = new THREE.Vector3();
  const seed = variant * 131 + 7;
  // Merge identical vertices first so displacement doesn't crack the mesh.
  const merged = mergeVertices(g);
  const mp = merged.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < mp.count; i++) {
    v.fromBufferAttribute(mp, i).normalize();
    let d = 0;
    let amp = 0.36 + 0.16 * jag;
    let f = 0.95;
    for (let o = 0; o < 4; o++) {
      let n = noise3(v.x * f + 10, v.y * f + 20, v.z * f + 30, seed + o);
      if (jag > 0.4) n = 1 - Math.abs(n * 2 - 1); // ridged → sharper edges
      d += (n - 0.5) * amp;
      amp *= 0.5;
      f *= 2.1;
    }
    const r = 1 + d;
    v.multiplyScalar(r);
    // Per-variant elongation so stones aren't all the same blob.
    v.x *= 1 + ((variant * 37) % 7) / 18;
    v.z *= 1 - ((variant * 53) % 5) / 20;
    if (v.y < -0.45) v.y = -0.45 + (v.y + 0.45) * 0.25; // sits flat
    mp.setXYZ(i, v.x, v.y, v.z);
  }
  merged.computeVertexNormals();
  g.dispose();
  geoCache.set(key, merged);
  return merged;
}

function mergeVertices(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  const map = new Map<string, number>();
  const verts: number[] = [];
  const uvs: number[] = [];
  const index: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const k = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
    let idx = map.get(k);
    if (idx === undefined) {
      idx = verts.length / 3;
      map.set(k, idx);
      verts.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      uvs.push(uv.getX(i), uv.getY(i));
    }
    index.push(idx);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  out.setIndex(index);
  return out;
}

// ---- materials ---------------------------------------------------------------------------

let rockMaterial: THREE.MeshStandardMaterial | null = null;
function getRockMaterial(): THREE.MeshStandardMaterial {
  if (rockMaterial) return rockMaterial;
  const m = new THREE.MeshStandardMaterial({ map: rockTexture(), roughness: 0.92, metalness: 0, envMapIntensity: 0.8 });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRockPos;\nvarying vec3 vRockNrm;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
#ifdef USE_INSTANCING
  mat4 rockM = modelMatrix * instanceMatrix;
#else
  mat4 rockM = modelMatrix;
#endif
vRockPos = (rockM * vec4(transformed, 1.0)).xyz;
vRockNrm = normalize(mat3(rockM) * objectNormal);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRockPos;\nvarying vec3 vRockNrm;')
      .replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
  vec3 tw = pow(abs(normalize(vRockNrm)), vec3(4.0));
  tw /= (tw.x + tw.y + tw.z);
  vec3 tp = vRockPos * 0.9;
  vec3 tex = texture2D(map, tp.zy).rgb * tw.x + texture2D(map, tp.xz).rgb * tw.y + texture2D(map, tp.xy).rgb * tw.z;
  float topLight = smoothstep(0.55, 0.95, normalize(vRockNrm).y) * 0.12;
  float wetRock = smoothstep(0.06, -0.02, vRockPos.y);
  diffuseColor.rgb *= tex * (1.0 + topLight) * mix(1.0, 0.62, wetRock);
#endif`,
      );
  };
  m.customProgramCacheKey = () => 'naturi-rock-v1';
  rockMaterial = m;
  return m;
}

// ---- components --------------------------------------------------------------------------

export interface RockInteraction {
  /** Rockwork under the pointer and the selected one are drawn brighter. */
  hoverId: string | null;
  selectedId: string | null;
  onHover: (id: string | null) => void;
  onDown: (e: ThreeEvent<PointerEvent>, id: string) => void;
}

export function Rockwork3D({ model, onRocks, interact }: { model: Model; onRocks?: (n: number) => void; interact?: RockInteraction }) {
  const total = model.doc.rockwork.reduce((n, rw) => n + (model.rockwork[rw.id]?.rocks.length ?? 0), 0);
  useEffect(() => {
    onRocks?.(total);
  }, [total, onRocks]);
  return (
    <group>
      {model.doc.rockwork.map((rw) => {
        const lay = model.rockwork[rw.id];
        if (!lay) return null;
        return (
          <group key={rw.id}>
            <group
              onPointerOver={
                interact
                  ? (e) => {
                      e.stopPropagation();
                      interact.onHover(rw.id);
                    }
                  : undefined
              }
              onPointerOut={interact ? () => interact.onHover(null) : undefined}
              onPointerDown={interact ? (e) => interact.onDown(e, rw.id) : undefined}
            >
              <Boulders rw={rw} layout={lay} glow={interact?.selectedId === rw.id ? 1.32 : interact?.hoverId === rw.id ? 1.18 : 1} />
            </group>
            {lay.falls && <Waterfall falls={lay.falls} />}
          </group>
        );
      })}
    </group>
  );
}

function Boulders({ rw, layout, glow }: { rw: Rockwork; layout: RockLayout; glow: number }) {
  const groups = useMemo(() => {
    const by: number[][] = Array.from({ length: ROCK_VARIANTS }, () => []);
    layout.rocks.forEach((r, i) => by[r.variant].push(i));
    return by;
  }, [layout]);
  return (
    <>
      {groups.map((idx, variant) =>
        idx.length ? <VariantInstances key={variant} rw={rw} layout={layout} indices={idx} variant={variant} glow={glow} /> : null,
      )}
    </>
  );
}

function VariantInstances({ rw, layout, indices, variant, glow }: { rw: Rockwork; layout: RockLayout; indices: number[]; variant: number; glow: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = rockGeometry(variant, rw.jaggedness);
  const material = getRockMaterial();
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const base = new THREE.Color(ROCK_COLORS[rw.rockType]);
    const c = new THREE.Color();
    indices.forEach((ri, i) => {
      const r = layout.rocks[ri];
      // Plan angle runs from +x toward +y (= +z in 3D), i.e. a negative rotation about +Y.
      e.set(r.tilt, -r.rotY, r.tilt * 0.6, 'YXZ');
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(r.x, r.y, r.z), q, new THREE.Vector3(r.sx, r.sy, r.sz));
      mesh.setMatrixAt(i, m);
      c.copy(base).multiplyScalar(r.shade * glow);
      mesh.setColorAt(i, c);
    });
    mesh.count = indices.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [indices, layout, rw.rockType, glow]);
  return <instancedMesh ref={ref} args={[geometry, material, indices.length]} castShadow receiveShadow frustumCulled={false} />;
}

const FALL_ROWS = 16;

function Waterfall({ falls }: { falls: FallSheet }) {
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  const sheet = useMemo(() => {
    const cols = falls.columns;
    const nc = cols.length;
    const pos = new Float32Array(nc * FALL_ROWS * 3);
    const uv = new Float32Array(nc * FALL_ROWS * 2);
    cols.forEach((col, c) => {
      // Resample each column to FALL_ROWS points by index fraction.
      for (let r = 0; r < FALL_ROWS; r++) {
        const t = (r / (FALL_ROWS - 1)) * (col.length - 1);
        const i0 = Math.floor(t);
        const i1 = Math.min(col.length - 1, i0 + 1);
        const f = t - i0;
        const a = col[i0];
        const b = col[i1];
        const k = c * FALL_ROWS + r;
        pos[k * 3] = a.x + (b.x - a.x) * f;
        pos[k * 3 + 1] = a.y + (b.y - a.y) * f;
        pos[k * 3 + 2] = a.z + (b.z - a.z) * f;
        uv[k * 2] = c / Math.max(1, nc - 1);
        uv[k * 2 + 1] = r / (FALL_ROWS - 1);
      }
    });
    const index: number[] = [];
    for (let c = 0; c < nc - 1; c++)
      for (let r = 0; r < FALL_ROWS - 1; r++) {
        const a = c * FALL_ROWS + r;
        const b = a + FALL_ROWS;
        index.push(a, b, a + 1, a + 1, b, b + 1);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(index);
    return g;
  }, [falls]);

  const foam = useMemo(() => {
    const ends = falls.columns.map((c) => c[c.length - 1]);
    const n = 260;
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const e = ends[Math.floor((i / n) * ends.length)];
      pos[i * 3] = e.x;
      pos[i * 3 + 1] = e.y;
      pos[i * 3 + 2] = e.z;
      seed[i] = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    return g;
  }, [falls]);
  useEffect(() => () => (sheet.dispose(), foam.dispose()), [sheet, foam]);

  const sheetMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `
          uniform float uTime; varying vec2 vUv;
          float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float n(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
            return mix(mix(h(i), h(i+vec2(1,0)), u.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), u.x), u.y); }
          void main(){
            vec2 p = vec2(vUv.x * 26.0, vUv.y * 5.0 - uTime * 2.6);
            float streak = n(p) * 0.6 + n(p * 2.3 + 7.0) * 0.4;
            float edge = smoothstep(0.0, 0.06, vUv.x) * smoothstep(1.0, 0.94, vUv.x);
            float a = (0.38 + 0.55 * smoothstep(0.35, 0.85, streak)) * edge * mix(0.85, 1.0, vUv.y);
            vec3 col = mix(vec3(0.72, 0.9, 0.92), vec3(1.0), smoothstep(0.5, 0.9, streak) * 0.8 + vUv.y * 0.25);
            gl_FragColor = vec4(col, a);
          }`,
      }),
    [uniforms],
  );

  const foamMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms,
        transparent: true,
        depthWrite: false,
        vertexShader: `
          uniform float uTime; attribute float aSeed; varying float vLife;
          void main(){
            float life = fract(uTime * 0.45 + aSeed);
            vLife = life;
            vec3 p = position;
            float ang = aSeed * 40.0;
            p.x += cos(ang) * life * 0.55;
            p.z += sin(ang) * life * 0.55;
            p.y += life * 0.45 - life * life * 0.25;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = (18.0 + 26.0 * life) / -mv.z * 10.0;
          }`,
        fragmentShader: `
          varying float vLife;
          void main(){
            float d = length(gl_PointCoord - 0.5);
            float a = smoothstep(0.5, 0.0, d) * (1.0 - vLife) * 0.55;
            gl_FragColor = vec4(vec3(0.96, 0.99, 1.0), a);
          }`,
      }),
    [uniforms],
  );

  useFrame((_, dt) => {
    uniforms.uTime.value += dt;
  });

  return (
    <group>
      <mesh geometry={sheet} material={sheetMat} renderOrder={4} />
      <points geometry={foam} material={foamMat} renderOrder={5} />
    </group>
  );
}
