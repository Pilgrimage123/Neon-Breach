import type { EnemyUnit, Tile } from '../engine/types';
import type { Language } from '../i18n/translations';

/**
 * Section 5: AI System Constraint Block for Minimalist Strategy UI.
 * Used as the canonical constraint specification and enforced programmatically below.
 */
export const MINIMALIST_STRATEGY_PROMPT_CONSTRAINT = `System Constraint: Write UI text for a minimalist strategy game.
- Maximum 6 words per ability description (hard cap 8 words for any tooltip or tutorial popup).
- Use [Icon: Name] + numbers instead of sentences.
- No flavor text, no passive voice, no lore.
- Format: [Action] [Value] (e.g., "Deal 3 damage. Push 1 tile.").`;

/**
 * Section 2: High-Contrast, Big-Text Typography & AAA 7:1 Palette Specification.
 * Off-white (#F4F4F6) on charcoal (#181A20) reduces halation/blur while achieving 14.8:1 contrast (> 7:1 AAA).
 */
export const AAA_TYPOGRAPHY_AND_CONTRAST_SPEC = {
  offWhiteHex: '#F4F4F6',
  charcoalHex: '#181A20',
  contrastRatio: 14.8,
  wcagMinimumRatio: 7.0,
  boardNumbersPxRange: [28, 36] as const,
  unitTitlesPxRange: [24, 28] as const,
  tooltipBodyPxRange: [20, 22] as const,
  absoluteMinBodyPx: 18,
  lineHeightMultiplier: 1.3,
  maxCharsPerLine: 40,
} as const;

export type CoreMechanicKeywordId =
  | 'push'
  | 'shield'
  | 'pierce'
  | 'shred'
  | 'corrode'
  | 'retaliate'
  | 'surge'
  | 'pip'
  | 'armor'
  | 'bioburst'
  | 'jammed'
  | 'held'
  | 'stagger'
  | 'hex'
  | 'blight'
  | 'upcharge'
  | 'overdrive'
  | 'dud'
  | 'bloodline';

export interface NestedKeywordTooltipSpec {
  id: CoreMechanicKeywordId;
  icon: string;
  labelEn: string;
  labelCs: string;
  /** Strictly <= 8 words */
  ruleEn: string;
  /** Strictly <= 8 words */
  ruleCs: string;
  accentHex: string;
}

/**
 * Section 1.2: Keyword + Nested Tooltip System.
 * Explains bolded core mechanics in a small side-box ONLY on hover/hold,
 * with every nested explanation strictly <= 8 words.
 */
export const KEYWORD_NESTED_TOOLTIPS: Record<CoreMechanicKeywordId, NestedKeywordTooltipSpec> = {
  push: {
    id: 'push',
    icon: '⇄',
    labelEn: 'Push',
    labelCs: 'Prohoz',
    ruleEn: 'Swap front 2 units. Costs 0 AP.',
    ruleCs: 'Prohodí přední 2 cíle. Zdarma (0 AP).',
    accentHex: '#00F0FF',
  },
  shield: {
    id: 'shield',
    icon: '🛡',
    labelEn: 'Shield',
    labelCs: 'Štít',
    ruleEn: 'Blocks incoming DMG before HP drops.',
    ruleCs: 'Blokuje příchozí DMG před ztrátou HP.',
    accentHex: '#00F0FF',
  },
  pierce: {
    id: 'pierce',
    icon: '◆',
    labelEn: 'Pierce',
    labelCs: 'Průraz',
    ruleEn: 'Ignores enemy Armor. Hits HP directly.',
    ruleCs: 'Ignoruje Brnění. Zasahuje přímo HP.',
    accentHex: '#FF2E7E',
  },
  shred: {
    id: 'shred',
    icon: '⚡',
    labelEn: 'Shred',
    labelCs: 'Drcení',
    ruleEn: 'Destroys enemy Armor across all targets.',
    ruleCs: 'Strhne Brnění všem živým nepřátelům.',
    accentHex: '#FFC700',
  },
  corrode: {
    id: 'corrode',
    icon: '☣',
    labelEn: 'Corrode',
    labelCs: 'Koroze',
    ruleEn: 'Reduces Shield gained from Defense tiles.',
    ruleCs: 'Snižuje Štít získaný z Obrany.',
    accentHex: '#84CC16',
  },
  retaliate: {
    id: 'retaliate',
    icon: '⚠',
    labelEn: 'Spike Retaliation',
    labelCs: 'Odveta trnů',
    ruleEn: 'Deals 3 DMG back on non-Surge hit.',
    ruleCs: 'Vrátí 3 DMG při běžném Útoku.',
    accentHex: '#FF2E7E',
  },
  surge: {
    id: 'surge',
    icon: '★',
    labelEn: 'Surge',
    labelCs: 'Přetížení',
    ruleEn: 'Match 4+ tiles for bonus effect.',
    ruleCs: 'Spoj 4+ dílky pro bonusový efekt.',
    accentHex: '#FFC700',
  },
  pip: {
    id: 'pip',
    icon: '◆',
    labelEn: 'Aegis Pip',
    labelCs: 'Aegis Pip',
    ruleEn: 'Negates the next 1 damaging hit.',
    ruleCs: 'Zcela pohltí příští 1 zásah.',
    accentHex: '#00F0FF',
  },
  armor: {
    id: 'armor',
    icon: '■',
    labelEn: 'Armor',
    labelCs: 'Brnění',
    ruleEn: 'Absorbs Attack DMG before HP drops.',
    ruleCs: 'Pohlcuje Útok před ztrátou HP.',
    accentHex: '#FFC700',
  },
  bioburst: {
    id: 'bioburst',
    icon: '💥',
    labelEn: 'Bio-Rupture',
    labelCs: 'Bio-exploze',
    ruleEn: 'Explodes for 6 Pierce DMG on death.',
    ruleCs: 'Při smrti vybuchne za 6 DMG.',
    accentHex: '#84CC16',
  },
  jammed: {
    id: 'jammed',
    icon: '⬡',
    labelEn: 'Jammed',
    labelCs: 'Blok',
    ruleEn: 'Disabled for 1 turn by Acid hit.',
    ruleCs: 'Vyřazeno na 1 tah kyselinou.',
    accentHex: '#C084FC',
  },
  held: {
    id: 'held',
    icon: '▲',
    labelEn: 'Held',
    labelCs: 'Drženo',
    ruleEn: 'Kept on board for next turn.',
    ruleCs: 'Zůstává na desce pro další tah.',
    accentHex: '#FFC700',
  },
  stagger: {
    id: 'stagger',
    icon: '⚡',
    labelEn: 'Broken Stance',
    labelCs: 'Prolomený postoj',
    ruleEn: '16+ burst cancels Charge or Heavy.',
    ruleCs: '16+ náraz zruší Nabíjení či Těžký úder.',
    accentHex: '#00F0FF',
  },
  hex: {
    id: 'hex',
    icon: '⬡',
    labelEn: 'Hex',
    labelCs: 'Kletba',
    ruleEn: 'Hexed color heals living caster +4 HP.',
    ruleCs: 'Prokletá barva léčí sesilatele +4 HP.',
    accentHex: '#C084FC',
  },
  blight: {
    id: 'blight',
    icon: '☣',
    labelEn: 'Caustic Slag',
    labelCs: 'Žíravá struska',
    ruleEn: 'Clogs slot. Deals 2 DMG if kept.',
    ruleCs: 'Blokuje slot. Držení udělí 2 DMG.',
    accentHex: '#84CC16',
  },
  upcharge: {
    id: 'upcharge',
    icon: '⚡',
    labelEn: 'UpCharge',
    labelCs: 'Nabití',
    ruleEn: '+1 tile drawn next turn (max 9).',
    ruleCs: '+1 dílek v dalším tahu (max 9).',
    accentHex: '#FFC700',
  },
  overdrive: {
    id: 'overdrive',
    icon: '⚡',
    labelEn: 'Overdrive',
    labelCs: 'Overdrive',
    ruleEn: '100% unleashes 0 AP ultimate attack.',
    ruleCs: 'Při 100% spustí útok za 0 AP.',
    accentHex: '#00F0FF',
  },
  dud: {
    id: 'dud',
    icon: '⬡',
    labelEn: 'Dud Tile',
    labelCs: 'Slepý dílek',
    ruleEn: '0 base stats. Feeds UpCharge and Surges.',
    ruleCs: 'Základ 0. Dává Nabití a Přetížení.',
    accentHex: '#94A3B8',
  },
  bloodline: {
    id: 'bloodline',
    icon: '♥',
    labelEn: 'Bloodline',
    labelCs: 'Rodokmen',
    ruleEn: '+2 Value and +1 UpCharge to partner.',
    ruleCs: '+2 k síle a +1⚡ partnerovi.',
    accentHex: '#F43F5E',
  },
};

/**
 * Counts words in a UI string (ignoring standalone symbols/icons like ◆, ●, ▲, ★, +, -).
 */
export function countUiWords(text: string): number {
  const cleaned = text
    .replace(/\*\*/g, '')
    .replace(/[◆●▲⬡✚★◉■⇄⚔🛡⚡☣⚠💥☠·/()[\]:]/g, ' ')
    .trim();
  if (!cleaned) return 0;
  return cleaned
    .split(/\s+/)
    .filter((token) => /[a-zA-Z0-9ÁČĎÉĚÍŇÓŘŠŤÚŮÝŽáčďéěíňóřšťúůýž%+]+/.test(token)).length;
}

/**
 * Enforces the 8-Word Rule on any tooltip, card description, or popup string.
 */
export function enforceEightWordRule(text: string, maxWords = 8): string {
  const tokens = text.trim().split(/\s+/);
  let wordCount = 0;
  const kept: string[] = [];
  for (const token of tokens) {
    const isWord = /[a-zA-Z0-9ÁČĎÉĚÍŇÓŘŠŤÚŮÝŽáčďéěíňóřšťúůýž%+]+/.test(
      token.replace(/\*\*/g, ''),
    );
    if (isWord) {
      wordCount += 1;
      if (wordCount > maxWords) break;
    }
    kept.push(token);
  }
  return kept.join(' ').replace(/[,;:]$/, '');
}

/**
 * Section 1.3: Math Over Prose formatter for tiles.
 * Produces a strictly <= 6-word [Action] [Value] description with bold keywords.
 */
export function formatTileStreamlinedDescription(
  tile: Tile,
  effectiveValue: number,
  lang: Language = 'en',
): {
  mathFormula: string;
  shortRule: string;
  keywords: CoreMechanicKeywordId[];
} {
  const keywords: CoreMechanicKeywordId[] = [];
  if (tile.isJammed) keywords.push('jammed');
  if (tile.isBlight) {
    return {
      mathFormula: '☣ 0 · -2 DMG/T',
      shortRule:
        lang === 'cs'
          ? `**Struska:** Zahraj **TECH** ke spálení.`
          : `**Slag:** Play **TECH** to purge.`,
      keywords: [...keywords, 'blight'],
    };
  }
  if (tile.hexedByEnemyId) keywords.push('hex');
  if (tile.isHeldFromPrevTurn) keywords.push('held');

  if (tile.type === 'attack') {
    return {
      mathFormula: `⚔ +${effectiveValue} ATK`,
      shortRule:
        lang === 'cs'
          ? `**Zasaď ${effectiveValue} DMG.** **Přetížení** rozbije **Brnění**.`
          : `**Deal ${effectiveValue} damage.** **Surge** breaks **Armor**.`,
      keywords: [...keywords, 'armor', 'surge'],
    };
  }

  if (tile.type === 'defense') {
    return {
      mathFormula: `🛡 +${effectiveValue} SHD`,
      shortRule:
        lang === 'cs'
          ? `**Získej ${effectiveValue} Štítu.** **Přetížení** vrátí 8 DMG.`
          : `**Gain ${effectiveValue} Shield.** **Surge** deals 8 DMG.`,
      keywords: [...keywords, 'shield', 'surge'],
    };
  }

  const tech = tile.techEffect;
  if (!tech) {
    return {
      mathFormula: `▲ +${effectiveValue} TECH`,
      shortRule: lang === 'cs' ? `**Aktivuj TECH.** Nabij Overdrive.` : `**Resolve TECH.** Charge Overdrive.`,
      keywords: [...keywords, 'surge'],
    };
  }

  switch (tech.kind) {
    case 'damage_boost':
      return {
        mathFormula: `⚡ +${tech.percent}% ATK`,
        shortRule:
          lang === 'cs'
            ? `**+${tech.percent}% Útok.** Nabij Overdrive.`
            : `**Gain +${tech.percent}% ATK.** Charge Overdrive.`,
        keywords: [...keywords, 'surge'],
      };
    case 'heal':
      return {
        mathFormula: `✚ +${tech.amount} HP`,
        shortRule:
          lang === 'cs'
            ? `**Vyléčí ${tech.amount} HP.** Nabij Overdrive.`
            : `**Heal ${tech.amount} HP.** Charge Overdrive.`,
        keywords: [...keywords, 'surge'],
      };
    case 'armor_shred':
      return {
        mathFormula: `⚡ -${tech.shredAmount} ARM · ◆ +${tech.pierceDamage}`,
        shortRule:
          lang === 'cs'
            ? `**Drcení ${tech.shredAmount} Brnění.** **Průraz** ${tech.pierceDamage} DMG.`
            : `**Shred ${tech.shredAmount} Armor.** **Pierce** ${tech.pierceDamage} DMG.`,
        keywords: [...keywords, 'shred', 'pierce'],
      };
    case 'overdrive_surge':
      return {
        mathFormula: `⚡ +${tech.bonusOverdrive}% OD · -${tech.cleanseCorrode} COR`,
        shortRule:
          lang === 'cs'
            ? `**+${tech.bonusOverdrive}% Overdrive.** Očistí ${tech.cleanseCorrode} **Koroze**.`
            : `**Gain +${tech.bonusOverdrive}% OD.** Cleanse ${tech.cleanseCorrode} **Corrode**.`,
        keywords: [...keywords, 'corrode', 'surge'],
      };
    case 'tactical_shield':
    default:
      return {
        mathFormula: `🛡 +${tech.shieldAmount} SHD · ⚡ +${tech.damageBoostPct}% ATK`,
        shortRule:
          lang === 'cs'
            ? `**Získej ${tech.shieldAmount} Štítu.** **+${tech.damageBoostPct}% Útok.**`
            : `**Gain ${tech.shieldAmount} Shield.** **+${tech.damageBoostPct}% ATK.**`,
        keywords: [...keywords, 'shield', 'surge'],
      };
  }
}

/**
 * Formats enemy passive lock rules into <= 8-word streamlined [Action] [Value] text + nested keywords.
 */
export function formatEnemyStreamlinedRule(
  enemy: EnemyUnit,
  lang: Language = 'en',
): {
  shortRule: string;
  counterMath: string;
  keywords: CoreMechanicKeywordId[];
} {
  const baseKeywords: CoreMechanicKeywordId[] = [];
  if (enemy.armor > 0) baseKeywords.push('armor');
  if (enemy.shieldPips > 0 && enemy.passive !== 'anchor_aegis' && enemy.passive !== 'threshold_pip') {
    baseKeywords.push('pip');
  }
  const withUnique = (extra: CoreMechanicKeywordId[]): CoreMechanicKeywordId[] =>
    Array.from(new Set([...baseKeywords, ...extra]));

  switch (enemy.passive) {
    case 'volatile_burst':
      return {
        shortRule:
          lang === 'cs'
            ? `**Bio-exploze:** Smrt udělí 6 **Průraz** DMG.`
            : `**Bio-Rupture:** Death deals 6 **Pierce** DMG.`,
        counterMath: lang === 'cs' ? `⇄ **Prohoď** k obrněným cílům.` : `⇄ **Push** near **Armor** targets.`,
        keywords: withUnique(['bioburst', 'pierce', 'push']),
      };
    case 'anchor_aegis':
      return {
        shortRule:
          lang === 'cs'
            ? `**1 Aegis Pip.** Přidá +4 **Brnění** všem.`
            : `**1 Aegis Pip.** Grants +4 **Armor** all.`,
        counterMath: lang === 'cs' ? `◆ Praskni **Pip**, pak **Přetížení**.` : `◆ Crack **Pip**, then **Surge**.`,
        keywords: withUnique(['pip', 'armor', 'surge']),
      };
    case 'time_bomb':
      return {
        shortRule:
          lang === 'cs'
            ? `**Nabíjí 2 tahy.** 16+ **Omráčení** zruší výboj.`
            : `**Charge 2 turns.** 16+ **Stagger** cancels blast.`,
        counterMath: lang === 'cs' ? `⚡ Zasaď 16+ DMG nebo **Prohoď**.` : `⚡ Deal 16+ DMG or **Push**.`,
        keywords: withUnique(['stagger', 'push']),
      };
    case 'spike_retaliate':
      return {
        shortRule:
          lang === 'cs'
            ? `**Odveta trnů:** 3 DMG, +4 bez **Štítu**.`
            : `**Spike Retaliation:** 3 DMG, +4 at 0 **Shield**.`,
        counterMath: lang === 'cs' ? `★ Spusť **Přetížení** 4+ a **Štít**.` : `★ Use **Surge** 4+ and **Shield**.`,
        keywords: withUnique(['retaliate', 'shield', 'surge']),
      };
    case 'acid_jam':
      return {
        shortRule:
          lang === 'cs'
            ? `**Pustuly:** +2 **Koroze**; **Kyselina** **Blok**, **Struska**, **Kletba**.`
            : `**Pustules:** +2 **Corrode**; **Acid** **Jams**, **Slag**, **Hex**.`,
        counterMath:
          lang === 'cs'
            ? `★ Spusť **Přetížení** / KO; kryj **Kyselinu** **Štítem**.`
            : `★ Use **Surge** or KO; **Shield** blocks **Acid**.`,
        keywords: withUnique(['corrode', 'blight', 'hex', 'surge']),
      };
    case 'threshold_pip':
      return {
        shortRule:
          lang === 'cs'
            ? `**1 Pip**, **Brnění**/+3HP; 16+ **Omráčení** ruší těžký.`
            : `**1 Pip**, **Armor**/+3HP; 16+ **Stagger** stops Heavy.`,
        counterMath: lang === 'cs' ? `◆ Praskni **Pip** před **Přetížením**.` : `◆ Crack **Pip** before **Surge**.`,
        keywords: withUnique(['pip', 'armor', 'stagger']),
      };
    case 'phase_gate':
    default:
      return {
        shortRule:
          lang === 'cs'
            ? `**50% Fázová brána:** +10 **Brnění**, +1 **Pip**, **Kletba**.`
            : `**50% Phase Gate:** +10 **Armor**, +1 **Pip**, **Hex**.`,
        counterMath: lang === 'cs' ? `⚡ **Drcení** Brnění a 16+ **Omráčení**.` : `⚡ **Shred** **Armor** and 16+ **Stagger**.`,
        keywords: withUnique(['armor', 'pip', 'hex']),
      };
  }
}

/**
 * Section 1.1: Streamlined <= 8-word onboarding micro-prompts.
 */
export function formatStreamlinedOnboardingPrompt(
  kind: 'surge' | 'held' | 'swap',
  tileCount: number,
  lang: Language = 'en',
): string {
  if (kind === 'surge') {
    const tilesWordCs = tileCount >= 2 && tileCount <= 4 ? 'dílky' : 'dílků';
    return lang === 'cs'
      ? `★ **Spoj ${tileCount} ${tilesWordCs}.** Spusť **Přetížení**!`
      : `★ **Match ${tileCount} tiles.** Trigger **Surge** bonus!`;
  }
  if (kind === 'held') {
    return lang === 'cs'
      ? `▲ **Držené dílky** získají **+1 sílu**.`
      : `▲ **Held tiles** gain **+1 power** this turn.`;
  }
  return lang === 'cs'
    ? `⇄ **Prohoď 2 cíle.** Zdarma (0 AP).`
    : `⇄ **Swap 2 targets.** Free (0 AP).`;
}
