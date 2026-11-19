import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import { TRANSLATIONS } from './translations';

describe('Translations and Czech default localization', () => {
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
});
