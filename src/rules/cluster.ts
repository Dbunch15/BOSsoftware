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
