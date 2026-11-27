import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createDevBossSandboxRun,
  createDevLabSandboxRun,
  getDevBossInitialHpRatio,
  getInitialDevLabTab,
  isDevBossEncounterRequested,
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
    assert.equal(getInitialDevLabTab('?devLabTab=hero'), 'hero');
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

  it('creates an isolated devlab_ boss sandbox run with optional initial HP ratio', () => {
    assert.equal(isDevBossEncounterRequested('?autostart=1&devEncounter=boss'), true);
    assert.equal(isDevBossEncounterRequested('?autostart=1'), false);
    assert.equal(getDevBossInitialHpRatio('?devBossHpRatio=0.52'), 0.52);
    assert.equal(getDevBossInitialHpRatio('?devBossHpRatio=invalid'), null);

    const bossRun = createDevBossSandboxRun('kira', 3, 104729, 0.52);
    assert.equal(isDevLabRunId(bossRun.runId), true);
    assert.equal(bossRun.screen, 'combat');
    const boss = bossRun.combat?.enemies.find((e) => e.archetype === 'boss');
    assert.ok(boss, 'expected boss enemy in devBossSandboxRun');
    assert.equal(boss.hp, Math.round(boss.maxHp * 0.52));
    assert.equal(boss.armor, 0);
  });
});
