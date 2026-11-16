import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createNaniteParticlePool,
  emitFloorProjectorSparks,
  emitScanlineMotes,
  emitSyringeBiogel,
  emitTransitionStream,
  spawnParticle,
  updateNaniteParticles,
} from './bioNaniteParticles';

test('createNaniteParticlePool initializes fixed inactive particle buffer', () => {
  const pool = createNaniteParticlePool(50);
  assert.equal(pool.maxCount, 50);
  assert.equal(pool.particles.length, 50);
  for (const p of pool.particles) {
    assert.equal(p.active, false);
  }
});

test('spawnParticle activates particle with clamped lifetime and parsed RGB', () => {
  const pool = createNaniteParticlePool(10);
  const ok = spawnParticle(pool, {
    x: 100,
    y: 200,
    vx: 5,
    vy: -10,
    size: 3,
    maxLife: 0.5,
    colorRgb: '16, 245, 160',
    kind: 'sparkle',
  });
  assert.equal(ok, true);
  const activeCount = pool.particles.filter((p) => p.active).length;
  assert.equal(activeCount, 1);
  const p = pool.particles[0];
  assert.equal(p.x, 100);
  assert.equal(p.y, 200);
  assert.equal(p.r, 16);
  assert.equal(p.g, 245);
  assert.equal(p.b, 160);
});

test('emitTransitionStream generates bridge particles between two coordinates', () => {
  const pool = createNaniteParticlePool(30);
  emitTransitionStream(pool, 50, 100, 150, 200, '255, 46, 166', 10);
  const active = pool.particles.filter((p) => p.active);
  assert.ok(active.length >= 8, `Expected at least 8 particles emitted, got ${active.length}`);
  for (const p of active) {
    assert.equal(p.kind, 'streamer');
    assert.ok(p.x >= 40 && p.x <= 160, `Particle X out of bounds: ${p.x}`);
  }
});

test('updateNaniteParticles advances physics and recycles expired particles', () => {
  const pool = createNaniteParticlePool(10);
  spawnParticle(pool, {
    x: 0,
    y: 0,
    vx: 100,
    vy: 100,
    size: 2,
    maxLife: 0.1,
    colorRgb: '0, 240, 255',
    kind: 'droplet',
  });
  assert.equal(pool.particles[0].active, true);

  // Advance half life
  updateNaniteParticles(pool, 0.05);
  assert.equal(pool.particles[0].active, true);
  assert.ok(pool.particles[0].x > 0);
  assert.ok(pool.particles[0].alpha < 1);

  // Advance past expiration
  updateNaniteParticles(pool, 0.08);
  assert.equal(pool.particles[0].active, false);
});

test('emitSyringeBiogel and scanline motes respect pool boundaries without overflow', () => {
  const pool = createNaniteParticlePool(15);
  for (let i = 0; i < 50; i++) {
    emitSyringeBiogel(pool, 200, 100, '16, 245, 160', 0.5);
    emitScanlineMotes(pool, 200, 150, 80, '16, 245, 160', 0.5);
    emitFloorProjectorSparks(pool, 200, 400, 50, '16, 245, 160', 0.5);
  }
  const active = pool.particles.filter((p) => p.active);
  assert.ok(active.length <= pool.maxCount);
});
