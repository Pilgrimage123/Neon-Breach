export interface ChromaGreenOptions {
  /** Minimum green excess `G - max(R, B)` cleared to full transparency (default: 28). */
  chromaThreshold?: number;
  /** Clamp residual green spill `G = max(R, B)` on semi-transparent fringe pixels (default: true). */
  spillClamp?: boolean;
}

/**
 * Removes solid flat chroma-green (`#00D856`) backdrops while preserving bright white
 * medical uniforms, red crosses, and dark necrotic limbs without white-pocket erosion.
 */
export function cleanChromaGreenData(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options?: ChromaGreenOptions,
): void {
  const threshold = Math.max(1, options?.chromaThreshold ?? 28);
  const spillClamp = options?.spillClamp ?? true;
  const totalPixels = Math.min(width * height, Math.floor(data.length / 4));

  for (let i = 0; i < totalPixels; i++) {
    const p = i * 4;
    const a = data[p + 3];
    if (a === 0) continue;

    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    const maxRB = r > b ? r : b;
    const greenExcess = g - maxRB;

    if (greenExcess > threshold) {
      data[p] = 0;
      data[p + 1] = 0;
      data[p + 2] = 0;
      data[p + 3] = 0;
    } else if (greenExcess > 0 && spillClamp) {
      data[p + 1] = maxRB;
      data[p + 3] = Math.round(a * Math.max(0, 1 - greenExcess / threshold));
    }
  }
}
