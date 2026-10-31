/** Pool shell + deck heightfield mesh built from model.field, with finish/deck/flag shading. */
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Model } from '../model/buildModel';
import { DECK_WIDTH } from '../model/floorField';
import { finishById } from '../specs/finishes';
import { deckTexture, finishTexture, grassTexture } from './textures';
import { useFinishMaps } from './useFinishMaps';

export const LAWN_TINT = '#c8d6b6';

/** Real-world size of one procedural finish tile (m). */
const PROCEDURAL_TILE = 0.6;
/** Blend width between finish / deck / lawn (wider than a cell to avoid stair-stepping). */
const EDGE = 0.16;

function patchShell(mat: THREE.MeshStandardMaterial, uniforms: Record<string, THREE.IUniform>) {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute float aRegion;
attribute float aFlag;
varying float vRegion;
varying float vFlag;
varying vec3 vWPos;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vRegion = aRegion;
vFlag = aFlag;
vWPos = (modelMatrix * vec4(position, 1.0)).xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform sampler2D uDeckMap;
uniform sampler2D uGrassMap;
uniform vec3 uGrassTint;
uniform float uTime;
uniform vec3 uWarn;
uniform vec3 uCrit;
uniform float uCaustics;
uniform float uDeckRoughness;
varying float vRegion;
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
}
varying float vFlag;
varying vec3 vWPos;
float causticPattern(vec2 uv, float t) {
  vec2 p = mod(uv * 6.28318, 6.28318) - 250.0;
  vec2 i = p;
  float c = 1.0;
  float inten = 0.005;
  for (int n = 0; n < 4; n++) {
    float tt = t * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
  }
  c /= 4.0;
  c = 1.17 - pow(c, 1.4);
  return clamp(pow(abs(c), 8.0), 0.0, 2.0);
}`,
      )
      .replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
  // Anti-tiling: blend the finish with a rotated, rescaled copy of itself by low-frequency noise
  // so a ~30 cm photo tile doesn't read as a grid across a 40 ft pool.
  float tileMix = smoothstep(0.3, 0.7, valueNoise(vMapUv * 0.37));
  vec2 uvAlt = mat2(0.788, -0.616, 0.616, 0.788) * vMapUv * 0.83 + vec2(0.37, 0.71);
  vec4 finishCol = mix(texture2D(map, vMapUv), texture2D(map, uvAlt), tileMix);
  vec4 deckCol = texture2D(uDeckMap, vWPos.xz / 1.22);
  vec3 grassCol = texture2D(uGrassMap, vWPos.xz / 2.5).rgb * uGrassTint;
  float finishW = clamp(vRegion, 0.0, 1.0);
  vec3 baseCol = mix(mix(deckCol.rgb, finishCol.rgb, finishW), grassCol, clamp(-vRegion, 0.0, 1.0));
  float wet = smoothstep(0.015, -0.03, vWPos.y) * finishW;
  baseCol *= mix(1.0, 0.8, wet);
  diffuseColor.rgb *= baseCol;
#else
  float wet = 0.0;
  float finishW = 1.0;
#endif`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
roughnessFactor = mix(uDeckRoughness, roughnessFactor, finishW);
roughnessFactor = mix(roughnessFactor, 0.5, wet);`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
normal = normalize(mix(nonPerturbedNormal, normal, finishW));`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
float pulse = 0.72 + 0.28 * sin(uTime * 3.2);
float flagOn = step(0.5, vFlag);
vec3 flagCol = vFlag > 1.5 ? uCrit : uWarn;
diffuseColor.rgb = mix(diffuseColor.rgb, flagCol, flagOn * 0.55 * pulse);
totalEmissiveRadiance += flagCol * flagOn * 0.35 * pulse;
float under = smoothstep(0.0, -0.06, vWPos.y);
float caust = causticPattern(vWPos.xz / 1.7, uTime * 0.55) * under * exp(vWPos.y * 0.7);
totalEmissiveRadiance += vec3(0.85, 1.0, 0.95) * caust * uCaustics * clamp(vRegion, 0.0, 1.0);`,
      );
  };
  mat.customProgramCacheKey = () => 'naturi-shell-v2';
}

export function ShellMesh({
  model,
  onBuilt,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onClick,
  caustics,
}: {
  model: Model;
  onBuilt?: (sig: string) => void;
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerMove?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerUp?: (e: ThreeEvent<PointerEvent>) => void;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
  caustics: number;
}) {
  const f = model.field;
  const finish = finishById(model.doc.finish.id);

  const uniforms = useMemo(
    () => ({
      uDeckMap: { value: deckTexture() },
      uGrassMap: { value: grassTexture() },
      uGrassTint: { value: new THREE.Color(LAWN_TINT) },
      uTime: { value: 0 },
      uWarn: { value: new THREE.Color('#f5a524') },
      uCrit: { value: new THREE.Color('#f0524f') },
      uCaustics: { value: 0.22 },
      uDeckRoughness: { value: 0.85 },
    }),
    [],
  );

  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, envMapIntensity: 0.9 });
    patchShell(m, uniforms);
    return m;
  }, [uniforms]);

  const photo = useFinishMaps(finish.id);
  useEffect(() => {
    if (photo) {
      material.map = photo.albedo;
      material.normalMap = photo.normal ?? null;
      material.roughnessMap = photo.roughness ?? null;
      material.roughness = photo.roughness ? 1 : finish.roughness;
      material.normalScale.set(0.9, 0.9);
    } else {
      const t = finishTexture(finish);
      t.repeat.set(1 / PROCEDURAL_TILE, 1 / PROCEDURAL_TILE);
      material.map = t;
      material.normalMap = null;
      material.roughnessMap = null;
      material.roughness = finish.roughness;
    }
    material.needsUpdate = true;
  }, [material, finish, photo]);

  useEffect(() => {
    uniforms.uCaustics.value = caustics;
  }, [uniforms, caustics]);

  // Index/uv buffers depend only on grid dimensions; positions update in place.
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const n = f.nx * f.ny;
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    g.setAttribute('aRegion', new THREE.BufferAttribute(new Float32Array(n), 1));
    g.setAttribute('aFlag', new THREE.BufferAttribute(new Float32Array(n), 1));
    const idx = new Uint32Array((f.nx - 1) * (f.ny - 1) * 6);
    let o = 0;
    for (let j = 0; j < f.ny - 1; j++)
      for (let i = 0; i < f.nx - 1; i++) {
        const a = j * f.nx + i;
        const b = a + f.nx;
        const c = a + 1;
        const d = b + 1;
        idx[o++] = a;
        idx[o++] = b;
        idx[o++] = c;
        idx[o++] = c;
        idx[o++] = b;
        idx[o++] = d;
      }
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    return g;
  }, [f.nx, f.ny]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useLayoutEffect(() => {
    const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
    const uv = geometry.getAttribute('uv') as THREE.BufferAttribute;
    const reg = geometry.getAttribute('aRegion') as THREE.BufferAttribute;
    const flag = geometry.getAttribute('aFlag') as THREE.BufferAttribute;
    const P = pos.array as Float32Array;
    const U = uv.array as Float32Array;
    const R = reg.array as Float32Array;
    const F = flag.array as Float32Array;
    const lip = model.doc.shell.lipWidth;
    let sum = 0;
    for (let j = 0; j < f.ny; j++)
      for (let i = 0; i < f.nx; i++) {
        const k = j * f.nx + i;
        const x = f.x0 + i * f.cell;
        const y = f.y0 + j * f.cell;
        P[k * 3] = x;
        P[k * 3 + 1] = f.elev[k];
        P[k * 3 + 2] = y;
        // UVs in meters; each finish texture's repeat sets its real-world scale.
        U[k * 2] = x;
        U[k * 2 + 1] = y;
        // 1 = finish (pool + sand lip), 0 = paver deck, -1 = lawn; blended across each edge.
        const out = -f.sdf[k];
        R[k] = out <= lip ? 1 : out <= lip + EDGE ? 1 - (out - lip) / EDGE : out <= lip + DECK_WIDTH ? 0 : -Math.min(1, (out - lip - DECK_WIDTH) / EDGE);
        F[k] = model.cellFlags[k];
        sum += f.elev[k];
      }
    pos.needsUpdate = true;
    uv.needsUpdate = true;
    reg.needsUpdate = true;
    flag.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();
    onBuilt?.(`${f.nx}x${f.ny}:${sum.toFixed(3)}`);
  }, [geometry, f, model.cellFlags, model.doc.shell.lipWidth, onBuilt]);

  useFrame((_, dt) => {
    uniforms.uTime.value += dt;
  });

  return (
    <mesh
      geometry={geometry}
      material={material}
      castShadow
      receiveShadow
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onClick={onClick}
    />
  );
}
