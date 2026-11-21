import {
  type ScratchBuffers,
  type SpriteCutoutOptions,
  applyColorGradingData,
  createScratchBuffers,
  floodFillBorderBackground,
  prepareScratchBuffers,
} from './spriteCutoutBounds';

function isNearDarkPixel(data: Uint8ClampedArray, idx: number, w: number, h: number): boolean {
  const p = idx * 4;
  if (data[p + 3] < 20) return true;
  const r = data[p];
  const g = data[p + 1];
  const b = data[p + 2];
  const maxC = r > g ? (r > b ? r : b) : g > b ? g : b;
  // Pure / near-pure sheet gutter black (<= 8) stops cleanly at Zuri's >= 10 dark ink outlines
  if (maxC <= 8) return true;
  const x = idx % w;
  const y = (idx - x) / w;
  // Near top/bottom crop edges, clear faint dark-red glow from horizontal sheet divider lines
  if ((y <= 7 || y >= h - 11) && r <= 88 && g <= 16 && b <= 20 && r >= g + 6) {
    return true;
  }
  // Near left/right crop edges, clear faint red halo from adjacent label boxes
  if ((x <= 5 || x >= w - 6) && r <= 42 && g <= 10 && b <= 14) {
    return true;
  }
  return false;
}

function buildInteriorDarkGuard(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  total: number,
  scratch: ScratchBuffers,
  comp: Int32Array,
): Uint8Array {
  const { visited, removed, queue } = scratch;
  visited.fill(0, 0, total);
  const prot = new Uint8Array(total);
  let pTail = 0;

  for (let i = 0; i < total; i++) {
    if (removed[i] || visited[i]) continue;
    const p = i * 4;
    if (Math.max(data[p], data[p + 1], data[p + 2]) > 7) continue;
    let cHead = 0;
    let cTail = 0;
    visited[i] = 1;
    comp[cTail++] = i;
    while (cHead < cTail) {
      const u = comp[cHead++];
      const ux = u % w;
      const uy = (u - ux) / w;
      const tryN = (n: number) => {
        if (!removed[n] && !visited[n]) {
          const np = n * 4;
          if (Math.max(data[np], data[np + 1], data[np + 2]) <= 7) {
            visited[n] = 1;
            comp[cTail++] = n;
          }
        }
      };
      if (ux > 0) tryN(u - 1);
      if (ux < w - 1) tryN(u + 1);
      if (uy > 0) tryN(u - w);
      if (uy < h - 1) tryN(u + w);
    }
    if (cTail >= 8) {
      for (let k = 0; k < cTail; k++) {
        const u = comp[k];
        prot[u] = 1;
        queue[pTail++] = u;
      }
    }
  }

  let pHead = 0;
  while (pHead < pTail) {
    const i = queue[pHead++];
    const d = prot[i];
    if (d >= 4) continue;
    const x = i % w;
    const y = (i - x) / w;
    const push = (n: number) => {
      if (!removed[n] && !prot[n]) {
        prot[n] = d + 1;
        queue[pTail++] = n;
      }
    };
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (y > 0) push(i - w);
    if (y < h - 1) push(i + w);
  }

  return prot;
}

function peelDarkHaloAndEdge(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  total: number,
  scratch: ScratchBuffers,
  prot: Uint8Array,
): void {
  const { visited, removed, queue } = scratch;
  visited.fill(0, 0, total);
  const dist = new Uint8Array(total);
  let h2 = 0;
  let t2 = 0;
  const tryEnqueueHalo = (n: number, d: number) => {
    if (visited[n] || removed[n] || prot[n] || d > 56) return;
    const p = n * 4;
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    const maxC = r > g ? (r > b ? r : b) : g > b ? g : b;
    if (maxC <= 14 || (maxC <= 28 && g <= 5 && b <= 12) || (r <= 66 && g <= 4 && b <= 13)) {
      visited[n] = 1;
      dist[n] = d;
      queue[t2++] = n;
    }
  };
  for (let i = 0; i < total; i++) {
    if (!removed[i]) continue;
    const x = i % w;
    const y = (i - x) / w;
    if (x > 0) tryEnqueueHalo(i - 1, 1);
    if (x < w - 1) tryEnqueueHalo(i + 1, 1);
    if (y > 0) tryEnqueueHalo(i - w, 1);
    if (y < h - 1) tryEnqueueHalo(i + w, 1);
  }
  while (h2 < t2) {
    const i = queue[h2++];
    const d = dist[i];
    const x = i % w;
    const y = (i - x) / w;
    removed[i] = 1;
    data[i * 4 + 3] = 0;
    if (x > 0) tryEnqueueHalo(i - 1, d + 1);
    if (x < w - 1) tryEnqueueHalo(i + 1, d + 1);
    if (y > 0) tryEnqueueHalo(i - w, d + 1);
    if (y < h - 1) tryEnqueueHalo(i + w, d + 1);
  }

  visited.fill(0, 0, total);
  let h3 = 0;
  let t3 = 0;
  const tryEnqueueDarkEdge = (n: number, d: number) => {
    if (visited[n] || removed[n] || prot[n] || d > 3) return;
    const p = n * 4;
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    const maxC = r > g ? (r > b ? r : b) : g > b ? g : b;
    if (maxC <= 56 && g <= 16 && b <= 22) {
      visited[n] = 1;
      dist[n] = d;
      queue[t3++] = n;
    }
  };
  for (let i = 0; i < total; i++) {
    if (!removed[i]) continue;
    const x = i % w;
    const y = (i - x) / w;
    if (x > 0) tryEnqueueDarkEdge(i - 1, 1);
    if (x < w - 1) tryEnqueueDarkEdge(i + 1, 1);
    if (y > 0) tryEnqueueDarkEdge(i - w, 1);
    if (y < h - 1) tryEnqueueDarkEdge(i + w, 1);
  }
  while (h3 < t3) {
    const i = queue[h3++];
    const d = dist[i];
    const p = i * 4;
    const maxC = Math.max(data[p], data[p + 1], data[p + 2]);
    const minFade = d === 1 ? 0.18 : 0.52;
    const fade = Math.max(minFade, Math.min(1, (maxC - 16) / 36));
    data[p + 3] = Math.round(data[p + 3] * fade);
    const x = i % w;
    const y = (i - x) / w;
    if (x > 0) tryEnqueueDarkEdge(i - 1, d + 1);
    if (x < w - 1) tryEnqueueDarkEdge(i + 1, d + 1);
    if (y > 0) tryEnqueueDarkEdge(i - w, d + 1);
    if (y < h - 1) tryEnqueueDarkEdge(i + w, d + 1);
  }
}

function unmixForwardHoloGlass(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  removed: Uint8Array,
  prot: Uint8Array,
): void {
  const holoMinX = Math.floor(w * 0.48);
  const holoMaxY = Math.floor(h * 0.94);
  for (let y = 0; y < holoMaxY; y++) {
    const rowOff = y * w;
    for (let x = holoMinX; x < w; x++) {
      const i = rowOff + x;
      if (removed[i] || prot[i]) continue;
      const p = i * 4;
      if (data[p + 3] < 140) continue;
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      const isDarkHoloGlass =
        y < h * 0.48 && r >= 18 && r <= 140 && g <= 14 && b <= 28 && r > g * 2.8;
      const isDarkShieldCell =
        b >= 16 && b <= 148 && r <= 96 && g <= 44 && b > g * 1.5 && b >= r;
      if (isDarkHoloGlass || isDarkShieldCell) {
        const peak = Math.max(r, b);
        data[p + 3] = Math.max(134, Math.min(data[p + 3], Math.round(134 + (peak / 148) * 76)));
      }
    }
  }
}

function removeIsolatedDarkSpecks(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  total: number,
  scratch: ScratchBuffers,
  comp: Int32Array,
): void {
  const { visited, removed } = scratch;
  visited.fill(0, 0, total);
  for (let i = 0; i < total; i++) {
    if (removed[i] || visited[i] || data[i * 4 + 3] === 0) continue;
    let cHead = 0;
    let cTail = 0;
    visited[i] = 1;
    comp[cTail++] = i;
    while (cHead < cTail) {
      const u = comp[cHead++];
      const ux = u % w;
      const uy = (u - ux) / w;
      const push = (n: number) => {
        if (!removed[n] && !visited[n] && data[n * 4 + 3] > 0) {
          visited[n] = 1;
          comp[cTail++] = n;
        }
      };
      if (ux > 0) push(u - 1);
      if (ux < w - 1) push(u + 1);
      if (uy > 0) push(u - w);
      if (uy < h - 1) push(u + w);
    }
    if (cTail <= 28) {
      let maxVal = 0;
      for (let k = 0; k < cTail; k++) {
        const p = comp[k] * 4;
        maxVal = Math.max(maxVal, data[p], data[p + 1], data[p + 2]);
      }
      if (maxVal <= 50) {
        for (let k = 0; k < cTail; k++) {
          removed[comp[k]] = 1;
          data[comp[k] * 4 + 3] = 0;
        }
      }
    }
  }
}

export function cleanDarkBackgroundData(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  options?: SpriteCutoutOptions,
  scratchArg?: ScratchBuffers,
): void {
  if (w <= 0 || h <= 0) return;

  const total = w * h;
  const scratch = prepareScratchBuffers(scratchArg ?? createScratchBuffers(total), total);
  floodFillBorderBackground(data, w, h, scratch, (idx) => isNearDarkPixel(data, idx, w, h));

  const comp = new Int32Array(total);
  const prot = buildInteriorDarkGuard(data, w, h, total, scratch, comp);
  peelDarkHaloAndEdge(data, w, h, total, scratch, prot);

  if (options?.unmixDarkHoloGlass) {
    unmixForwardHoloGlass(data, w, h, scratch.removed, prot);
  }

  removeIsolatedDarkSpecks(data, w, h, total, scratch, comp);

  if (options?.saturationScale !== undefined || options?.crimsonDampen !== undefined) {
    applyColorGradingData(data, w, h, options);
  }
}
