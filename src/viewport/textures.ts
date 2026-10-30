/** Procedural textures (generated once, cached). Phase 2 swaps these for scanned PBR sets. */
import * as THREE from 'three';
import type { Finish } from '../specs/finishes';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')!];
}

function tileable(ctx: CanvasRenderingContext2D, size: number, draw: (x: number, y: number) => void, x: number, y: number) {
  for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) {
    if (x + dx < -8 || x + dx > size + 8 || y + dy < -8 || y + dy > size + 8) continue;
    draw(x + dx, y + dy);
  }
  void ctx;
}

const finishCache = new Map<string, THREE.CanvasTexture>();

/** Resin-bound quartz/marble aggregate: dense multi-colored grains on a binder tone. 512 px ≈ 0.6 m. */
export function finishTexture(f: Finish): THREE.CanvasTexture {
  const hit = finishCache.get(f.id);
  if (hit) return hit;
  const size = 512;
  const [c, ctx] = canvas(size);
  ctx.fillStyle = f.base;
  ctx.fillRect(0, 0, size, size);
  const rand = rng(f.id.split('').reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7));
  const total = f.grains.reduce((a, g) => a + g.weight, 0);
  const pick = () => {
    let r = rand() * total;
    for (const g of f.grains) if ((r -= g.weight) <= 0) return g.color;
    return f.grains[0].color;
  };
  for (let n = 0; n < 26000; n++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 0.5 + rand() * rand() * 2.2;
    ctx.fillStyle = pick();
    ctx.globalAlpha = 0.55 + rand() * 0.45;
    tileable(ctx, size, (px, py) => {
      ctx.beginPath();
      ctx.ellipse(px, py, r, r * (0.6 + rand() * 0.4), rand() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }, x, y);
  }
  ctx.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  finishCache.set(f.id, t);
  return t;
}

let deckTex: THREE.CanvasTexture | null = null;
/** Light limestone/travertine pavers, 2 × 2 pavers of 24" per tile (1.22 m). */
export function deckTexture(): THREE.CanvasTexture {
  if (deckTex) return deckTex;
  const size = 512;
  const [c, ctx] = canvas(size);
  const rand = rng(42);
  const half = size / 2;
  for (let py = 0; py < 2; py++)
    for (let px = 0; px < 2; px++) {
      const tone = 200 + Math.round(rand() * 18);
      ctx.fillStyle = `rgb(${tone + 14},${tone + 6},${tone - 12})`;
      ctx.fillRect(px * half, py * half, half, half);
      for (let n = 0; n < 900; n++) {
        const v = rand();
        ctx.fillStyle = v < 0.5 ? 'rgba(120,100,70,0.06)' : 'rgba(255,250,240,0.07)';
        const r = 1 + rand() * 7;
        ctx.beginPath();
        ctx.arc(px * half + rand() * half, py * half + rand() * half, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  ctx.strokeStyle = 'rgba(90,80,65,0.55)';
  ctx.lineWidth = 3;
  for (const v of [0, half, size]) {
    ctx.beginPath();
    ctx.moveTo(v, 0);
    ctx.lineTo(v, size);
    ctx.moveTo(0, v);
    ctx.lineTo(size, v);
    ctx.stroke();
  }
  deckTex = new THREE.CanvasTexture(c);
  deckTex.wrapS = deckTex.wrapT = THREE.RepeatWrapping;
  deckTex.colorSpace = THREE.SRGBColorSpace;
  deckTex.anisotropy = 8;
  return deckTex;
}

let grassTex: THREE.CanvasTexture | null = null;
export function grassTexture(): THREE.CanvasTexture {
  if (grassTex) return grassTex;
  const size = 512;
  const [c, ctx] = canvas(size);
  ctx.fillStyle = '#4b6b33';
  ctx.fillRect(0, 0, size, size);
  const rand = rng(7);
  for (let n = 0; n < 30000; n++) {
    const g = 70 + rand() * 70;
    ctx.strokeStyle = `rgba(${g * 0.55},${g + 20},${g * 0.35},0.5)`;
    ctx.lineWidth = 1;
    const x = rand() * size;
    const y = rand() * size;
    const a = rand() * Math.PI * 2;
    const l = 2 + rand() * 4;
    tileable(ctx, size, (px, py) => {
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l);
      ctx.stroke();
    }, x, y);
  }
  grassTex = new THREE.CanvasTexture(c);
  grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
  grassTex.colorSpace = THREE.SRGBColorSpace;
  grassTex.anisotropy = 8;
  return grassTex;
}

let waterNormal: THREE.CanvasTexture | null = null;
/** Tileable ripple normal map from a sum of integer-frequency waves. */
export function waterNormalTexture(): THREE.CanvasTexture {
  if (waterNormal) return waterNormal;
  const size = 256;
  const [c, ctx] = canvas(size);
  const rand = rng(99);
  const waves = Array.from({ length: 14 }, () => ({
    kx: Math.round((rand() - 0.5) * 14),
    ky: Math.round((rand() - 0.5) * 14),
    ph: rand() * Math.PI * 2,
    a: 0.4 + rand(),
  })).filter((w) => w.kx || w.ky);
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let v = 0;
      for (const w of waves) {
        const k = Math.hypot(w.kx, w.ky);
        v += (w.a / k) * Math.sin(((w.kx * x + w.ky * y) / size) * Math.PI * 2 + w.ph);
      }
      h[y * size + x] = v;
    }
  const img = ctx.createImageData(size, size);
  const strength = 3;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const hx = h[y * size + ((x + 1) % size)] - h[y * size + ((x - 1 + size) % size)];
      const hy = h[((y + 1) % size) * size + x] - h[((y - 1 + size) % size) * size + x];
      const nx = -hx * strength;
      const ny = -hy * strength;
      const l = Math.hypot(nx, ny, 1);
      const o = (y * size + x) * 4;
      img.data[o] = ((nx / l) * 0.5 + 0.5) * 255;
      img.data[o + 1] = ((ny / l) * 0.5 + 0.5) * 255;
      img.data[o + 2] = ((1 / l) * 0.5 + 0.5) * 255;
      img.data[o + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  waterNormal = new THREE.CanvasTexture(c);
  waterNormal.wrapS = waterNormal.wrapT = THREE.RepeatWrapping;
  waterNormal.colorSpace = THREE.NoColorSpace;
  return waterNormal;
}

let rockTex: THREE.CanvasTexture | null = null;
/** Neutral weathered-stone detail (grain, pits, faint strata); rock color comes from instances. */
export function rockTexture(): THREE.CanvasTexture {
  if (rockTex) return rockTex;
  const size = 512;
  const [c, ctx] = canvas(size);
  ctx.fillStyle = '#c8c8c8';
  ctx.fillRect(0, 0, size, size);
  const rand = rng(1234);
  for (let n = 0; n < 2600; n++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 2 + rand() * rand() * 26;
    const v = rand() < 0.5 ? 0 : 255;
    ctx.fillStyle = `rgba(${v},${v},${v},${0.03 + rand() * 0.05})`;
    tileable(ctx, size, (px, py) => {
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }, x, y);
  }
  for (let n = 0; n < 30000; n++) {
    const v = Math.round(rand() * 255);
    ctx.fillStyle = `rgba(${v},${v},${v},0.18)`;
    ctx.fillRect(rand() * size, rand() * size, 1 + rand() * 1.5, 1 + rand() * 1.5);
  }
  for (let k = 0; k < 9; k++) {
    const y = rand() * size;
    ctx.strokeStyle = `rgba(80,70,60,${0.04 + rand() * 0.05})`;
    ctx.lineWidth = 1 + rand() * 3;
    ctx.beginPath();
    for (let x = 0; x <= size; x += 16) ctx.lineTo(x, y + Math.sin((x / size) * Math.PI * 2 * (1 + k % 3)) * 6);
    ctx.stroke();
  }
  rockTex = new THREE.CanvasTexture(c);
  rockTex.wrapS = rockTex.wrapT = THREE.RepeatWrapping;
  rockTex.colorSpace = THREE.SRGBColorSpace;
  rockTex.anisotropy = 8;
  return rockTex;
}
