import type { GridSpec } from '../model/floorField';

/** 4-connected clusters of cells where `mask` is set. Clusters smaller than `minCells` are dropped. */
export function clusterCells(g: GridSpec, mask: Uint8Array, minCells = 4): Int32Array[] {
  const { nx, ny } = g;
  const seen = new Uint8Array(mask.length);
  const out: Int32Array[] = [];
  const stack: number[] = [];
  for (let k0 = 0; k0 < mask.length; k0++) {
    if (!mask[k0] || seen[k0]) continue;
    const cells: number[] = [];
    stack.push(k0);
    seen[k0] = 1;
    while (stack.length) {
      const k = stack.pop()!;
      cells.push(k);
      const i = k % nx;
      const j = (k - i) / nx;
      const nb = [i > 0 ? k - 1 : -1, i < nx - 1 ? k + 1 : -1, j > 0 ? k - nx : -1, j < ny - 1 ? k + nx : -1];
      for (const n of nb) {
        if (n >= 0 && mask[n] && !seen[n]) {
          seen[n] = 1;
          stack.push(n);
        }
      }
    }
    if (cells.length >= minCells) out.push(Int32Array.from(cells));
  }
  return out.sort((a, b) => b.length - a.length);
}

/** The cell with the largest value of `score` within a cluster. */
export function argMax(cells: Int32Array, score: (k: number) => number): number {
  let best = cells[0];
  let bv = -Infinity;
  for (const k of cells) {
    const v = score(k);
    if (v > bv) {
      bv = v;
      best = k;
    }
  }
  return best;
}

/**
 * Merge clusters whose worst cells lie within `radius` meters of each other, so one sculpted
 * pit or one steep transition reads as one warning rather than several fragments.
 */
export function mergeNearby(g: GridSpec, clusters: Int32Array[], score: (k: number) => number, radius: number): Int32Array[] {
  const groups: Array<{ worst: number; parts: Int32Array[] }> = [];
  const pos = (k: number) => ({ x: (k % g.nx) * g.cell, y: Math.floor(k / g.nx) * g.cell });
  for (const c of clusters) {
    const w = argMax(c, score);
    const p = pos(w);
    const hit = groups.find((gr) => {
      const q = pos(gr.worst);
      return Math.hypot(p.x - q.x, p.y - q.y) <= radius;
    });
    if (hit) {
      hit.parts.push(c);
      if (score(w) > score(hit.worst)) hit.worst = w;
    } else groups.push({ worst: w, parts: [c] });
  }
  return groups.map((gr) => {
    const total = gr.parts.reduce((n, p) => n + p.length, 0);
    const out = new Int32Array(total);
    let o = 0;
    for (const p of gr.parts) {
      out.set(p, o);
      o += p.length;
    }
    return out;
  });
}
