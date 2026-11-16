import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CRAWLER_ARCH_SCALE,
  CRAWLER_FRAMES_BY_VARIANT,
  isCrawlerArchetype,
  sampleCrawlerFrame,
} from './crawlerSpriteSheet';

test('CRAWLER_FRAMES_BY_VARIANT defines 16 non-overlapping frames inside 2172x724 sheet for all 3 variants', () => {
  for (const variant of ['larva', 'skitter', 'stinger'] as const) {
    const frames = CRAWLER_FRAMES_BY_VARIANT[variant];
    assert.equal(frames.length, 16);
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      assert.equal(f.col, i);
      assert.ok(f.x >= 0 && f.x + f.w <= 2172, `frame ${i} x out of bounds`);
      assert.ok(f.y >= 0 && f.y + f.h <= 724, `frame ${i} y out of bounds`);
      assert.ok(f.anchorX > 0 && f.anchorX < f.w, `frame ${i} anchorX within frame width`);
      assert.ok(f.bottomY > 0 && f.bottomY <= f.h, `frame ${i} bottomY within frame height`);
      if (i > 0) {
        const prev = frames[i - 1];
        assert.equal(f.x, prev.x + prev.w, `frame ${i} should be contiguous with frame ${i - 1}`);
      }
    }
  }
});

test('isCrawlerArchetype and CRAWLER_ARCH_SCALE order filler variants from smallest to largest', () => {
  assert.equal(isCrawlerArchetype('larva'), true);
  assert.equal(isCrawlerArchetype('skitter'), true);
  assert.equal(isCrawlerArchetype('stinger'), true);
  assert.equal(isCrawlerArchetype('stalker'), false);
  assert.ok(CRAWLER_ARCH_SCALE.larva < CRAWLER_ARCH_SCALE.skitter);
  assert.ok(CRAWLER_ARCH_SCALE.skitter < CRAWLER_ARCH_SCALE.stinger);
});

test('sampleCrawlerFrame steps through 8 attack frames (0..7), 4 pain frames (8..11), and 8 collapse frames (8..15)', () => {
  // Idle cycles within 0..2
  for (let t = 0; t < 3; t += 0.15) {
    const idle = sampleCrawlerFrame('larva', undefined, t, 0);
    assert.ok(idle.frameIndex >= 0 && idle.frameIndex <= 2);
    assert.equal(idle.alpha, 1);
  }

  // Attack progresses 0 -> 7
  const atkStart = sampleCrawlerFrame(
    'skitter',
    {
      dead: false,
      koProgress: 0,
      staggerTimer: 0,
      staggerDuration: 0.4,
      attackAnimTimer: 0.48,
      attackAnimDuration: 0.48,
    },
    1.0,
  );
  const atkPeak = sampleCrawlerFrame(
    'skitter',
    {
      dead: false,
      koProgress: 0,
      staggerTimer: 0,
      staggerDuration: 0.4,
      attackAnimTimer: 0.2,
      attackAnimDuration: 0.48,
    },
    1.0,
  );
  const atkEnd = sampleCrawlerFrame(
    'skitter',
    {
      dead: false,
      koProgress: 0,
      staggerTimer: 0,
      staggerDuration: 0.4,
      attackAnimTimer: 0.02,
      attackAnimDuration: 0.48,
    },
    1.0,
  );
  assert.equal(atkStart.frameIndex, 0);
  assert.equal(atkPeak.frameIndex, 4);
  assert.equal(atkEnd.frameIndex, 7);

  // Pain recoil progresses 8 -> 11
  const painStart = sampleCrawlerFrame(
    'stinger',
    {
      dead: false,
      koProgress: 0,
      staggerTimer: 0.4,
      staggerDuration: 0.4,
      attackAnimTimer: 0,
      attackAnimDuration: 0.48,
    },
    1.0,
  );
  const painEnd = sampleCrawlerFrame(
    'stinger',
    {
      dead: false,
      koProgress: 0,
      staggerTimer: 0.05,
      staggerDuration: 0.4,
      attackAnimTimer: 0,
      attackAnimDuration: 0.48,
    },
    1.0,
  );
  assert.equal(painStart.frameIndex, 8);
  assert.equal(painEnd.frameIndex, 11);

  // Death collapse progresses 8 -> 15 and fades at the end
  const koStart = sampleCrawlerFrame(
    'larva',
    {
      dead: true,
      koProgress: 0.02,
      staggerTimer: 0.4,
      staggerDuration: 0.4,
      attackAnimTimer: 0,
      attackAnimDuration: 0.48,
    },
    1.0,
  );
  const koCollapsed = sampleCrawlerFrame(
    'larva',
    {
      dead: true,
      koProgress: 0.78,
      staggerTimer: 0,
      staggerDuration: 0.4,
      attackAnimTimer: 0,
      attackAnimDuration: 0.48,
    },
    1.0,
  );
  const koFaded = sampleCrawlerFrame(
    'larva',
    {
      dead: true,
      koProgress: 1.0,
      staggerTimer: 0,
      staggerDuration: 0.4,
      attackAnimTimer: 0,
      attackAnimDuration: 0.48,
    },
    1.0,
  );
  assert.equal(koStart.frameIndex, 8);
  assert.equal(koCollapsed.frameIndex, 15);
  assert.equal(koCollapsed.alpha, 1);
  assert.equal(koFaded.frameIndex, 15);
  assert.equal(koFaded.alpha, 0);
});
