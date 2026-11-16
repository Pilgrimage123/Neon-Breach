import { getHeroSpec } from '../engine/data';
import {
  applyDamageToEnemy,
  evaluateReactiveEnemyShifts,
  getSurgeThreshold,
  previewColorResolution,
  previewHeroineThreat,
} from '../engine/gameEngine';
import type { CombatState, EnemyArchetype, EnemyUnit, HeroineState, RunState, TileType } from '../engine/types';
import { TRANSLATIONS, type Language } from '../i18n/translations';

export interface DiscretePipDisplay {
  raw: number;
  pips: number;
  pipString: string;
  compactLabel: string;
}

export interface SpatialSwapResult {
  swapped: boolean;
  enemies: EnemyUnit[];
  frontEnemyNameKey: string;
  pushedEnemyNameKey: string;
  collisionBonusDmg: number;
}

export interface OptimalMoveHint {
  recommendedAction: 'attack' | 'defense' | 'tech' | 'overdrive' | 'swap';
  targetColor: TileType | null;
  headline: string;
  rationale: string;
  score: number;
}

export interface TieredEncounterObjective {
  tier: 1 | 2 | 3;
  tierLabel: string;
  title: string;
  description: string;
  rewardText: string;
  completed: boolean;
}

export interface EncounterObjectivesSummary {
  starsEarned: 0 | 1 | 2 | 3;
  bonusCredits: number;
  bonusNanites: number;
  bonusScore: number;
  tiers: [TieredEncounterObjective, TieredEncounterObjective, TieredEncounterObjective];
}

/**
 * Pillar 1.1: Keep Numbers Small (Discrete Pip Math).
 * Converts larger HP/damage integers into small discrete pips (1 Pip = 5 units, minimum 1 if > 0)
 * so casual players can do instant mental arithmetic (e.g., 2 DMG Pips vs 4 HP Pips)
 * while preserving exact integer precision.
 */
export function formatDiscretePipMath(rawValue: number, unitPerPip = 5): DiscretePipDisplay {
  const safeVal = Math.max(0, Math.round(rawValue));
  if (safeVal === 0) {
    return {
      raw: 0,
      pips: 0,
      pipString: '○',
      compactLabel: '0P (0)',
    };
  }
  const pips = Math.max(1, Math.ceil(safeVal / Math.max(1, unitPerPip)));
  const cappedVisual = Math.min(8, pips);
  const pipString = '▮'.repeat(cappedVisual) + (pips > 8 ? `+${pips - 8}` : '');
  return {
    raw: safeVal,
    pips,
    pipString,
    compactLabel: `${pips}P (${safeVal})`,
  };
}

/**
 * Pillar 1.2: Spatial Positioning over Stat Checks.
 * Determines whether the player can execute a free Spatial Swap / Pull on the enemy line.
 */
export function canRepositionEnemies(combat: CombatState | null, alreadySwappedThisTurn: boolean): boolean {
  if (!combat || combat.phase !== 'PLAYER_IDLE' || alreadySwappedThisTurn) return false;
  const living = combat.enemies.filter((e) => e.hp > 0);
  return living.length >= 2;
}

/**
 * Executes a pure Spatial Swap between the first two living enemies on the sky-bridge
 * without dealing free collision damage.
 */
export function repositionFrontEnemies(combat: CombatState): SpatialSwapResult {
  const livingIndices: number[] = [];
  combat.enemies.forEach((e, idx) => {
    if (e.hp > 0) livingIndices.push(idx);
  });

  if (livingIndices.length < 2) {
    return {
      swapped: false,
      enemies: combat.enemies,
      frontEnemyNameKey: '',
      pushedEnemyNameKey: '',
      collisionBonusDmg: 0,
    };
  }

  const idxA = livingIndices[0];
  const idxB = livingIndices[1];
  const nextEnemies = combat.enemies.map((e) => ({ ...e }));

  const unitA = { ...nextEnemies[idxA] };
  const unitB = { ...nextEnemies[idxB] };

  nextEnemies[idxA] = unitB;
  nextEnemies[idxB] = unitA;

  const shiftedEnemies = evaluateReactiveEnemyShifts(combat.enemies, nextEnemies, combat.turn);

  return {
    swapped: true,
    enemies: shiftedEnemies,
    frontEnemyNameKey: unitB.archetype,
    pushedEnemyNameKey: unitA.archetype,
    collisionBonusDmg: 0,
  };
}

/**
 * Pillar 4.3: Deterministic Optimal Move Hint Solver ("Show Hint").
 * Evaluates all available actions in PLAYER_IDLE and returns the #1 optimal tactical play
 * with a clear, human-readable 1-sentence explanation.
 */
export function computeOptimalTurnHint(
  run: RunState,
  lang: Language = 'en',
  alreadySwappedThisTurn = false,
): OptimalMoveHint | null {
  const combat = run.combat;
  if (!combat || combat.phase !== 'PLAYER_IDLE') return null;
  const enemyNames = TRANSLATIONS[lang].enemies;
  const heldBonus = getHeroSpec(run.heroine.characterId).heldTileBonus;

  // 1. If Overdrive is at 100%, it is a free action that deals AoE pierce + shield + boost
  if (run.heroine.overdrive >= 100) {
    return {
      recommendedAction: 'overdrive',
      targetColor: null,
      headline: lang === 'cs' ? '★ NÁPOVĚDA: Aktivuj Overdrive [Space]' : '★ HINT: Trigger Overdrive [Space]',
      rationale:
        lang === 'cs'
          ? 'Overdrive je akce zdarma (nezakončuje tah) — okamžitě udělí plošné průrazné zranění a posílí štít.'
          : 'Overdrive is a FREE action (does not end your turn) — deals immediate AoE pierce damage and grants shield.',
      score: 999,
    };
  }

  const evaluateBestColorForRun = (candidateRun: RunState): OptimalMoveHint | null => {
    const candidateCombat = candidateRun.combat;
    if (!candidateCombat) return null;
    const colors: TileType[] = ['attack', 'defense', 'tech'];
    const frontEnemy = candidateCombat.enemies.find((e) => e.hp > 0) ?? null;
    const surgeThreshold = getSurgeThreshold(candidateRun.heroine.implants);
    let localBest: OptimalMoveHint | null = null;

    for (const color of colors) {
      const preview = previewColorResolution(candidateRun, color);
      if (preview.tileCount === 0) continue;

      const threat = previewHeroineThreat(candidateCombat, candidateRun.heroine, preview);
      let score = 0;
      const reasonsEn: string[] = [];
      const reasonsCs: string[] = [];

      if (!threat.willDie) {
        score += 200;
      } else {
        score -= 500;
      }

      const frontHit =
        color === 'attack' && frontEnemy !== null
          ? applyDamageToEnemy(
              frontEnemy,
              preview.totalDamage,
              preview.armorPiercing ? 0.3 : 0,
              preview.surgeTriggered,
            )
          : null;
      const killsFront = Boolean(frontHit?.defeated);
      const frontName = frontEnemy ? enemyNames[frontEnemy.archetype].name : '';

      if (killsFront && frontEnemy) {
        score += 95;
        reasonsEn.push(`eliminates frontline ${frontName} before it acts`);
        reasonsCs.push(`zneškodní předního nepřítele (${frontName}) dříve, než zaútočí`);
      }

      // Bonus for staggering Charge/Heavy threats
      if (
        color === 'attack' &&
        frontEnemy !== null &&
        frontEnemy.shieldPips === 0 &&
        !frontEnemy.staggered &&
        !killsFront
      ) {
        const frontIntent = frontEnemy.intentCycle[frontEnemy.currentIntentIndex];
        if (
          frontIntent &&
          (frontIntent.kind === 'charge' || frontIntent.kind === 'heavy') &&
          (frontEnemy.turnDamageTaken ?? 0) + preview.totalDamage >= 16
        ) {
          score += 55;
          reasonsEn.push(`staggers ${frontName} to 0 DMG`);
          reasonsCs.push(`omráčí ${frontName} na 0 DMG`);
        }
      }

      const baselineThreat = previewHeroineThreat(candidateCombat, candidateRun.heroine, null);
      const damageSaved = Math.max(0, baselineThreat.hpDamageTaken - threat.hpDamageTaken);
      if (damageSaved > 0) {
        score += damageSaved * 8;
        reasonsEn.push(`blocks ${damageSaved} incoming HP damage`);
        reasonsCs.push(`vykryje ${damageSaved} příchozího poškození do HP`);
      }

      if (preview.surgeTriggered) {
        score += 45;
        reasonsEn.push(`triggers ${preview.tileCount}× STACK SURGE (${surgeThreshold}+)`);
        reasonsCs.push(`spustí ${preview.tileCount}× STACK SURGE (${surgeThreshold}+)`);
      }

      score +=
        preview.totalDamage * 2.4 +
        preview.cleaveDamage * 2.2 +
        preview.shieldGained * 2.1 +
        preview.healAmount * 3.0 +
        preview.damageBoostAddedPct * 0.45 +
        preview.armorShredAmount * 3.2 +
        (preview.upchargeGained ?? 0) * 9 +
        (preview.blightPurgeCount ?? 0) * 14;

      if (preview.retaliateDamage > 0) {
        score -= preview.retaliateDamage * 6;
      }
      if ((threat.hexHealTriggered ?? 0) > 0) {
        score -= (threat.hexHealTriggered ?? 0) * 4;
      }

      if (preview.stayCount >= 3 && !preview.surgeTriggered && heldBonus > 0) {
        score += preview.stayCount * 3;
        reasonsEn.push(`holds ${preview.stayCount} tiles for +${heldBonus} HELD momentum next turn`);
        reasonsCs.push(`podrží ${preview.stayCount} dílků pro bonus +${heldBonus} v příštím tahu`);
      }

      const colorLabelEn = color === 'attack' ? 'Attack' : color === 'defense' ? 'Defense' : 'TECH';
      const colorLabelCs = color === 'attack' ? 'Útok' : color === 'defense' ? 'Obranu' : 'TECH';
      const keyNum = color === 'attack' ? '1' : color === 'defense' ? '2' : '3';

      const fallbackEn =
        color === 'attack'
          ? `deals ${preview.totalDamage} DMG`
          : color === 'defense'
            ? `grants +${preview.shieldGained} Shield`
            : `builds +${preview.damageBoostAddedPct}% DMG boost & +${preview.overdriveGained}% OD`;
      const fallbackCs =
        color === 'attack'
          ? `udělí ${preview.totalDamage} DMG`
          : color === 'defense'
            ? `přidá +${preview.shieldGained} Štítu`
            : `posílí útok o +${preview.damageBoostAddedPct}% a +${preview.overdriveGained}% OD`;

      const summaryEn = reasonsEn.length > 0 ? reasonsEn.slice(0, 2).join(' and ') : fallbackEn;
      const summaryCs = reasonsCs.length > 0 ? reasonsCs.slice(0, 2).join(' a ') : fallbackCs;

      const candidate: OptimalMoveHint = {
        recommendedAction: color,
        targetColor: color,
        headline:
          lang === 'cs'
            ? `★ NÁPOVĚDA: Zahraj [${keyNum}] ${colorLabelCs} ×${preview.tileCount}`
            : `★ HINT: Play [${keyNum}] ${colorLabelEn} ×${preview.tileCount}`,
        rationale:
          lang === 'cs'
            ? `Optimální tah: ${summaryCs}.`
            : `Optimal line: ${summaryEn}.`,
        score: Math.round(score),
      };

      if (!localBest || candidate.score > localBest.score) {
        localBest = candidate;
      }
    }
    return localBest;
  };

  const bestHint = evaluateBestColorForRun(run);

  // Also check if free Spatial Push [R] unlocks a substantially stronger line (pulling Stinger/Spitter or cracking front lock)
  if (canRepositionEnemies(combat, alreadySwappedThisTurn) && bestHint) {
    const swapped = repositionFrontEnemies(combat);
    if (swapped.swapped) {
      const swappedRun: RunState = {
        ...run,
        combat: {
          ...combat,
          enemies: swapped.enemies,
        },
      };
      const swappedBest = evaluateBestColorForRun(swappedRun);
      if (swappedBest && swappedBest.score >= bestHint.score + 28) {
        const pulledName = enemyNames[swapped.frontEnemyNameKey as EnemyArchetype].name;
        return {
          recommendedAction: 'swap',
          targetColor: swappedBest.targetColor,
          headline:
            lang === 'cs'
              ? `★ NÁPOVĚDA: Použij [R] Posun → ${pulledName}`
              : `★ HINT: Use [R] Push → Pull ${pulledName}`,
          rationale:
            lang === 'cs'
              ? `Přitáhne ${pulledName} dopředu a odemkne silnější tah.`
              : `Pulls ${pulledName} to the front to unlock a stronger follow-up.`,
          score: swappedBest.score,
        };
      }
    }
  }

  return bestHint;
}

/**
 * Pillar 3: Tiered Objectives (Opt-In 3-Star Difficulty System).
 * Evaluates Casual (1★ Survive), Intermediate (2★ Blitz <=5 turns or Flawless),
 * and Hardcore (3★ Mastery Constraint: <=4 turns, 1+ Surge, 0 Undo used).
 */
export function computeEncounterObjectives(params: {
  combat: CombatState;
  heroine: HeroineState;
  startingHp: number;
  undosUsed: number;
  hintsUsed?: number;
  failForwardUsed?: boolean;
  lang?: Language;
}): EncounterObjectivesSummary {
  const {
    combat,
    heroine,
    startingHp,
    undosUsed,
    hintsUsed = 0,
    failForwardUsed = false,
    lang = 'en',
  } = params;
  const isCleared =
    combat.phase === 'VICTORY' || combat.enemies.every((e) => e.hp <= 0);
  const hpLost = Math.max(0, startingHp - heroine.hp);
  const surgesCount = combat.director?.compositionCounts.surges ?? 0;

  // Tier 1: Casual (The Floor) — Survive and clear the board in any number of turns
  const tier1Done = isCleared && heroine.hp > 0;

  // Tier 2: Intermediate (3-Star System) — Beat in <= 5 turns OR take 0 HP damage (locked out if Fail-Forward was used)
  const tier2CriteriaMet = !failForwardUsed && (combat.turn <= 5 || hpLost === 0);
  const tier2Done = tier1Done && tier2CriteriaMet;

  // Tier 3: Hardcore (The Ceiling) — Beat in <= 4 turns with 1+ Stack Surge, 0 Undo, and 0 Hints used
  const tier3CriteriaMet =
    !failForwardUsed &&
    combat.turn <= 4 &&
    surgesCount >= 1 &&
    undosUsed === 0 &&
    hintsUsed === 0;
  const tier3Done = tier1Done && tier2CriteriaMet && tier3CriteriaMet;

  const starsEarned: 0 | 1 | 2 | 3 = tier3Done
    ? 3
    : tier2Done
      ? 2
      : tier1Done
        ? 1
        : 0;

  // Decoupled from Credit inflation: 2★/3★ award prestige Score & Nanites only
  const bonusCredits = 0;
  const bonusNanites = (tier2Done ? 1 : 0) + (tier3Done ? 2 : 0);
  const bonusScore = (tier2Done ? 75 : 0) + (tier3Done ? 150 : 0);

  const tiers: [TieredEncounterObjective, TieredEncounterObjective, TieredEncounterObjective] = [
    {
      tier: 1,
      tierLabel: lang === 'cs' ? '★ ZÁKLAD (Casual)' : '★ CASUAL (Floor)',
      title: lang === 'cs' ? 'Přežij a vyčisti sektor' : 'Survive & Clear Board',
      description:
        lang === 'cs'
          ? 'Poraz všechny nepřátele v libovolném počtu tahů.'
          : 'Defeat all enemies in any number of turns.',
      rewardText: lang === 'cs' ? 'Postup dál + Základní kořist' : 'Sector Advance + Base Loot',
      completed: tier1Done,
    },
    {
      tier: 2,
      tierLabel: lang === 'cs' ? '★★ POKROČILÝ (3-Star)' : '★★ INTERMEDIATE',
      title:
        lang === 'cs'
          ? `Bleskový průlom (≤5 tahů) NEBO 0 ztráta HP (Nyní: T${combat.turn}, -${hpLost} HP)`
          : `Blitz Clear (≤5 Turns) OR Zero HP Lost (Now: T${combat.turn}, -${hpLost} HP)`,
      description:
        lang === 'cs'
          ? 'Vyčisti uzel do 5 tahů nebo bez ztráty zdraví (bez Nouzového restartu).'
          : 'Beat the node in ≤5 turns or take zero hull damage (without Fail-Forward).',
      rewardText: '+1 NC · +75 PTS',
      completed: tier2Done,
    },
    {
      tier: 3,
      tierLabel: lang === 'cs' ? '★★★ MISTROVSTVÍ (Ceiling)' : '★★★ HARDCORE (Mastery)',
      title:
        lang === 'cs'
          ? `Bezchybný taktik: ≤4 tahy, 1+ Surge, 0 Zpět, 0 Tip (Surge: ${surgesCount}, Zpět: ${undosUsed}, Tip: ${hintsUsed})`
          : `Apex Constraint: ≤4 Turns, 1+ Surge, 0 Undo, 0 Hint (Surges: ${surgesCount}, Undo: ${undosUsed}, Hint: ${hintsUsed})`,
      description:
        lang === 'cs'
          ? 'Vyhraj do 4 tahů se Stack Surge, bez vrácení tahu a bez nápovědy.'
          : 'Clear within 4 turns, trigger 1+ Stack Surge, and use 0 Undos and 0 Hints.',
      rewardText: lang === 'cs' ? '+2 NC · +150 PTS · ★★★ ODZNAK' : '+2 NC · +150 PTS · ★★★ BADGE',
      completed: tier3Done,
    },
  ];

  return {
    starsEarned,
    bonusCredits,
    bonusNanites,
    bonusScore,
    tiers,
  };
}

/**
 * Pillar 4.1: Invisible Tutorials (Nintendo Style).
 * Returns a single-line, non-intrusive micro-prompt introducing 1 mechanic at a time
 * based on what is currently on the board, disappearing as soon as the player uses it.
 */
export function computeContextualMicroPrompt(params: {
  run: RunState;
  countByColor: Record<TileType, number>;
  alreadySwappedThisTurn: boolean;
  lang?: Language;
}): string | null {
  const { run, countByColor, alreadySwappedThisTurn, lang = 'en' } = params;
  const combat = run.combat;
  if (!combat || combat.phase !== 'PLAYER_IDLE') return null;

  const surgeThreshold = getSurgeThreshold(run.heroine.implants);
  const surgesDone = combat.director?.compositionCounts.surges ?? 0;
  const maxGroup = Math.max(countByColor.attack, countByColor.defense, countByColor.tech);

  // Step 1: Introduce Stack Surge when 4+ tiles of one color naturally appear and player hasn't surged yet
  if (surgesDone === 0 && maxGroup >= surgeThreshold) {
    return lang === 'cs'
      ? `★ Spoj ${maxGroup}× dílky. Spusť STACK SURGE!`
      : `★ Match ${maxGroup}× tiles. Trigger STACK SURGE!`;
  }

  // Step 2: Introduce Held Tile Momentum on Turn 2 when held tiles are on the board (for operatives with held bonus)
  const heldCount = combat.board.filter((t) => t.isHeldFromPrevTurn).length;
  const heldTileBonus = getHeroSpec(run.heroine.characterId).heldTileBonus;
  if (combat.turn === 2 && heldCount > 0 && heldTileBonus > 0) {
    return lang === 'cs'
      ? `▲ Držené dílky získají +${heldTileBonus} sílu.`
      : `▲ HELD tiles gain +${heldTileBonus} power.`;
  }

  // Step 3: Introduce Spatial Swap when 2+ enemies are alive on Turn 1-2
  const livingCount = combat.enemies.filter((e) => e.hp > 0).length;
  if (combat.turn <= 2 && livingCount >= 2 && !alreadySwappedThisTurn) {
    return lang === 'cs'
      ? `⇄ [Posun] prohodí přední 2 cíle.`
      : `⇄ [Push] swaps front 2 enemies.`;
  }

  return null;
}

/**
 * Pillar 4.3: Fail-Forward Second-Wind Retry.
 * Restores the encounter start snapshot and grants an optional Vanguard Aegis buff (+15 HP, +10 Shield, +40% OD)
 * so a struggling player can replay the puzzle and execute the win themselves.
 */
export function applyFailForwardBuff(snapshot: RunState): RunState {
  const boostedMaxHp = snapshot.heroine.maxHp;
  const boostedHp = Math.min(boostedMaxHp, Math.max(Math.ceil(boostedMaxHp * 0.65), snapshot.heroine.hp + 15));
  return {
    ...snapshot,
    screen: 'combat',
    heroine: {
      ...snapshot.heroine,
      hp: boostedHp,
      shield: snapshot.heroine.shield + 10,
      overdrive: Math.min(100, snapshot.heroine.overdrive + 40),
    },
  };
}
