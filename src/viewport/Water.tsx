/**
 * First-pass water: physical transmission (refraction of the floor) with depth-driven thickness
 * for Beer–Lambert absorption (turquoise over shallow sand, deeper blue in the deep end), Fresnel
 * reflections of the HDRI, and two scrolling ripple normal layers.
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Model } from '../model/buildModel';
import { waterNormalTexture } from './textures';

const THICKNESS_SCALE = 0.65;

export function Water({ model, quality }: { model: Model; quality: 'high' | 'low' }) {
  const f = model.field;
  const maxD = Math.max(0.5, model.stats.maxDepth);

  const depthTex = useMemo(() => {
    const t = new THREE.DataTexture(new Uint8Array(f.nx * f.ny * 4), f.nx, f.ny, THREE.RGBAFormat);
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearFilter;
    t.flipY = false;
    return t;
  }, [f.nx, f.ny]);
  useEffect(() => () => depthTex.dispose(), [depthTex]);

  useEffect(() => {
    const data = depthTex.image.data as Uint8Array;
    for (let k = 0; k < f.nx * f.ny; k++) {
      const d = f.sdf[k] > 0 ? Math.max(0, -f.elev[k]) / maxD : 0;
      data[k * 4] = 0;
      data[k * 4 + 1] = Math.round(Math.min(1, d) * 255);
      data[k * 4 + 2] = 0;
      data[k * 4 + 3] = 255;
    }
    depthTex.needsUpdate = true;
  }, [depthTex, f, maxD]);

  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  const material = useMemo(() => {
    const normal = waterNormalTexture();
    normal.channel = 1;
    const m = new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      metalness: 0,
      roughness: 0.035,
      ior: 1.333,
      transmission: 1,
      thickness: 1,
      attenuationColor: new THREE.Color('#2fc6c8'),
      attenuationDistance: 1.1 * THICKNESS_SCALE,
      specularIntensity: 1,
      envMapIntensity: 1.15,
      normalMap: normal,
      normalScale: new THREE.Vector2(0.1, 0.1),
    });
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace(
          'vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;',
          `vec3 n1 = texture2D( normalMap, vNormalMapUv + uTime * vec2( 0.021, 0.013 ) ).xyz * 2.0 - 1.0;
	vec3 n2 = texture2D( normalMap, vNormalMapUv * 1.83 + uTime * vec2( -0.017, 0.024 ) ).xyz * 2.0 - 1.0;
	vec3 mapN = normalize( vec3( n1.xy + n2.xy, n1.z * n2.z ) );`,
        );
    };
    m.customProgramCacheKey = () => 'naturi-water-v1';
    return m;
  }, [uniforms]);

  useEffect(() => {
    material.thicknessMap = depthTex;
    material.thickness = maxD * THICKNESS_SCALE;
    // Low quality skips the transmission pass (a second scene render) and fakes it with alpha.
    const high = quality === 'high';
    material.transmission = high ? 1 : 0;
    material.transparent = !high;
    material.opacity = high ? 1 : 0.62;
    material.color.set(high ? '#ffffff' : '#49c9c4');
    material.needsUpdate = true;
  }, [material, depthTex, maxD, quality]);

  const geometry = useMemo(() => {
    const contour = model.outline.pts.map((p) => new THREE.Vector2(p.x, p.y));
    const tris = THREE.ShapeUtils.triangulateShape(contour, []);
    const n = contour.length;
    const pos = new Float32Array(n * 3);
    const uv = new Float32Array(n * 2);
    const uv1 = new Float32Array(n * 2);
    const W = f.nx * f.cell;
    const H = f.ny * f.cell;
    contour.forEach((p, i) => {
      pos[i * 3] = p.x;
      pos[i * 3 + 1] = 0;
      pos[i * 3 + 2] = p.y;
      uv[i * 2] = (p.x - f.x0 + f.cell / 2) / W;
      uv[i * 2 + 1] = (p.y - f.y0 + f.cell / 2) / H;
      uv1[i * 2] = p.x / 5.5;
      uv1[i * 2 + 1] = p.y / 5.5;
    });
    const idx: number[] = [];
    for (const [a, b, c] of tris) {
      // Face up (+y): with (x, 0, y) the plan winding decides; flip if the normal points down.
      const ax = pos[a * 3], az = pos[a * 3 + 2];
      const bx = pos[b * 3], bz = pos[b * 3 + 2];
      const cx = pos[c * 3], cz = pos[c * 3 + 2];
      const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
      if (ny >= 0) idx.push(a, b, c);
      else idx.push(a, c, b);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('uv1', new THREE.BufferAttribute(uv1, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, [model.outline, f.x0, f.y0, f.nx, f.ny, f.cell]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((_, dt) => {
    uniforms.uTime.value += dt;
  });

  return <mesh geometry={geometry} material={material} renderOrder={2} />;
}
