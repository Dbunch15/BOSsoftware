import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { useFinishLibrary } from '../materials/finishLibrary';

export interface FinishTextures {
  albedo: THREE.Texture;
  normal?: THREE.Texture;
  roughness?: THREE.Texture;
}

const loader = new THREE.TextureLoader();
const cache = new Map<string, Promise<THREE.Texture>>();

function load(url: string, color: boolean, tileSize: number): Promise<THREE.Texture> {
  const key = `${url}|${tileSize}`;
  let p = cache.get(key);
  if (!p) {
    p = loader.loadAsync(url).then((t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = 12;
      t.repeat.set(1 / tileSize, 1 / tileSize);
      t.needsUpdate = true;
      return t;
    });
    cache.set(key, p);
    p.catch(() => cache.delete(key));
  }
  return p;
}

/** Photo-based textures for a finish, or null to use the procedural fallback. */
export function useFinishMaps(finishId: string): FinishTextures | null {
  const maps = useFinishLibrary((s) => s.maps[finishId]);
  const [textures, setTextures] = useState<FinishTextures | null>(null);
  useEffect(() => {
    let live = true;
    if (!maps) {
      setTextures(null);
      return;
    }
    Promise.all([
      load(maps.albedo, true, maps.tileSize),
      maps.normal ? load(maps.normal, false, maps.tileSize) : Promise.resolve(undefined),
      maps.roughness ? load(maps.roughness, false, maps.tileSize) : Promise.resolve(undefined),
    ])
      .then(([albedo, normal, roughness]) => live && setTextures({ albedo, normal, roughness }))
      .catch(() => live && setTextures(null));
    return () => {
      live = false;
    };
  }, [maps]);
  return textures;
}
