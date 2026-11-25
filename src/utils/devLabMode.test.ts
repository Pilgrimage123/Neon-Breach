import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createDevLabSandboxRun,
  getInitialDevLabTab,
  isDevLabRunId,
  isDevLabsQueryEnabled,
} from './devLabMode';

describe('devLabMode helpers', () => {
  it('detects devLabs=1 query flag cleanly', () => {
    assert.equal(isDevLabsQueryEnabled(''), false);
    assert.equal(isDevLabsQueryEnabled('?autostart=1'), false);
    assert.equal(isDevLabsQueryEnabled('?devLabs=0'), false);
    assert.equal(isDevLabsQueryEnabled('?devLabs=1'), true);
    assert.equal(isDevLabsQueryEnabled('?autostart=1&devLabs=1'), true);
  });

  it('parses valid devLabTab query values and ignores invalid ones', () => {
    assert.equal(getInitialDevLabTab(''), null);
    assert.equal(getInitialDevLabTab('?devLabs=1&devLabTab=spitter'), 'spitter');
    assert.equal(getInitialDevLabTab('?devLabTab=brute'), 'brute');
    assert.equal(getInitialDevLabTab('?devLabTab=mutdog'), 'mutdog');
    assert.equal(getInitialDevLabTab('?devLabTab=feral_nurse'), 'feral_nurse');
    assert.equal(getInitialDevLabTab('?devLabTab=camera'), 'camera');
    assert.equal(getInitialDevLabTab('?devLabTab=unknown'), null);
  });

  it('creates an isolated devlab_ sandbox combat run for any hero', () => {
    for (const heroId of ['kira', 'auraline', 'zuri'] as const) {
      const run = createDevLabSandboxRun(heroId, 3, 424242);
      assert.equal(isDevLabRunId(run.runId), true);
      assert.equal(run.screen, 'combat');
      assert.equal(run.hero.characterId, heroId);
      assert.ok(run.combat !== null);
      assert.ok((run.combat?.enemies.length ?? 0) >= 1);
    }
    assert.equal(isDevLabRunId('run_104729_123'), false);
    assert.equal(isDevLabRunId(null), false);
  });
});
