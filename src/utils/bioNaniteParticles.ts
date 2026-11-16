export interface NaniteParticle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
  r: number;
  g: number;
  b: number;
  kind: 'sparkle' | 'droplet' | 'streamer' | 'scan_mote' | 'floor_spark';
}

export interface NaniteParticlePool {
  particles: NaniteParticle[];
  maxCount: number;
}

export function createNaniteParticlePool(maxCount = 120): NaniteParticlePool {
  const particles: NaniteParticle[] = [];
  for (let i = 0; i < maxCount; i++) {
    particles.push({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      size: 2,
      alpha: 1,
      life: 0,
      maxLife: 1,
      r: 16,
      g: 245,
      b: 160,
      kind: 'sparkle',
    });
  }
  return { particles, maxCount };
}

function parseRgb(colorRgb: string): [number, number, number] {
  const parts = colorRgb.split(',').map((s) => Number.parseInt(s.trim(), 10));
  return [parts[0] || 16, parts[1] || 245, parts[2] || 160];
}

export function spawnParticle(
  pool: NaniteParticlePool,
  params: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    maxLife: number;
    colorRgb: string;
    kind: NaniteParticle['kind'];
  },
): boolean {
  for (let i = 0; i < pool.maxCount; i++) {
    const p = pool.particles[i];
    if (!p.active) {
      const [r, g, b] = parseRgb(params.colorRgb);
      p.active = true;
      p.x = params.x;
      p.y = params.y;
      p.vx = params.vx;
      p.vy = params.vy;
      p.size = params.size;
      p.alpha = 1;
      p.life = 0;
      p.maxLife = Math.max(0.05, params.maxLife);
      p.r = r;
      p.g = g;
      p.b = b;
      p.kind = params.kind;
      return true;
    }
  }
  return false;
}

/**
 * Emits continuous scintillating sparks and biogel droplets from Dr. Amara's syringe needle.
 */
export function emitSyringeBiogel(
  pool: NaniteParticlePool,
  needleX: number,
  needleY: number,
  colorRgb: string,
  dt: number,
): void {
  // Probabilistic emission proportional to delta time (~18 sparks/sec)
  const spawnChance = dt * 18;
  if (Math.random() < spawnChance) {
    const angle = -Math.PI * 0.5 + (Math.random() - 0.5) * 1.2;
    const speed = 12 + Math.random() * 26;
    spawnParticle(pool, {
      x: needleX + (Math.random() - 0.5) * 4,
      y: needleY + (Math.random() - 0.5) * 4,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 8,
      size: 1.5 + Math.random() * 2.5,
      maxLife: 0.6 + Math.random() * 0.5,
      colorRgb,
      kind: Math.random() > 0.4 ? 'sparkle' : 'droplet',
    });
  }
}

/**
 * Emits a burst of nanite streamers bridging the motion path between the previous limb position
 * and the target limb position to provide persistence of vision across discrete frame transitions.
 */
export function emitTransitionStream(
  pool: NaniteParticlePool,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  colorRgb: string,
  count = 14,
): void {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const dist = Math.hypot(dx, dy);

  for (let i = 0; i < count; i++) {
    const progress = (i + Math.random() * 0.5) / count;
    // Base position along motion curve
    const bx = fromX + dx * progress;
    const by = fromY + dy * progress;
    // Perpendicular flutter
    const perpX = -dy / Math.max(1, dist);
    const perpY = dx / Math.max(1, dist);
    const flutter = (Math.random() - 0.5) * 14;

    spawnParticle(pool, {
      x: bx + perpX * flutter,
      y: by + perpY * flutter,
      vx: (dx / 0.35) * 0.2 + (Math.random() - 0.5) * 16,
      vy: (dy / 0.35) * 0.2 - 12 + (Math.random() - 0.5) * 14,
      size: 2.2 + Math.random() * 2.8,
      maxLife: 0.4 + Math.random() * 0.3,
      colorRgb,
      kind: 'streamer',
    });
  }
}

/**
 * Emits holographic scanning beam motes that float upwards as the laser scan passes through the silhouette.
 */
export function emitScanlineMotes(
  pool: NaniteParticlePool,
  centerX: number,
  scanY: number,
  width: number,
  colorRgb: string,
  dt: number,
): void {
  const spawnCount = Math.floor(dt * 30 + Math.random());
  for (let i = 0; i < spawnCount; i++) {
    const x = centerX + (Math.random() - 0.5) * width;
    spawnParticle(pool, {
      x,
      y: scanY + (Math.random() - 0.5) * 3,
      vx: (Math.random() - 0.5) * 8,
      vy: -15 - Math.random() * 25,
      size: 1.2 + Math.random() * 1.8,
      maxLife: 0.5 + Math.random() * 0.4,
      colorRgb,
      kind: 'scan_mote',
    });
  }
}

/**
 * Emits rising holographic sparks from the circular floor projector pad.
 */
export function emitFloorProjectorSparks(
  pool: NaniteParticlePool,
  centerX: number,
  groundY: number,
  radiusX: number,
  colorRgb: string,
  dt: number,
): void {
  const spawnChance = dt * 14;
  if (Math.random() < spawnChance) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * radiusX;
    spawnParticle(pool, {
      x: centerX + Math.cos(angle) * r,
      y: groundY + Math.sin(angle) * (r * 0.28),
      vx: (Math.random() - 0.5) * 6,
      vy: -20 - Math.random() * 30,
      size: 1.4 + Math.random() * 1.8,
      maxLife: 0.6 + Math.random() * 0.4,
      colorRgb,
      kind: 'floor_spark',
    });
  }
}

/**
 * Updates all active particles in place with zero allocation.
 */
export function updateNaniteParticles(pool: NaniteParticlePool, dt: number): void {
  const safeDt = Math.min(0.06, Math.max(0.001, dt));

  for (let i = 0; i < pool.maxCount; i++) {
    const p = pool.particles[i];
    if (!p.active) continue;

    p.life += safeDt;
    if (p.life >= p.maxLife) {
      p.active = false;
      continue;
    }

    const progress = p.life / p.maxLife;
    // Cubic fade-out curve for natural luminescence decay
    p.alpha = Math.max(0, 1 - progress * progress);

    p.x += p.vx * safeDt;
    p.y += p.vy * safeDt;

    // Gentle upward buoyancy & atmospheric air resistance
    p.vx *= 0.96;
    if (p.kind === 'droplet') {
      p.vy += 28 * safeDt; // slight gravity for liquid biogel
    } else {
      p.vy *= 0.94; // floating plasma motes
    }
  }
}

/**
 * Renders all active particles onto the canvas with high-efficiency Canvas 2D calls.
 */
export function renderNaniteParticles(ctx: CanvasRenderingContext2D, pool: NaniteParticlePool): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter'; // Additive blending for vivid cyberpunk glow

  for (let i = 0; i < pool.maxCount; i++) {
    const p = pool.particles[i];
    if (!p.active || p.alpha <= 0.01) continue;

    const rgbStr = `${p.r}, ${p.g}, ${p.b}`;

    if (p.kind === 'sparkle' || p.kind === 'streamer') {
      // Diamond star sparkle
      const s = p.size;
      ctx.fillStyle = `rgba(${rgbStr}, ${p.alpha * 0.9})`;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - s * 1.4);
      ctx.lineTo(p.x + s * 0.7, p.y);
      ctx.lineTo(p.x, p.y + s * 1.4);
      ctx.lineTo(p.x - s * 0.7, p.y);
      ctx.closePath();
      ctx.fill();

      // Core white-hot pinpoint
      ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha * 0.85})`;
      ctx.fillRect(p.x - 0.75, p.y - 0.75, 1.5, 1.5);
    } else {
      // Glowing round particle / biogel droplet
      const s = p.size;
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, s * 1.8);
      grad.addColorStop(0, `rgba(255, 255, 255, ${p.alpha * 0.9})`);
      grad.addColorStop(0.4, `rgba(${rgbStr}, ${p.alpha * 0.7})`);
      grad.addColorStop(1, `rgba(${rgbStr}, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, s * 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}
