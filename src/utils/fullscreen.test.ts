import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectTouchscreenDevice,
  isFullscreenActive,
  isFullscreenSupported,
  toggleDocumentFullscreen,
  type FullscreenDocumentLike,
} from './fullscreen';

test('detectTouchscreenDevice identifies coarse pointers, touch points, and ontouchstart', () => {
  assert.equal(
    detectTouchscreenDevice({
      hasCoarsePointer: false,
      hasAnyCoarsePointer: false,
      maxTouchPoints: 0,
      hasOnTouchStart: false,
    }),
    false,
  );

  assert.equal(
    detectTouchscreenDevice({
      hasCoarsePointer: true,
      hasAnyCoarsePointer: false,
      maxTouchPoints: 0,
      hasOnTouchStart: false,
    }),
    true,
  );

  assert.equal(
    detectTouchscreenDevice({
      hasCoarsePointer: false,
      hasAnyCoarsePointer: false,
      maxTouchPoints: 5,
      hasOnTouchStart: false,
    }),
    true,
  );

  assert.equal(
    detectTouchscreenDevice({
      hasCoarsePointer: false,
      hasAnyCoarsePointer: true,
      maxTouchPoints: 0,
      hasOnTouchStart: false,
    }),
    true,
  );
});

test('isFullscreenSupported respects requestFullscreen and fullscreenEnabled', () => {
  assert.equal(isFullscreenSupported(null), false);
  assert.equal(
    isFullscreenSupported({
      fullscreenEnabled: false,
      documentElement: { requestFullscreen: async () => {} },
    }),
    false,
  );
  assert.equal(
    isFullscreenSupported({
      fullscreenEnabled: true,
      documentElement: { requestFullscreen: async () => {} },
    }),
    true,
  );
  assert.equal(
    isFullscreenSupported({
      webkitFullscreenEnabled: true,
      documentElement: { webkitRequestFullscreen: () => {} },
    }),
    true,
  );
});

test('toggleDocumentFullscreen enters and exits fullscreen safely', async () => {
  const doc: FullscreenDocumentLike = {
    fullscreenElement: null,
    fullscreenEnabled: true,
    documentElement: {
      requestFullscreen: async () => {
        doc.fullscreenElement = {} as Element;
      },
    },
    exitFullscreen: async () => {
      doc.fullscreenElement = null;
    },
  };

  assert.equal(isFullscreenActive(doc), false);
  const entered = await toggleDocumentFullscreen(doc);
  assert.equal(entered, true);
  assert.equal(isFullscreenActive(doc), true);

  const exited = await toggleDocumentFullscreen(doc);
  assert.equal(exited, false);
  assert.equal(isFullscreenActive(doc), false);
});

test('toggleDocumentFullscreen catches rejected browser fullscreen promises without throwing', async () => {
  const doc: FullscreenDocumentLike = {
    fullscreenElement: null,
    fullscreenEnabled: true,
    documentElement: {
      requestFullscreen: async () => {
        throw new Error('Permissions policy blocked');
      },
    },
  };

  const active = await toggleDocumentFullscreen(doc);
  assert.equal(active, false);
});
