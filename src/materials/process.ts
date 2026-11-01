/**
 * Pure pixel processing for turning a photo of a physical finish sample into tileable PBR maps.
 * Works on plain RGBA buffers so it runs in a Web Worker and in unit tests alike.
 */

export interface Img {
  w: number;
  h: number;
  /** RGBA, row-major. */
  data: Uint8ClampedArray;
}

export const makeImg = (w: number, h: number): Img => ({ w, h, data: new Uint8ClampedArray(w * h * 4) });

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/**
 * Make an image tile seamlessly: cross-fade it with a half-offset copy of itself. The original is
 * kept in the middle (where the offset copy has its seams) and the offset copy at the borders
 * (which it makes continuous across the wrap). `blend` is the fade width as a fraction of size.
 */
export function makeSeamless(src: Img, blend = 0.22): Img {
  const { w, h, data } = src;
  const out = makeImg(w, h);
  const ramp = (u: number) => smooth(0, blend, Math.min(u, 1 - u));
  const hw = w >> 1;
  const hh = h >> 1;
  for (let y = 0; y < h; y++) {
    const my = ramp((y + 0.5) / h);
    const oy = (y + hh) % h;
    for (let x = 0; x < w; x++) {
      const m = Math.min(my, ramp((x + 0.5) / w));
      const ox = (x + hw) % w;
      const a = (y * w + x) * 4;
      const b = (oy * w + ox) * 4;
      for (let c = 0; c < 3; c++) out.data[a + c] = data[b + c] + (data[a + c] - data[b + c]) * m;
      out.data[a + 3] = 255;
    }
  }
  return out;
}

/** Rec. 709 luminance in 0..1. */
export function luminance(img: Img): Float32Array {
  const n = img.w * img.h;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    out[i] = (0.2126 * img.data[o] + 0.7152 * img.data[o + 1] + 0.0722 * img.data[o + 2]) / 255;
  }
  return out;
}

/** Wrapping separable box blur (radius in pixels), O(n) per pass. */
export function boxBlurWrap(src: Float32Array, w: number, h: number, r: number): Float32Array {
  if (r < 1) return src.slice();
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const k = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let acc = 0;
    for (let i = -r; i <= r; i++) acc += src[row + ((i % w) + w) % w];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc / k;
      acc += src[row + ((x + r + 1) % w)] - src[row + (((x - r) % w) + w) % w];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let i = -r; i <= r; i++) acc += tmp[(((i % h) + h) % h) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / k;
      acc += tmp[((y + r + 1) % h) * w + x] - tmp[((((y - r) % h) + h) % h) * w + x];
    }
  }
  return out;
}

/**
 * Height map from a photo: fine luminance detail (grains, pores) with the broad lighting removed,
 * normalised to 0..1. Assumes darker = lower, which holds for bonded aggregate under even light.
 */
export function heightFromPhoto(img: Img): Float32Array {
  const { w, h } = img;
  const lum = luminance(img);
  const fine = boxBlurWrap(lum, w, h, Math.max(1, Math.round(w / 1024)));
  const broad = boxBlurWrap(boxBlurWrap(lum, w, h, Math.round(w / 24)), w, h, Math.round(w / 24));
  let lo = Infinity;
  let hi = -Infinity;
  const out = new Float32Array(lum.length);
  for (let i = 0; i < out.length; i++) {
    const v = fine[i] - broad[i];
    out[i] = v;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const span = hi - lo || 1;
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - lo) / span;
  return out;
}

/** Tangent-space normal map (OpenGL convention, +Y up) from a wrapping height map. */
export function normalFromHeight(height: Float32Array, w: number, h: number, strength = 2): Img {
  const out = makeImg(w, h);
  for (let y = 0; y < h; y++) {
    const yu = ((y - 1 + h) % h) * w;
    const yd = ((y + 1) % h) * w;
    for (let x = 0; x < w; x++) {
      const xl = (x - 1 + w) % w;
      const xr = (x + 1) % w;
      // Sobel gradients.
      const tl = height[yu + xl];
      const t = height[yu + x];
      const tr = height[yu + xr];
      const l = height[y * w + xl];
      const r = height[y * w + xr];
      const bl = height[yd + xl];
      const b = height[yd + x];
      const br = height[yd + xr];
      const dx = tr + 2 * r + br - (tl + 2 * l + bl);
      const dy = bl + 2 * b + br - (tl + 2 * t + tr);
      // Image rows run down; +Y in tangent space is up the texture.
      const nx = -dx * strength;
      const ny = dy * strength;
      const len = Math.hypot(nx, ny, 1);
      const o = (y * w + x) * 4;
      out.data[o] = ((nx / len) * 0.5 + 0.5) * 255;
      out.data[o + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      out.data[o + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      out.data[o + 3] = 255;
    }
  }
  return out;
}

/**
 * Roughness map (green channel, as three.js reads it): a base roughness, slightly lower on the
 * bright, glassy quartz grains and higher in the darker binder between them.
 */
export function roughnessFromHeight(height: Float32Array, w: number, h: number, base = 0.82): Img {
  const out = makeImg(w, h);
  for (let i = 0; i < height.length; i++) {
    const r = Math.min(1, Math.max(0.05, base + (0.5 - height[i]) * 0.3));
    const v = r * 255;
    const o = i * 4;
    out.data[o] = v;
    out.data[o + 1] = v;
    out.data[o + 2] = v;
    out.data[o + 3] = 255;
  }
  return out;
}

/** Mean sRGB color as #rrggbb (for swatches). */
export function meanColor(img: Img): string {
  let r = 0;
  let g = 0;
  let b = 0;
  const n = img.w * img.h;
  for (let i = 0; i < n; i++) {
    r += img.data[i * 4];
    g += img.data[i * 4 + 1];
    b += img.data[i * 4 + 2];
  }
  const hex = (v: number) => Math.round(v / n).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/**
 * Even out lighting falloff across a photo (vignetting, a lamp off to one side) by dividing out a
 * very broad blur of each channel, then restoring the image's mean brightness.
 */
export function flattenLighting(src: Img): Img {
  const { w, h, data } = src;
  const out = makeImg(w, h);
  const r = Math.max(2, Math.round(w / 6));
  for (let c = 0; c < 3; c++) {
    const ch = new Float32Array(w * h);
    let mean = 0;
    for (let i = 0; i < ch.length; i++) {
      ch[i] = data[i * 4 + c];
      mean += ch[i];
    }
    mean /= ch.length;
    const broad = boxBlurWrap(boxBlurWrap(ch, w, h, r), w, h, r);
    for (let i = 0; i < ch.length; i++) out.data[i * 4 + c] = (ch[i] / Math.max(1, broad[i])) * mean;
  }
  for (let i = 0; i < w * h; i++) out.data[i * 4 + 3] = 255;
  return out;
}

export interface ProcessedMaps {
  albedo: Img;
  normal: Img;
  roughness: Img;
  mean: string;
}

/** Full pipeline on an already square-cropped, resized photo. */
export function processSample(photo: Img, opts: { flatten?: boolean; normalStrength?: number; baseRoughness?: number } = {}): ProcessedMaps {
  const lit = opts.flatten === false ? photo : flattenLighting(photo);
  const albedo = makeSeamless(lit);
  const height = heightFromPhoto(albedo);
  return {
    albedo,
    normal: normalFromHeight(height, albedo.w, albedo.h, opts.normalStrength ?? 2.5),
    roughness: roughnessFromHeight(height, albedo.w, albedo.h, opts.baseRoughness ?? 0.82),
    mean: meanColor(albedo),
  };
}
