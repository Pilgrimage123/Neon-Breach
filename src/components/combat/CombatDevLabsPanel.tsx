import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { EnemyArchetype } from '../../engine/types';
import {
  type BruteJuiceConfig,
  type BruteJuiceTrigger,
  DEFAULT_BRUTE_JUICE_CONFIG,
  createBruteJuiceState,
  triggerBruteJuiceState,
} from '../../utils/bruteJuiceController';
import { triggerCharacterAnimation } from '../../utils/characterAnimator';
import { KIRA_DODGE_DURATION } from '../../utils/kiraSpriteSheet';
import {
  DEFAULT_SPITTER_JUICE_CONFIG,
  type SpitterJuiceConfig,
  type SpitterJuiceTrigger,
  createSpitterJuiceState,
  triggerSpitterJuiceState,
} from '../../utils/spitterJuiceController';
import type { CameraActorBounds } from './ActionCameraController';
import type { CutInActionKind, CutInStagingMode } from './CombatActionSequencer';
import { CombatCameraLabPanel } from './CombatCameraLabPanel';
import { renderDevLabPass } from './combatDevLabRenderer';
import type {
  CameraLabTriggerKind,
  CombatDevLabsPanelProps,
  CombatDevLabsRuntimeState,
} from './combatDevLabsTypes';
import { computeEnemySlotLayout } from './combatEnemyUi';
import {
  type CombatPresentationConfig,
  DEFAULT_COMBAT_PRESENTATION_CONFIG,
} from './combatPresentationConfig';
import {
  CombatBruteLabPanel,
  CombatSpitterLabPanel,
} from './CombatSpitterBruteLabPanels';
import type { ProjectileVisualProfile } from './combatStagingClassifier';
import { getBridgeGroundY, getEnemyLaneMetrics } from './combatStageTypes';
import {
  ensureEnemyAnim,
  spawnBurst,
  spawnFloatingText,
  spawnStyledProjectileVolley,
  triggerKiraDodgeVfx,
} from './combatVfx';

export type {
  CameraLabTriggerKind,
  CombatDevLabsPanelProps,
  CombatDevLabsRuntimeState,
};

export function CombatDevLabsPanel({
  simRef,
  combatRef,
  heroRef,
  tacticalViewRef,
  labRuntimeRef,
  canvasRef,
  toolbarMountNode,
  requestDraw,
  onExtraArchetypesChange,
}: CombatDevLabsPanelProps) {
  const [spitterLabOpen, setSpitterLabOpen] = useState(false);
  const [spitterJuiceConfig, setSpitterJuiceConfig] = useState<SpitterJuiceConfig>(
    DEFAULT_SPITTER_JUICE_CONFIG,
  );
  const [lastSpitterTrigger, setLastSpitterTrigger] = useState<SpitterJuiceTrigger>('idle');

  const [bruteLabOpen, setBruteLabOpen] = useState(false);
  const [bruteJuiceConfig, setBruteJuiceConfig] = useState<BruteJuiceConfig>(
    DEFAULT_BRUTE_JUICE_CONFIG,
  );
  const [lastBruteTrigger, setLastBruteTrigger] = useState<BruteJuiceTrigger>('idle');

  const [cameraLabOpen, setCameraLabOpen] = useState(false);
  const [presentationConfig, setPresentationConfig] = useState<CombatPresentationConfig>(
    DEFAULT_COMBAT_PRESENTATION_CONFIG,
  );
  const [lastCameraTrigger, setLastCameraTrigger] = useState<CameraLabTriggerKind>('idle');

  labRuntimeRef.current = {
    spitterLabActive: spitterLabOpen,
    spitterJuiceConfig,
    bruteLabActive: bruteLabOpen,
    bruteJuiceConfig,
    cameraLabActive: cameraLabOpen,
    presentationConfig,
    devLabRenderer: renderDevLabPass,
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.dataset.spitterLab = spitterLabOpen ? 'true' : 'false';
    canvas.dataset.spitterTrigger = lastSpitterTrigger;
    canvas.dataset.bruteLab = bruteLabOpen ? 'true' : 'false';
    canvas.dataset.bruteTrigger = lastBruteTrigger;
    canvas.dataset.cameraLab = cameraLabOpen ? 'true' : 'false';
    canvas.dataset.cameraTrigger = lastCameraTrigger;
  }, [
    canvasRef,
    spitterLabOpen,
    lastSpitterTrigger,
    bruteLabOpen,
    lastBruteTrigger,
    cameraLabOpen,
    lastCameraTrigger,
  ]);

  useEffect(() => {
    const extra: EnemyArchetype[] = [];
    if (spitterLabOpen) extra.push('spitter');
    if (bruteLabOpen) extra.push('brute');
    onExtraArchetypesChange(extra);
  }, [spitterLabOpen, bruteLabOpen, onExtraArchetypesChange]);

  useEffect(() => {
    const sim = simRef.current;
    if (!sim) return;
    sim.needsRedraw = true;
    requestDraw();
  }, [
    simRef,
    requestDraw,
    spitterLabOpen,
    spitterJuiceConfig,
    bruteLabOpen,
    bruteJuiceConfig,
    cameraLabOpen,
    presentationConfig,
  ]);

  const fireSpitterTrigger = (trig: SpitterJuiceTrigger) => {
    const sim = simRef.current;
    if (!sim) return;
    const cfg = labRuntimeRef.current.spitterJuiceConfig;
    let specState = sim.spitterJuiceStates.get('spitter_lab_specimen');
    if (!specState) {
      specState = createSpitterJuiceState();
      sim.spitterJuiceStates.set('spitter_lab_specimen', specState);
    }
    triggerSpitterJuiceState(specState, trig, cfg);

    for (const enemy of combatRef.current.enemies) {
      if (enemy.archetype === 'spitter' && enemy.hp > 0) {
        let es = sim.spitterJuiceStates.get(enemy.id);
        if (!es) {
          es = createSpitterJuiceState();
          sim.spitterJuiceStates.set(enemy.id, es);
        }
        triggerSpitterJuiceState(es, trig, cfg);
      }
    }
    setLastSpitterTrigger(trig);
    sim.needsRedraw = true;
    requestDraw();
  };

  const fireBruteTrigger = (trig: BruteJuiceTrigger) => {
    const sim = simRef.current;
    if (!sim) return;
    const cfg = labRuntimeRef.current.bruteJuiceConfig;
    let specState = sim.bruteJuiceStates.get('brute_lab_specimen');
    if (!specState) {
      specState = createBruteJuiceState();
      sim.bruteJuiceStates.set('brute_lab_specimen', specState);
    }
    triggerBruteJuiceState(specState, trig, cfg);

    for (const enemy of combatRef.current.enemies) {
      if (enemy.archetype === 'brute' && enemy.hp > 0) {
        let es = sim.bruteJuiceStates.get(enemy.id);
        if (!es) {
          es = createBruteJuiceState();
          sim.bruteJuiceStates.set(enemy.id, es);
        }
        triggerBruteJuiceState(es, trig, cfg);
      }
    }
    setLastBruteTrigger(trig);
    sim.needsRedraw = true;
    requestDraw();
  };

  const fireCameraTrigger = (
    kind: 'melee_normal' | 'melee_crit' | 'ranged_single' | 'ranged_aoe' | 'kira_dodge',
  ) => {
    const sim = simRef.current;
    if (!sim) return;
    const combatCur = combatRef.current;
    const heroCur = heroRef.current;
    const presCfg = labRuntimeRef.current.presentationConfig;
    const { w, h } = sim.size;
    const groundY = getBridgeGroundY(h);
    const living = combatCur.enemies.filter((e) => e.hp > 0);
    const { slotCenters, effectiveSlotCount } = computeEnemySlotLayout(
      combatCur.enemies,
      combatCur.director?.pendingReinforcements,
    );
    const { baseX: enemyBaseX, stepX: enemyStepX } = getEnemyLaneMetrics(w, effectiveSlotCount);
    const heroX = w < 460 ? w * 0.19 : w * 0.22;

    const buildBounds = (actorId: string): CameraActorBounds => {
      if (actorId === 'hero') {
        const heroHeight = Math.min(h * (h < 220 ? 0.54 : 0.57), w * 0.29, 214);
        return {
          id: 'hero',
          x: heroX,
          groundY,
          widthPx: heroHeight * 0.72,
          heightPx: heroHeight,
        };
      }
      const idx = combatCur.enemies.findIndex((e) => e.id === actorId);
      const safeIdx = idx >= 0 ? idx : 0;
      const arch = combatCur.enemies[safeIdx]?.archetype ?? 'larva';
      const crowdScale = effectiveSlotCount >= 5 ? 0.78 : effectiveSlotCount === 4 ? 0.86 : 1;
      const baseEnemySize = Math.min(h * (h < 220 ? 0.51 : 0.53), w * 0.27, 206) * crowdScale;
      const archScale =
        arch === 'boss'
          ? 1.24
          : arch === 'brute'
            ? 1.32
            : arch === 'larva'
              ? 0.76
              : arch === 'skitter'
                ? 0.88
                : arch === 'stinger'
                  ? 0.96
                  : 0.94;
      const heightPx = baseEnemySize * archScale;
      const enemyGroundY = groundY + (safeIdx % 2 === 1 ? -6 : 0);
      const centerSlot = slotCenters[safeIdx] ?? safeIdx;
      return {
        id: actorId,
        x: enemyBaseX + centerSlot * enemyStepX,
        groundY: enemyGroundY,
        widthPx: heightPx * 0.82,
        heightPx,
      };
    };

    if (kind === 'kira_dodge') {
      const attackerEnemy = living[0];
      if (!attackerEnemy || tacticalViewRef.current || !presCfg.enabled) {
        sim.actionSequencer.reset();
        triggerKiraDodgeVfx(sim, heroX, groundY);
        setLastCameraTrigger('kira_dodge');
        sim.needsRedraw = true;
        requestDraw();
        return;
      }
      const dodgeActorIds = Array.from(new Set(['hero', ...living.map((e) => e.id)]));
      void sim.actionSequencer.playCutIn(
        {
          id: `cam_lab_kira_dodge_${Date.now()}`,
          actionKind: 'normal',
          stagingMode: 'melee',
          attackerId: attackerEnemy.id,
          targetIds: ['hero'],
          allActorIds: dodgeActorIds,
          attackerBounds: buildBounds(attackerEnemy.id),
          targetBounds: [buildBounds('hero')],
          tempoScale: 1.0,
          waitForExternalImpact: false,
          evadedTargetIds: ['hero'],
          hitstopOverrideSec: 0.05,
          holdDurationOverrideSec: KIRA_DODGE_DURATION + 0.04,
          replaceQueue: true,
          onWindupStart: () => {
            const ea = ensureEnemyAnim(sim, attackerEnemy.id);
            ea.lunge = 1;
            ea.lungeDir = -1;
            ea.attackAnimDuration = 0.58;
            ea.attackAnimTimer = 0.58;
            if (attackerEnemy.archetype === 'spitter') ea.spitterAttackKind = 'claw';
            else if (attackerEnemy.archetype === 'brute') ea.bruteAttackKind = 'attack';
          },
          onImpactFrame: () => {
            const liveHeroX = sim.actionSequencer.getLiveActorX('hero', heroX);
            triggerKiraDodgeVfx(sim, liveHeroX, groundY);
          },
        },
        presCfg,
        w,
        h,
      );
      setLastCameraTrigger('kira_dodge');
      sim.needsRedraw = true;
      requestDraw();
      return;
    }

    const isAoe = kind === 'ranged_aoe';
    const isRanged = kind === 'ranged_single' || isAoe;
    const isCrit = kind === 'melee_crit';

    let targets: string[];
    let targetBounds: CameraActorBounds[];
    if (isAoe) {
      if (living.length >= 2) {
        targets = living.slice(0, 4).map((e) => e.id);
        targetBounds = targets.map((tid) => buildBounds(tid));
      } else {
        const baseTargets = living.map((e) => buildBounds(e.id));
        const syntheticCount = Math.max(0, 3 - baseTargets.length);
        const combined = [...baseTargets];
        for (let i = 0; i < syntheticCount; i++) {
          const id = `cam_lab_aoe_${i + 1}`;
          combined.push({
            id,
            x: w * (0.58 + i * 0.12),
            groundY: groundY + (i % 2 === 1 ? -6 : 0),
            widthPx: 92,
            heightPx: 146,
          });
        }
        targetBounds = combined;
        targets = combined.map((b) => b.id);
      }
    } else {
      const primaryId = living[0]?.id ?? 'cam_lab_dummy';
      targets = [primaryId];
      targetBounds = [
        primaryId === 'cam_lab_dummy'
          ? { id: 'cam_lab_dummy', x: w * 0.68, groundY, widthPx: 96, heightPx: 148 }
          : buildBounds(primaryId),
      ];
    }

    const actionKind: CutInActionKind = isCrit ? 'crit' : isAoe ? 'aoe' : 'normal';
    const stagingMode: CutInStagingMode = isAoe
      ? 'ranged_aoe'
      : isRanged
        ? 'ranged_fast'
        : 'melee';
    const allActorIds = Array.from(new Set(['hero', ...living.map((e) => e.id), ...targets]));
    const heroBounds = buildBounds('hero');
    const boundsById = new Map(targetBounds.map((tb) => [tb.id, tb] as const));

    void sim.actionSequencer.playCutIn(
      {
        id: `cam_lab_${kind}_${Date.now()}`,
        actionKind,
        stagingMode,
        attackerId: 'hero',
        targetIds: targets,
        allActorIds,
        attackerBounds: heroBounds,
        targetBounds,
        tempoScale: 1.0,
        waitForExternalImpact: false,
        replaceQueue: true,
        onWindupStart: () => {
          const activeChar = heroCur.characterId ?? 'kira';
          const animMode = isRanged || activeChar !== 'kira' ? 'shoot' : 'dash_kick';
          sim.heroState = triggerCharacterAnimation(sim.heroState, animMode, activeChar);
        },
        onProjectileSpawn: isRanged
          ? () => {
              const activeChar = heroCur.characterId ?? 'kira';
              const profile: ProjectileVisualProfile =
                activeChar === 'auraline'
                  ? 'scattergun'
                  : activeChar === 'zuri'
                    ? 'drone_plasma'
                    : 'pistol_bolt';
              const muzzleX =
                heroBounds.x +
                heroBounds.widthPx *
                  (activeChar === 'zuri' ? 0.85 : activeChar === 'auraline' ? 0.68 : 0.62);
              const muzzleY =
                heroBounds.groundY -
                heroBounds.heightPx *
                  (activeChar === 'zuri' ? 0.78 : activeChar === 'auraline' ? 0.66 : 0.72);
              for (let i = 0; i < targetBounds.length; i++) {
                const tb = targetBounds[i];
                spawnStyledProjectileVolley(sim, {
                  profile,
                  sx: muzzleX,
                  sy: muzzleY,
                  tx: tb.x,
                  ty: tb.groundY - tb.heightPx * 0.46,
                  isCrit,
                  isOverdrive: isAoe,
                });
              }
              spawnBurst(
                sim,
                muzzleX,
                muzzleY,
                isAoe ? 14 : 10,
                activeChar === 'auraline' ? '#FFC700' : activeChar === 'zuri' ? '#FF2E7E' : '#00F0FF',
                1,
                0.9,
              );
            }
          : undefined,
        onImpactTarget: (targetId, idx) => {
          const tb = boundsById.get(targetId);
          if (!tb) return;
          const liveX = sim.actionSequencer.getLiveActorX(targetId, tb.x);
          const hitY = tb.groundY - tb.heightPx * 0.45;
          spawnBurst(
            sim,
            liveX,
            hitY,
            isCrit ? 26 : isAoe ? 18 : 14,
            isCrit ? '#FFE066' : isAoe ? '#FF2E7E' : '#00F0FF',
            1,
            isCrit ? 1.35 : 1.15,
          );
          spawnFloatingText(
            sim,
            liveX,
            hitY - 34,
            isCrit ? 'CRIT -28!' : isAoe ? `-${16 + idx * 2}` : isRanged ? '-16' : '-14',
            isCrit ? '#FFE066' : isAoe ? '#FF6B9E' : '#38BDF8',
            isCrit ? 1.38 : 1.1,
          );
        },
      },
      presCfg,
      w,
      h,
    );
    setLastCameraTrigger(kind);
    sim.needsRedraw = true;
    requestDraw();
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!spitterLabOpen && !bruteLabOpen && !cameraLabOpen) return;
    const spitterKeyMap: Record<string, SpitterJuiceTrigger> = {
      '1': 'idle',
      '2': 'advance_retreat',
      '3': 'attack_lunge',
      '4': 'cast_charge',
      '5': 'take_hit',
      '6': 'turn_around',
    };
    const bruteKeyMap: Record<string, BruteJuiceTrigger> = {
      '1': 'idle',
      '2': 'stomp_walk',
      '3': 'seismic_smash',
      '4': 'mutagen_brace',
      '5': 'take_hit',
      '6': 'turn_around',
    };
    const cameraKeyMap: Record<
      string,
      'melee_normal' | 'melee_crit' | 'ranged_single' | 'ranged_aoe' | 'kira_dodge'
    > = {
      '1': 'melee_normal',
      '2': 'melee_crit',
      '3': 'ranged_single',
      '4': 'ranged_aoe',
      '5': 'kira_dodge',
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (cameraLabOpen) {
        const trig = cameraKeyMap[e.key];
        if (trig) {
          e.preventDefault();
          e.stopPropagation();
          fireCameraTrigger(trig);
        }
        return;
      }
      if (bruteLabOpen) {
        const trig = bruteKeyMap[e.key];
        if (trig) {
          e.preventDefault();
          e.stopPropagation();
          fireBruteTrigger(trig);
        }
        return;
      }
      if (spitterLabOpen) {
        const trig = spitterKeyMap[e.key];
        if (trig) {
          e.preventDefault();
          e.stopPropagation();
          fireSpitterTrigger(trig);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  });

  const toggleButtons = (
    <>
      <button
        type="button"
        data-testid="spitter-lab-toggle"
        aria-pressed={spitterLabOpen}
        onClick={() => {
          setSpitterLabOpen((prev) => {
            const next = !prev;
            if (next) {
              setBruteLabOpen(false);
              setCameraLabOpen(false);
            }
            return next;
          });
        }}
        title="Open Bile Spitter 4-Layer Procedural Juice Lab & Keys 1–6 Test Harness"
        className={`rounded px-1.5 py-0.5 text-[11px] font-extrabold tracking-wider uppercase whitespace-nowrap transition-colors cursor-pointer ${
          spitterLabOpen
            ? 'bg-lime-400 text-slate-950 ring-1 ring-lime-300 shadow-[0_0_10px_rgba(163,230,53,0.5)]'
            : 'bg-slate-900/90 text-lime-300/90 ring-1 ring-lime-400/35 hover:text-white'
        }`}
      >
        ⬡ SPITTER
      </button>
      <button
        type="button"
        data-testid="brute-lab-toggle"
        aria-pressed={bruteLabOpen}
        onClick={() => {
          setBruteLabOpen((prev) => {
            const next = !prev;
            if (next) {
              setSpitterLabOpen(false);
              setCameraLabOpen(false);
            }
            return next;
          });
        }}
        title="Open Carapace Brute 4-Layer Procedural Juice Lab & Keys 1–6 Test Harness"
        className={`rounded px-1.5 py-0.5 text-[11px] font-extrabold tracking-wider uppercase whitespace-nowrap transition-colors cursor-pointer ${
          bruteLabOpen
            ? 'bg-amber-400 text-slate-950 ring-1 ring-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.5)]'
            : 'bg-slate-900/90 text-amber-300/90 ring-1 ring-amber-400/35 hover:text-white'
        }`}
      >
        ■ BRUTE
      </button>
      <button
        type="button"
        data-testid="camera-lab-toggle"
        aria-pressed={cameraLabOpen}
        onClick={() => {
          setCameraLabOpen((prev) => {
            const next = !prev;
            if (next) {
              setSpitterLabOpen(false);
              setBruteLabOpen(false);
            }
            return next;
          });
        }}
        title="Open Action Camera & Cut-In Lab (Keys 1–5 Test Triggers)"
        className={`rounded px-1.5 py-0.5 text-[11px] font-extrabold tracking-wider uppercase whitespace-nowrap transition-colors cursor-pointer ${
          cameraLabOpen
            ? 'bg-cyan-300 text-slate-950 ring-1 ring-cyan-200 shadow-[0_0_10px_rgba(0,240,255,0.5)]'
            : 'bg-slate-900/90 text-cyan-200/90 ring-1 ring-cyan-400/35 hover:text-white'
        }`}
      >
        ◎ CAMERA
      </button>
    </>
  );

  return (
    <>
      {toolbarMountNode && createPortal(toggleButtons, toolbarMountNode)}

      {spitterLabOpen && (
        <CombatSpitterLabPanel
          spitterJuiceConfig={spitterJuiceConfig}
          setSpitterJuiceConfig={setSpitterJuiceConfig}
          lastSpitterTrigger={lastSpitterTrigger}
          onFireTrigger={fireSpitterTrigger}
          onOpenBruteLab={() => {
            setSpitterLabOpen(false);
            setCameraLabOpen(false);
            setBruteLabOpen(true);
          }}
          onOpenCameraLab={() => {
            setSpitterLabOpen(false);
            setBruteLabOpen(false);
            setCameraLabOpen(true);
          }}
          onClose={() => setSpitterLabOpen(false)}
        />
      )}

      {bruteLabOpen && (
        <CombatBruteLabPanel
          bruteJuiceConfig={bruteJuiceConfig}
          setBruteJuiceConfig={setBruteJuiceConfig}
          lastBruteTrigger={lastBruteTrigger}
          onFireTrigger={fireBruteTrigger}
          onOpenSpitterLab={() => {
            setBruteLabOpen(false);
            setCameraLabOpen(false);
            setSpitterLabOpen(true);
          }}
          onOpenCameraLab={() => {
            setBruteLabOpen(false);
            setSpitterLabOpen(false);
            setCameraLabOpen(true);
          }}
          onClose={() => setBruteLabOpen(false)}
        />
      )}

      {cameraLabOpen && (
        <CombatCameraLabPanel
          presentationConfig={presentationConfig}
          setPresentationConfig={setPresentationConfig}
          lastCameraTrigger={lastCameraTrigger}
          onFireTrigger={fireCameraTrigger}
          onOpenSpitterLab={() => {
            setCameraLabOpen(false);
            setBruteLabOpen(false);
            setSpitterLabOpen(true);
          }}
          onOpenBruteLab={() => {
            setCameraLabOpen(false);
            setSpitterLabOpen(false);
            setBruteLabOpen(true);
          }}
          onReset={() => {
            setPresentationConfig(DEFAULT_COMBAT_PRESENTATION_CONFIG);
            simRef.current?.actionSequencer.reset();
            setLastCameraTrigger('idle');
          }}
          onClose={() => setCameraLabOpen(false)}
        />
      )}
    </>
  );
}

export default CombatDevLabsPanel;
