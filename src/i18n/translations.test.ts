import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import { SKILL_CHIPS_BY_ID } from '../engine/data';
import { CODEX_TRANSLATIONS } from './codexTranslations';
import { TRANSLATIONS } from './translations';

function collectDeepKeys(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object') {
    return [prefix];
  }
  if (Array.isArray(obj)) {
    if (obj.every((item) => typeof item !== 'object' || item === null)) {
      return [prefix];
    }
    return obj.flatMap((item, idx) => collectDeepKeys(item, `${prefix}[${idx}]`));
  }
  return Object.keys(obj as Record<string, unknown>)
    .sort()
    .flatMap((key) => {
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      return collectDeepKeys((obj as Record<string, unknown>)[key], nextPrefix);
    });
}

function collectLeafStrings(obj: unknown, prefix = ''): Array<{ path: string; value: string }> {
  if (typeof obj === 'string') {
    return [{ path: prefix, value: obj }];
  }
  if (obj === null || typeof obj !== 'object') {
    return [];
  }
  if (Array.isArray(obj)) {
    return obj.flatMap((item, idx) => collectLeafStrings(item, `${prefix}[${idx}]`));
  }
  return Object.entries(obj as Record<string, unknown>).flatMap(([key, val]) =>
    collectLeafStrings(val, prefix ? `${prefix}.${key}` : key),
  );
}

describe('Translations and Czech default localization', () => {
  it('enforces 100% deep key parity between TRANSLATIONS.en and TRANSLATIONS.cs', () => {
    const enKeys = collectDeepKeys(TRANSLATIONS.en);
    const csKeys = collectDeepKeys(TRANSLATIONS.cs);
    assert.deepEqual(enKeys, csKeys, 'TRANSLATIONS.en and TRANSLATIONS.cs must have identical deep keys');
  });

  it('enforces 100% deep key parity between CODEX_TRANSLATIONS.en and CODEX_TRANSLATIONS.cs', () => {
    const enCodexKeys = collectDeepKeys(CODEX_TRANSLATIONS.en);
    const csCodexKeys = collectDeepKeys(CODEX_TRANSLATIONS.cs);
    assert.deepEqual(
      enCodexKeys,
      csCodexKeys,
      'CODEX_TRANSLATIONS.en and CODEX_TRANSLATIONS.cs must have identical deep keys',
    );
  });

  it('guards all player-facing EN and CS strings against forbidden legacy glossary terms', () => {
    const forbiddenTerms: RegExp[] = [
      /\bAurelia\b/i,
      /\bOperatives?\b/i,
      /\bHeroines?\b/i,
      /\bDiscrete Pip/i,
      /\bOperativk[ayou]\b/i,
      /\bAgentk[ayou]\b/i,
    ];

    const packs: Array<{ name: string; data: unknown }> = [
      { name: 'TRANSLATIONS.en', data: TRANSLATIONS.en },
      { name: 'TRANSLATIONS.cs', data: TRANSLATIONS.cs },
      { name: 'CODEX_TRANSLATIONS.en', data: CODEX_TRANSLATIONS.en },
      { name: 'CODEX_TRANSLATIONS.cs', data: CODEX_TRANSLATIONS.cs },
    ];

    for (const pack of packs) {
      for (const { path, value } of collectLeafStrings(pack.data, pack.name)) {
        for (const pattern of forbiddenTerms) {
          assert.doesNotMatch(
            value,
            pattern,
            `Forbidden legacy term ${pattern} found at ${path}: "${value}"`,
          );
        }
      }
    }
  });

  it('provides complete beginner-friendly howToPlay copy in both cs and en', () => {
    for (const lang of ['cs', 'en'] as const) {
      const h = TRANSLATIONS[lang].howToPlay;
      assert.ok(h, `${lang} must define howToPlay`);
      assert.ok(h.title.trim().length > 0, `${lang} title missing`);
      assert.ok(h.badge.trim().length > 0, `${lang} badge missing`);
      assert.ok(h.goal.trim().length > 10, `${lang} goal missing`);
      for (const field of [
        h.step1Title,
        h.step1Desc,
        h.step2Title,
        h.attackLabel,
        h.attackDesc,
        h.defenseLabel,
        h.defenseDesc,
        h.techLabel,
        h.techDesc,
        h.step3Title,
        h.step3Desc,
        h.step4Title,
        h.step4Desc,
      ]) {
        assert.ok(field.trim().length > 0, `${lang} field must be non-empty`);
      }
    }
  });

  it('sets Czech (cs) as the default HTML and App language', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    assert.match(html, /<html\s+lang="cs"/);

    const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
    assert.match(appSource, /useState<Language>\('cs'\)/);
  });

  it('omits removed tile/overdrive shortcut hints from controlsHint in cs and en', () => {
    for (const lang of ['cs', 'en'] as const) {
      const hint = TRANSLATIONS[lang].controlsHint;
      assert.doesNotMatch(hint, /1\/2\/3/);
      assert.doesNotMatch(hint, /Vyber typ|Select Type/i);
      assert.doesNotMatch(hint, /Mezerník Overdrive|Space Overdrive/i);
      assert.ok(hint.length > 0);
    }
    assert.equal('gameSubtitle' in TRANSLATIONS.cs, false);
    assert.equal('gameSubtitle' in TRANSLATIONS.en, false);
  });

  it('defines rethemed AI Skill Chip names and descriptions for every catalog chip in cs and en', () => {
    for (const def of Object.values(SKILL_CHIPS_BY_ID)) {
      for (const lang of ['cs', 'en'] as const) {
        const meta = TRANSLATIONS[lang].equipment[def.id];
        assert.ok(meta, `Missing ${lang} translation for chip ${def.id}`);
        assert.match(meta.name, /\.AI$/, `${lang} chip ${def.id} (${meta.name}) should use .AI naming`);
        assert.ok(meta.desc.trim().length > 0, `Missing ${lang} description for chip ${def.id}`);
      }
    }
  });

  it('removes legacy physical weapon, drone, and weight remnants from EN and CS copy', () => {
    const legacyPatterns = [
      /\bAretta\b/i,
      /\bFalcon\b/i,
      /\bAnkh\b/i,
      /Rail-Carbine/i,
      /Oblouková karabina/i,
      /Twin-Blade/i,
      /Breacher Heavy/i,
      /Reactive Exo/i,
      /Carry Load/i,
      /\bNosnost\b/i,
      /Startovní výbava/i,
      /Starting Equipment/i,
    ];
    const serialized = JSON.stringify({
      en: TRANSLATIONS.en,
      cs: TRANSLATIONS.cs,
      codexEn: CODEX_TRANSLATIONS.en,
      codexCs: CODEX_TRANSLATIONS.cs,
    });
    for (const pattern of legacyPatterns) {
      assert.doesNotMatch(serialized, pattern, `Legacy physical gear term leaked: ${pattern}`);
    }
  });

  it('keeps Czech copy free of known typos, anglicisms, and stale character names', () => {
    const csSerialized = JSON.stringify({
      ui: TRANSLATIONS.cs,
      codex: CODEX_TRANSLATIONS.cs,
    });
    const forbiddenCsPatterns = [
      /\bVyleč\b/,
      /\bk spálení\b/i,
      /Trauma alert/i,
      /Plazmová předvoj/i,
      /\bBeat 2\b/i,
      /\bAurelia\b/,
      /Damage booster/i,
    ];
    for (const pattern of forbiddenCsPatterns) {
      assert.doesNotMatch(csSerialized, pattern, `Czech localization defect found: ${pattern}`);
    }
  });
});
