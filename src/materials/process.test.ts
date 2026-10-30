import { describe, expect, it } from 'vitest';
import { type Img, boxBlurWrap, makeImg, makeSeamless, meanColor, normalFromHeight, processSample } from './process';

/** Smooth but non-periodic test image: a diagonal gradient plus a soft blob. */
function photo(w: number, h: number): Img {
  const img = makeImg(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const blob = 60 * Math.exp(-(((x - w * 0.3) ** 2 + (y - h * 0.6) ** 2) / (w * w * 0.02)));
      img.data[o] = 60 + (150 * x) / w + blob;
      img.data[o + 1] = 80 + (120 * y) / h;
      img.data[o + 2] = 100 + blob;
      img.data[o + 3] = 255;
    }
  return img;
}

const px = (img: Img, x: number, y: number) => Array.from(img.data.slice((y * img.w + x) * 4, (y * img.w + x) * 4 + 3));
const maxEdgeJump = (img: Img) => {
  let m = 0;
  for (let y = 0; y < img.h; y++) {
    const a = px(img, 0, y);
    const b = px(img, img.w - 1, y);
    m = Math.max(m, ...a.map((v, i) => Math.abs(v - b[i])));
  }
  for (let x = 0; x < img.w; x++) {
    const a = px(img, x, 0);
    const b = px(img, x, img.h - 1);
    m = Math.max(m, ...a.map((v, i) => Math.abs(v - b[i])));
  }
  return m;
};

describe('photo → tileable finish maps', () => {
  it('removes the wrap-around seam', () => {
    const src = photo(128, 128);
    expect(maxEdgeJump(src)).toBeGreaterThan(100);
    const tiled = makeSeamless(src);
    expect(maxEdgeJump(tiled)).toBeLessThan(6);
  });

  it('keeps the middle of the photo untouched', () => {
    const src = photo(128, 128);
    const tiled = makeSeamless(src);
    expect(px(tiled, 64, 64)).toEqual(px(src, 64, 64));
  });

  it('flat height gives a straight-up normal; a ramp tilts it', () => {
    const w = 16;
    const flat = normalFromHeight(new Float32Array(w * w).fill(0.5), w, w);
    expect(px(flat, 5, 5)).toEqual([128, 128, 255]);
    const ramp = new Float32Array(w * w);
    for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) ramp[y * w + x] = (x % w) / w;
    const n = normalFromHeight(ramp, w, w);
    const [r, , b] = px(n, 6, 6);
    expect(r).toBeLessThan(128); // surface rising to +x tilts the normal toward -x
    expect(b).toBeLessThan(255);
  });

  it('box blur preserves the mean and wraps', () => {
    const w = 32;
    const src = new Float32Array(w * w).map((_, i) => (i * 7919) % 13);
    const out = boxBlurWrap(src, w, w, 3);
    const mean = (a: Float32Array) => a.reduce((s, v) => s + v, 0) / a.length;
    expect(mean(out)).toBeCloseTo(mean(src), 4);
  });

  it('full pipeline yields same-size seamless maps and a swatch color', () => {
    const maps = processSample(photo(96, 96));
    expect(maps.albedo.w).toBe(96);
    expect(maps.normal.data.length).toBe(96 * 96 * 4);
    expect(maps.roughness.data[1]).toBeGreaterThan(0);
    expect(maxEdgeJump(maps.albedo)).toBeLessThan(8);
    expect(maps.mean).toMatch(/^#[0-9a-f]{6}$/);
    expect(meanColor(maps.albedo)).toBe(maps.mean);
  });
});
