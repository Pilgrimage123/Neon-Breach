import { previewColorResolution, previewHeroineThreat } from '../engine/gameEngine';
import type { CombatState, EnemyUnit, RunState, Tile, TileType, TurnPreview } from '../engine/types';
import type { Language } from '../i18n/translations';
import { computeEnemyArmorPreview } from '../components/combat/combatEnemyUi';

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
    labelEn: 'Retaliate',
    labelCs: 'Odplata',
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
    labelEn: 'Bio-Burst',
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
    labelEn: 'Stagger',
    labelCs: 'Omráčení',
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
    ruleEn: '+2 power per stack on future draws.',
    ruleCs: '+2 k síle na další tahy.',
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
 * Validates whether a UI string strictly adheres to the <= 8-word cap.
 */
export function validateStreamlinedCopy(
  text: string,
  maxWords = 8,
): { valid: boolean; wordCount: number; clean: string } {
  const wordCount = countUiWords(text);
  return {
    valid: wordCount <= maxWords,
    wordCount,
    clean: enforceEightWordRule(text, maxWords),
  };
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
            : `**Bio-Burst:** Death deals 6 **Pierce** DMG.`,
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
            ? `**Odplata 3 DMG.** +4 DMG bez **Štítu**.`
            : `**Retaliate 3 DMG.** +4 DMG at 0 **Shield**.`,
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
            ? `**50% Zámek:** +10 **Brnění**, +1 **Pip**, **Kletba**.`
            : `**50% Lock:** +10 **Armor**, +1 **Pip**, **Hex**.`,
        counterMath: lang === 'cs' ? `⚡ **Drcení** Brnění a 16+ **Omráčení**.` : `⚡ **Shred** **Armor** and 16+ **Stagger**.`,
        keywords: withUnique(['armor', 'pip', 'hex']),
      };
  }
}

export interface BoardIntentVector {
  enemyId: string;
  enemyIndex: number;
  intentKind: EnemyUnit['intentCycle'][number]['kind'];
  damageValue: number;
  secondaryValue: number;
  targetsHero: boolean;
  badgeText: string;
  accentHex: string;
}

/**
 * Section 3.1: Telegraph Enemy Intent on the Tile / Board.
 * Computes the on-board intent vectors and big icon+number badges for every living enemy.
 */
export function computeBoardIntentVectors(combat: CombatState): BoardIntentVector[] {
  const vectors: BoardIntentVector[] = [];
  for (let idx = 0; idx < combat.enemies.length; idx++) {
    const enemy = combat.enemies[idx];
    if (enemy.hp <= 0) continue;
    const intent = enemy.intentCycle[enemy.currentIntentIndex];
    if (!intent) continue;
    if (enemy.staggered) {
      vectors.push({
        enemyId: enemy.id,
        enemyIndex: idx,
        intentKind: intent.kind,
        damageValue: 0,
        secondaryValue: 0,
        targetsHero: false,
        badgeText: '⚡ 0',
        accentHex: '#00F0FF',
      });
      continue;
    }
    const enrage = enemy.enrageAtkBonus ?? 0;
    const val = intent.value + enrage;
    const condSuffix = intent.conditionBonus ? `+${intent.conditionBonus}?` : '';

    if (intent.kind === 'attack' || intent.kind === 'heavy') {
      vectors.push({
        enemyId: enemy.id,
        enemyIndex: idx,
        intentKind: intent.kind,
        damageValue: val,
        secondaryValue: 0,
        targetsHero: true,
        badgeText: `⚔ ${val}${condSuffix}`,
        accentHex: '#FF2E7E',
      });
    } else if (intent.kind === 'acid') {
      vectors.push({
        enemyId: enemy.id,
        enemyIndex: idx,
        intentKind: intent.kind,
        damageValue: val,
        secondaryValue: intent.secondaryValue ?? 1,
        targetsHero: true,
        badgeText: `☣ ${val}`,
        accentHex: '#84CC16',
      });
    } else if (intent.kind === 'leech') {
      vectors.push({
        enemyId: enemy.id,
        enemyIndex: idx,
        intentKind: intent.kind,
        damageValue: val,
        secondaryValue: intent.secondaryValue ?? 3,
        targetsHero: true,
        badgeText: `🩸 ${val}`,
        accentHex: '#C084FC',
      });
    } else if (intent.kind === 'charge') {
      const turnsLeft = intent.secondaryValue ?? 1;
      vectors.push({
        enemyId: enemy.id,
        enemyIndex: idx,
        intentKind: intent.kind,
        damageValue: 0,
        secondaryValue: turnsLeft,
        targetsHero: false,
        badgeText: `⏳ ${turnsLeft}T→${val}`,
        accentHex: '#FB923C',
      });
    } else {
      vectors.push({
        enemyId: enemy.id,
        enemyIndex: idx,
        intentKind: intent.kind,
        damageValue: 0,
        secondaryValue: intent.value,
        targetsHero: false,
        badgeText: `🛡 +${intent.value}`,
        accentHex: '#00F0FF',
      });
    }
  }
  return vectors;
}

export interface KnockbackSwapPreview {
  active: boolean;
  fromSlotIndex: number;
  toSlotIndex: number;
  collisionDamage: number;
  frontUnitSurvivingHp: number;
  frontUnitSurvivingArmor: number;
  secondUnitSurvivingHp: number;
  secondUnitSurvivingArmor: number;
  bannerText: string;
}

/**
 * Section 3.2: Hover Previews (The "What-If" Spatial Swap State).
 * Computes exact landing slots when hovering Push/Swap (pure 0-AP positioning).
 */
export function computeKnockbackSwapPreview(
  combat: CombatState | null,
  hoveringSwap: boolean,
  lang: Language = 'en',
): KnockbackSwapPreview | null {
  if (!combat || !hoveringSwap || combat.phase !== 'PLAYER_IDLE') return null;
  const livingIndices: number[] = [];
  combat.enemies.forEach((e, idx) => {
    if (e.hp > 0) livingIndices.push(idx);
  });
  if (livingIndices.length < 2) return null;

  const idxA = livingIndices[0];
  const idxB = livingIndices[1];
  const unitA = combat.enemies[idxA];
  const unitB = combat.enemies[idxB];

  return {
    active: true,
    fromSlotIndex: idxA,
    toSlotIndex: idxB,
    collisionDamage: 0,
    frontUnitSurvivingHp: unitA.hp,
    frontUnitSurvivingArmor: unitA.armor,
    secondUnitSurvivingHp: unitB.hp,
    secondUnitSurvivingArmor: unitB.armor,
    bannerText:
      lang === 'cs'
        ? '⇄ PROHODIT POZICE · 0 AP'
        : '⇄ SWAP SLOTS · 0 AP',
  };
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

export function resolveActivePreviewKeywords(
  preview: TurnPreview | null,
  hoveringSwap = false,
): CoreMechanicKeywordId[] {
  if (hoveringSwap) return ['push'];
  if (!preview || preview.tileCount === 0) return [];
  const list: CoreMechanicKeywordId[] = [];
  if (preview.surgeTriggered) list.push('surge');
  if (preview.color === 'attack') {
    list.push('armor');
    if (preview.armorPiercing) list.push('pierce');
  } else if (preview.color === 'defense') {
    list.push('shield');
  } else {
    if (preview.armorShredAmount > 0) list.push('shred');
    if (preview.techPierceDamage > 0) list.push('pierce');
    if (preview.cleanseCorrodeAmount > 0) list.push('corrode');
    if (preview.shieldGained > 0) list.push('shield');
  }
  return list.slice(0, 3);
}

export interface SmartActionTriggerSummary {
  color: TileType;
  tileCount: number;
  mathFormula: string;
  outcomeTag: string | null;
  outcomeTone: 'kill' | 'block' | 'stagger' | 'overdrive' | 'surge' | 'neutral';
  killCount: number;
  blocksAllIncoming: boolean;
  fillsOverdrive: boolean;
}

/**
 * Computes zero-hover instant turn math and tactical outcome badges for all 3 tile colors
 * simultaneously, eliminating the need to hover each group one by one to compare turn options.
 */
export function computeSmartActionTriggerSummaries(
  run: RunState,
  lang: Language = 'en',
): Record<TileType, SmartActionTriggerSummary> {
  const isCs = lang === 'cs';
  const combat = run.combat;
  const baselineThreat = combat ? previewHeroineThreat(combat, run.heroine, null) : null;
  const frontIdx = combat ? combat.enemies.findIndex((e) => e.hp > 0) : -1;

  const buildForColor = (color: TileType): SmartActionTriggerSummary => {
    const preview = combat ? previewColorResolution(run, color) : null;
    if (!combat || !preview || preview.tileCount === 0) {
      return {
        color,
        tileCount: 0,
        mathFormula: '—',
        outcomeTag: null,
        outcomeTone: 'neutral',
        killCount: 0,
        blocksAllIncoming: false,
        fillsOverdrive: false,
      };
    }

    let mathFormula = '—';
    if (color === 'attack') {
      mathFormula =
        preview.cleaveDamage > 0
          ? `⚔${preview.totalDamage} +${preview.cleaveDamage}`
          : `⚔${preview.totalDamage}`;
    } else if (color === 'defense') {
      mathFormula =
        preview.reflectOnBlock > 0
          ? `🛡+${preview.shieldGained} ↩${preview.reflectOnBlock}`
          : `🛡+${preview.shieldGained}`;
    } else {
      const parts: string[] = [];
      if (preview.damageBoostAddedPct > 0) parts.push(`+${preview.damageBoostAddedPct}%`);
      if (preview.armorShredAmount > 0) parts.push(`-${preview.armorShredAmount}🛡`);
      if (preview.techPierceDamage > 0) parts.push(`⚡${preview.techPierceDamage}`);
      if (preview.healAmount > 0) parts.push(`💚+${preview.healAmount}`);
      if (preview.shieldGained > 0) parts.push(`🛡+${preview.shieldGained}`);
      if (preview.cleanseCorrodeAmount > 0) parts.push(`-${preview.cleanseCorrodeAmount}☣`);
      if (parts.length === 0 && preview.overdriveGained > 0) {
        parts.push(`⚡+${preview.overdriveGained}%`);
      }
      mathFormula = parts.slice(0, 2).join(' · ') || `⚡+${preview.overdriveGained}%`;
    }

    let killCount = 0;
    let willStaggerFront = false;
    if (frontIdx !== -1) {
      for (let i = 0; i < combat.enemies.length; i++) {
        const e = combat.enemies[i];
        if (e.hp <= 0) continue;
        const ep = computeEnemyArmorPreview(e, i, frontIdx, preview, combat.enemies);
        if (ep.willDie) killCount += 1;
        if (i === frontIdx && ep.willStagger) willStaggerFront = true;
      }
    }

    const threatAfter = previewHeroineThreat(combat, run.heroine, preview);
    const blocksAllIncoming = Boolean(
      baselineThreat &&
        baselineThreat.hpDamageTaken > 0 &&
        threatAfter.hpDamageTaken === 0 &&
        color === 'defense',
    );
    const fillsOverdrive =
      run.heroine.overdrive < 100 && run.heroine.overdrive + preview.overdriveGained >= 100;

    let outcomeTag: string | null = null;
    let outcomeTone: SmartActionTriggerSummary['outcomeTone'] = 'neutral';

    if (killCount > 0) {
      outcomeTag =
        killCount > 1
          ? `☠ ×${killCount} KO`
          : isCs
            ? '☠ KO'
            : '☠ KILL';
      outcomeTone = 'kill';
    } else if (willStaggerFront) {
      outcomeTag = isCs ? '⚡ OMRÁČENÍ' : '⚡ STAGGER';
      outcomeTone = 'stagger';
    } else if (blocksAllIncoming) {
      outcomeTag = isCs ? '🛡 KRYJE VŠE' : '🛡 FULL BLOCK';
      outcomeTone = 'block';
    } else if (fillsOverdrive) {
      outcomeTag = '⚡ 100% OD';
      outcomeTone = 'overdrive';
    } else if (preview.surgeTriggered) {
      outcomeTag = isCs ? '★ PŘETÍŽENÍ' : '★ SURGE';
      outcomeTone = 'surge';
    }

    return {
      color,
      tileCount: preview.tileCount,
      mathFormula,
      outcomeTag,
      outcomeTone,
      killCount,
      blocksAllIncoming,
      fillsOverdrive,
    };
  };

  return {
    attack: buildForColor('attack'),
    defense: buildForColor('defense'),
    tech: buildForColor('tech'),
  };
}

