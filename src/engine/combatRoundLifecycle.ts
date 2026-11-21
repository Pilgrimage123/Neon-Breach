import { BOARD_CAPACITY, ENEMY_TEMPLATES } from './data';
import { createPropUnit } from './encounterBuilder';
import { rebuildMasterPool } from './poolBuilder';
import {
  BLIGHT_HOLD_CHIP_DAMAGE,
  HOT_POTATO_SELF_DAMAGE,
  absorbHeroDamage,
  applyMercyVictoryBonus,
  clearDeadCasterHexes,
  finalizeCombatVictory,
  hasHostileLivingEnemies,
  hasImplant,
} from './combatRules';
import { drawToSix } from './combatBoardOps';
import { advanceDirectorAtRoundEnd } from './reinforcementDirector';
import type { AnimationCue, CombatState, EnemyUnit, RunState } from './types';

export function advanceRoundAfterEnemies(run: RunState): RunState {
  if (!run.combat) return run;
  const combat = run.combat;
  if (combat.phase !== 'PLAYER_RESOLVED' && combat.phase !== 'ENEMY_ACTING') {
    return run;
  }

  const nextHero = { ...run.hero };
  const implants = nextHero.implants;
  const roundEndCues: AnimationCue[] = [];

  const lingeringBlightCount = combat.board.filter((t) => t.isBlight).length;
  if (lingeringBlightCount > 0) {
    const blightDmg = lingeringBlightCount * BLIGHT_HOLD_CHIP_DAMAGE;
    const absBlight = absorbHeroDamage(nextHero.shield, nextHero.armor ?? 0, blightDmg);
    nextHero.shield = absBlight.nextShield;
    nextHero.armor = absBlight.nextArmor;
    const blockedBlight = absBlight.blockedByShield + absBlight.blockedByArmor;
    const hpBlight = absBlight.hpDamage;
    nextHero.hp = Math.max(0, nextHero.hp - hpBlight);
    roundEndCues.push({
      id: `cue_${combat.turn}_blight_chip`,
      kind: 'tile_blight',
      value: blightDmg,
      blocked: blockedBlight,
      hpDamage: hpBlight,
      textLabel: `-${blightDmg} SLAG BURN`,
    });
    if (nextHero.hp <= 0) {
      return {
        ...run,
        screen: 'gameover',
        hero: nextHero,
        combat: {
          ...combat,
          phase: 'DEFEAT',
          lastCues: roundEndCues,
        },
      };
    }
  }

  const lingeringHotPotatoCount = combat.board.filter((t) => Boolean(t.isHotPotato)).length;
  if (lingeringHotPotatoCount > 0) {
    const potatoDmg = lingeringHotPotatoCount * HOT_POTATO_SELF_DAMAGE;
    const absPotato = absorbHeroDamage(nextHero.shield, nextHero.armor ?? 0, potatoDmg);
    nextHero.shield = absPotato.nextShield;
    nextHero.armor = absPotato.nextArmor;
    const blockedPotato = absPotato.blockedByShield + absPotato.blockedByArmor;
    const hpPotato = absPotato.hpDamage;
    nextHero.hp = Math.max(0, nextHero.hp - hpPotato);
    roundEndCues.push({
      id: `cue_${combat.turn}_hot_potato_boom`,
      kind: 'tile_blight',
      value: potatoDmg,
      blocked: blockedPotato,
      hpDamage: hpPotato,
      textLabel: `-${potatoDmg} TIME-BOMB!`,
    });
    if (nextHero.hp <= 0) {
      return {
        ...run,
        screen: 'gameover',
        hero: nextHero,
        combat: {
          ...combat,
          phase: 'DEFEAT',
          lastCues: roundEndCues,
        },
      };
    }
  }

  const aegisRetained = hasImplant(implants, 'aegis_capacitor')
    ? Math.floor(nextHero.shield * 0.5)
    : 0;
  nextHero.shield = Math.min(nextHero.shield, aegisRetained);
  nextHero.corrode = Math.max(0, nextHero.corrode - 1);
  nextHero.damageBoostPct = Math.max(0, nextHero.damageBoostPct - 10);

  if (nextHero.nannyBotInstalled === 'guardian_nanny') {
    nextHero.shield += 4;
  } else if (nextHero.nannyBotInstalled === 'caretaker_nanny') {
    nextHero.corrode = Math.max(0, nextHero.corrode - 1);
    nextHero.hp = Math.min(nextHero.maxHp, nextHero.hp + 2);
  }

  const nextCradleObjective = combat.cradleObjective ? { ...combat.cradleObjective } : undefined;
  if (nextCradleObjective && nextCradleObjective.hp > 0) {
    nextCradleObjective.turnsSurvived += 1;
    if (
      !nextCradleObjective.liberated &&
      nextCradleObjective.turnsSurvived >= nextCradleObjective.targetTurns
    ) {
      nextCradleObjective.liberated = true;
      nextHero.overdrive = Math.min(100, nextHero.overdrive + 20);
    }
  }

  const nextTurn = combat.turn + 1;
  const heldBoard = combat.board.map((t) => ({
    ...t,
    isHeldFromPrevTurn: true,
    isHotPotato: undefined,
  }));
  const drawTarget = BOARD_CAPACITY + Math.max(0, nextHero.pendingUpcharge ?? 0);
  const drawn = drawToSix(
    heldBoard,
    combat.drawPile,
    combat.discardPile,
    run.seed,
    nextTurn,
    drawTarget,
  );
  nextHero.pendingUpcharge = 0;

  const currentNode = run.mapNodes.find((n) => n.id === combat.nodeId);
  const layer = currentNode?.layer ?? 0;

  const hasBossAlive = combat.enemies.some(
    (e) => e.hp > 0 && !e.escaped && !e.propKind && e.archetype === 'boss',
  );

  let nextEnemies: EnemyUnit[] = combat.enemies.map((e) => {
    if (e.hp > 0 && !e.escaped && e.isLootRunner) {
      const nextEscape = (e.escapeTurnsLeft ?? 3) - 1;
      if (nextEscape <= 0) {
        roundEndCues.push({
          id: `cue_${nextTurn}_escaped_${e.id}`,
          kind: 'enemy_telegraph',
          targetId: e.id,
          value: 0,
          textLabel: 'ESCAPED!',
        });
        return {
          ...e,
          hp: 0,
          escapeTurnsLeft: 0,
          escaped: true,
          turnDamageTaken: 0,
        };
      }
      return {
        ...e,
        escapeTurnsLeft: nextEscape,
        turnDamageTaken: 0,
      };
    }

    if (e.hp > 0 && e.propKind === 'bio_husk') {
      const nextRevive = (e.reviveTimer ?? 2) - 1;
      if (nextRevive <= 0) {
        const revArch = e.reviveArchetype ?? e.archetype;
        const tpl = ENEMY_TEMPLATES[revArch];
        const revMaxHp = e.reviveMaxHp ?? tpl.maxHp;
        const revivedHp = Math.max(6, Math.ceil(revMaxHp * 0.5));
        roundEndCues.push({
          id: `cue_${nextTurn}_revived_${e.id}`,
          kind: 'enemy_reinforce',
          targetId: e.id,
          value: revivedHp,
          textLabel: 'HUSK REVIVED!',
        });
        return {
          id: e.id,
          archetype: revArch,
          hp: revivedHp,
          maxHp: revMaxHp,
          armor: tpl.startingArmor,
          shieldPips: 0,
          maxShieldPips: tpl.startingShieldPips,
          passive: tpl.passive,
          roleColor: tpl.roleColor,
          intentCycle: tpl.intentCycle.map((intent) => ({ ...intent })),
          currentIntentIndex: 0,
          huskSpawned: true,
          isZeroReward: true,
          turnDamageTaken: 0,
        };
      }
      return {
        ...e,
        reviveTimer: nextRevive,
        turnDamageTaken: 0,
      };
    }

    if (
      e.hp <= 0 &&
      !e.escaped &&
      !e.propKind &&
      !e.huskSpawned &&
      !e.isLootRunner &&
      !e.isMercyTarget &&
      hasBossAlive
    ) {
      const husk = createPropUnit('bio_husk', e.id, {
        archetype: e.archetype,
        maxHp: e.maxHp,
      });
      return {
        ...husk,
        id: e.id,
        huskSpawned: true,
      };
    }

    return { ...e, turnDamageTaken: 0 };
  });

  if (!hasHostileLivingEnemies(nextEnemies)) {
    const mercy = applyMercyVictoryBonus(combat, nextHero, nextEnemies);
    const victoryCombat: CombatState = {
      ...combat,
      turn: nextTurn,
      phase: 'VICTORY',
      board: drawn.board,
      drawPile: drawn.drawPile,
      discardPile: drawn.discardPile,
      enemies: nextEnemies,
      lastCues: roundEndCues,
      lastColorPlayed: null,
      rewardCredits: combat.rewardCredits + mercy.mercyCrBonus,
      mercyBonusAwarded: mercy.mercyBonusAwarded,
      cradleObjective: nextCradleObjective,
    };
    const transition = finalizeCombatVictory(run, victoryCombat, nextHero);
    return {
      ...run,
      screen: transition.screen,
      hero: transition.hero,
      masterPool: rebuildMasterPool(transition.hero),
      mapNodes: transition.mapNodes,
      combat: transition.combat,
      turnsCompleted: run.turnsCompleted + 1,
    };
  }

  let nextBoard = clearDeadCasterHexes(drawn.board, nextEnemies);
  let nextDirector = combat.director;
  let directorCues: AnimationCue[] = [];

  if (nextDirector) {
    const dirRes = advanceDirectorAtRoundEnd({
      director: nextDirector,
      enemies: nextEnemies,
      board: nextBoard,
      hero: nextHero,
      nodeType: combat.nodeType,
      layer,
      currentTurn: combat.turn,
      seed: run.seed,
      difficultyTier: run.difficultyTier ?? 3,
    });
    nextDirector = dirRes.director;
    nextEnemies = dirRes.enemies;
    nextBoard = dirRes.board;
    directorCues = dirRes.cues;
  }

  for (const enemy of nextEnemies) {
    if (enemy.hp <= 0 || enemy.escaped || enemy.propKind) continue;
    if (enemy.passive !== 'acid_jam' && enemy.archetype !== 'boss') continue;
    const alreadyHasHex = nextBoard.some((t) => t.hexedByEnemyId === enemy.id);
    if (alreadyHasHex) continue;

    const candidates = nextBoard
      .map((tile, idx) => ({ tile, idx }))
      .filter(({ tile }) => !tile.hexedByEnemyId && !tile.isJammed && !tile.isBlight);
    if (candidates.length === 0) continue;

    candidates.sort((a, b) => {
      const aPref = a.tile.type === 'attack' || a.tile.type === 'defense' ? 1 : 0;
      const bPref = b.tile.type === 'attack' || b.tile.type === 'defense' ? 1 : 0;
      if (aPref !== bPref) return bPref - aPref;
      return b.tile.value - a.tile.value;
    });
    const target = candidates[0];
    nextBoard = nextBoard.map((t, idx) =>
      idx === target.idx ? { ...t, hexedByEnemyId: enemy.id } : t,
    );
    roundEndCues.push({
      id: `cue_${nextTurn}_hex_cast_${enemy.id}`,
      kind: 'tile_hex',
      targetId: enemy.id,
      textLabel: 'TILE HEXED',
    });
  }

  const prevBlitzCd = combat.blitzReflexCooldown ?? 0;
  const nextBlitzCd =
    !combat.blitzUsedThisRound && prevBlitzCd > 0 ? prevBlitzCd - 1 : prevBlitzCd;

  return {
    ...run,
    hero: nextHero,
    combat: {
      ...combat,
      turn: nextTurn,
      phase: 'PLAYER_IDLE',
      board: nextBoard,
      drawPile: drawn.drawPile,
      discardPile: drawn.discardPile,
      enemies: nextEnemies,
      lastCues: [...roundEndCues, ...directorCues],
      director: nextDirector,
      lastColorPlayed: null,
      cradleObjective: nextCradleObjective,
      blitzReflexCooldown: nextBlitzCd,
      blitzUsedThisRound: false,
      evasiveDodgeTriggeredThisRound: false,
    },
    turnsCompleted: run.turnsCompleted + 1,
  };
}
