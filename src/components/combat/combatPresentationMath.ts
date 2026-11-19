export interface CurveKeyframe {
  readonly t: number;
  readonly v: number;
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value <= 0 ? 0 : value >= 1 ? 1 : value;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep01(t: number): number {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

/** Weighty deceleration curve without overshoot */
export function easeOutCubic(t: number): number {
  const x = clamp01(t);
  return 1 - Math.pow(1 - x, 3);
}

/** Smooth S-curve return used for Phase D camera & formation reset */
export function easeInOutCubic(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** Crisp snap-in curve completing 95%+ of travel in 0.12s-0.15s */
export function easeOutExpo(t: number): number {
  const x = clamp01(t);
  return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
}

/** Snappy spring-settle curve for 1.25x -> 1.0x attack scale punch */
export function easeOutElastic(t: number): number {
  const x = clamp01(t);
  if (x === 0 || x === 1) return x;
  const c4 = (2 * Math.PI) / 3;
  return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
}

/**
 * Evaluates a sorted array of normalized keyframes ({ t: [0..1], v: number })
 * using smooth cubic Hermite-style easing between segments.
 */
export function evaluateCurve(keyframes: readonly CurveKeyframe[], u: number): number {
  if (keyframes.length === 0) return 0;
  if (keyframes.length === 1) return keyframes[0].v;
  const x = clamp01(u);
  if (x <= keyframes[0].t) return keyframes[0].v;
  const last = keyframes[keyframes.length - 1];
  if (x >= last.t) return last.v;

  for (let i = 0; i < keyframes.length - 1; i++) {
    const a = keyframes[i];
    const b = keyframes[i + 1];
    if (x <= b.t) {
      const span = Math.max(0.0001, b.t - a.t);
      const localT = clamp01((x - a.t) / span);
      return lerp(a.v, b.v, smoothstep01(localT));
    }
  }
  return last.v;
}

// Deterministic 1D gradient noise table for smooth organic trauma camera shake
const PERM_LEN = 256;
const GRAD_1D = new Float32Array(PERM_LEN);
for (let i = 0; i < PERM_LEN; i++) {
  // Golden-ratio Weyl hash mapped symmetrically into [-1, 1]
  const h = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  const frac = h - Math.floor(h);
  GRAD_1D[i] = frac * 2 - 1;
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function gradAt(ix: number): number {
  const wrapped = ((ix % PERM_LEN) + PERM_LEN) % PERM_LEN;
  return GRAD_1D[wrapped];
}

/**
 * Continuous 1D Perlin-style gradient noise returning smoothly bounded values in ~[-1, 1].
 */
export function perlinNoise1D(x: number): number {
  const i0 = Math.floor(x);
  const f = x - i0;
  const u = fade(f);
  const g0 = gradAt(i0) * f;
  const g1 = gradAt(i0 + 1) * (f - 1);
  // Scale up slightly because 1D gradient endpoints vanish at grid points; clamped safely to [-1, 1]
  return Math.max(-1, Math.min(1, lerp(g0, g1, u) * 1.95));
}
