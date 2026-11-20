import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useEffect,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import type { CombatState, EnemyArchetype, HeroState } from '../../engine/types';
import {
  type BruteJuiceConfig,
  type BruteJuiceTrigger,
  DEFAULT_BRUTE_JUICE_CONFIG,
  createBruteJuiceState,
  triggerBruteJuiceState,
} from '../../utils/bruteJuiceController';
import { triggerCharacterAnimation } from '../../utils/characterAnimator';
import { HEROINE_DODGE_DURATION } from '../../utils/kiraSpriteSheet';
import {
  DEFAULT_SPITTER_JUICE_CONFIG,
  type SpitterJuiceConfig,
  type SpitterJuiceTrigger,
  createSpitterJuiceState,
  triggerSpitterJuiceState,
} from '../../utils/spitterJuiceController';
import type { CameraActorBounds } from './ActionCameraController';
import type { CutInActionKind, CutInStagingMode } from './CombatActionSequencer';
import {
  type DevLabRenderPassContext,
  renderDevLabPass,
} from './combatDevLabRenderer';
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
import {
  type CombatStageSim,
  getBridgeGroundY,
  getEnemyLaneMetrics,
} from './combatStageTypes';
import {
  ensureEnemyAnim,
  spawnBurst,
  spawnFloatingText,
  spawnStyledProjectileVolley,
  triggerKiraDodgeVfx,
} from './combatVfx';

export type CameraLabTriggerKind =
  | 'idle'
  | 'melee_normal'
  | 'melee_crit'
  | 'ranged_single'
  | 'ranged_aoe'
  | 'kira_dodge';

export interface CombatDevLabsRuntimeState {
  spitterLabActive: boolean;
  spitterJuiceConfig: SpitterJuiceConfig;
  bruteLabActive: boolean;
  bruteJuiceConfig: BruteJuiceConfig;
  cameraLabActive: boolean;
  presentationConfig: CombatPresentationConfig;
  devLabRenderer?: (ctx: DevLabRenderPassContext) => void;
}

export interface CombatDevLabsPanelProps {
  simRef: MutableRefObject<CombatStageSim | null>;
  combatRef: MutableRefObject<CombatState>;
  heroRef: MutableRefObject<HeroState>;
  tacticalViewRef: MutableRefObject<boolean>;
  labRuntimeRef: MutableRefObject<CombatDevLabsRuntimeState>;
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  toolbarMountNode: HTMLElement | null;
  requestDraw: () => void;
  onExtraArchetypesChange: Dispatch<SetStateAction<EnemyArchetype[]>>;
}

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
          holdDurationOverrideSec: HEROINE_DODGE_DURATION + 0.04,
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
        <div
          role="region"
          data-testid="camera-lab-panel"
          aria-label="Combat Action Camera & Cut-In Lab"
          onClick={(e) => e.stopPropagation()}
          className="aaa-charcoal-surface pointer-events-auto absolute left-2 bottom-2 z-30 w-[332px] max-w-[calc(100vw-16px)] max-h-[calc(100%-8px)] overflow-y-auto sm:w-[376px] rounded-xl border border-cyan-400/65 bg-[#0B121E]/95 p-2.5 text-[10px] font-mono-tabular text-slate-100 shadow-2xl"
        >
          <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-cyan-300 text-[9px] font-black text-slate-950">
                ◎
              </span>
              <span className="font-display text-[11px] font-extrabold tracking-wider text-cyan-200 uppercase">
                Action Camera Lab
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                data-testid="spitter-lab-tab-from-cam"
                onClick={() => {
                  setCameraLabOpen(false);
                  setBruteLabOpen(false);
                  setSpitterLabOpen(true);
                }}
                className="rounded border border-lime-400/40 bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-lime-300 hover:text-white cursor-pointer"
              >
                ⬡ Spitter
              </button>
              <button
                type="button"
                data-testid="brute-lab-tab-from-cam"
                onClick={() => {
                  setCameraLabOpen(false);
                  setSpitterLabOpen(false);
                  setBruteLabOpen(true);
                }}
                className="rounded border border-amber-400/40 bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-amber-300 hover:text-white cursor-pointer"
              >
                ■ Brute
              </button>
              <button
                type="button"
                data-testid="camera-lab-reset-btn"
                onClick={() => {
                  setPresentationConfig(DEFAULT_COMBAT_PRESENTATION_CONFIG);
                  simRef.current?.actionSequencer.reset();
                  setLastCameraTrigger('idle');
                }}
                className="rounded border border-white/15 bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-slate-300 hover:text-white cursor-pointer"
              >
                Reset
              </button>
              <button
                type="button"
                data-testid="camera-lab-close-btn"
                onClick={() => setCameraLabOpen(false)}
                className="rounded border border-white/15 bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-slate-300 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-1">
            {(
              [
                { key: '1', id: 'melee_normal', label: '1 · Melee Hit' },
                { key: '2', id: 'melee_crit', label: '2 · Melee Crit' },
                { key: '3', id: 'ranged_single', label: '3 · Ranged Shot' },
                { key: '4', id: 'ranged_aoe', label: '4 · Ranged AoE' },
                { key: '5', id: 'kira_dodge', label: '5 · Kira Dodge' },
              ] as const
            ).map((btn) => {
              const active = lastCameraTrigger === btn.id;
              return (
                <button
                  key={btn.id}
                  type="button"
                  data-testid={`camera-trigger-${btn.key}`}
                  onClick={() => fireCameraTrigger(btn.id)}
                  className={`rounded px-2 py-1 text-left text-[9px] font-extrabold whitespace-nowrap transition-colors cursor-pointer ${
                    active
                      ? 'bg-cyan-300 text-slate-950 ring-1 ring-cyan-100'
                      : 'bg-slate-900/90 text-cyan-200 ring-1 ring-white/15 hover:bg-slate-800'
                  }`}
                >
                  {btn.label}
                </button>
              );
            })}
          </div>

          <div className="mt-2 space-y-1 border-t border-white/10 pt-1.5">
            <label className="flex items-center justify-between gap-2">
              <span className="text-slate-300">Wind-up (s)</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="range"
                  min={0.08}
                  max={0.35}
                  step={0.01}
                  value={presentationConfig.windupSec}
                  onChange={(e) =>
                    setPresentationConfig((c) => ({ ...c, windupSec: Number(e.target.value) }))
                  }
                  className="h-1 w-24 accent-cyan-300"
                />
                <span className="w-11 text-right font-bold text-cyan-200">
                  {presentationConfig.windupSec.toFixed(2)}s
                </span>
              </div>
            </label>

            <label className="flex items-center justify-between gap-2">
              <span className="text-slate-300">Hit-Stop Norm (ms)</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="range"
                  min={40}
                  max={280}
                  step={10}
                  value={Math.round(presentationConfig.hitstopNormalSec * 1000)}
                  onChange={(e) =>
                    setPresentationConfig((c) => ({
                      ...c,
                      hitstopNormalSec: Number(e.target.value) / 1000,
                    }))
                  }
                  className="h-1 w-24 accent-cyan-300"
                />
                <span className="w-11 text-right font-bold text-cyan-200">
                  {Math.round(presentationConfig.hitstopNormalSec * 1000)}ms
                </span>
              </div>
            </label>

            <label className="flex items-center justify-between gap-2">
              <span className="text-slate-300">Hit-Stop Crit (ms)</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="range"
                  min={100}
                  max={420}
                  step={10}
                  value={Math.round(presentationConfig.hitstopCritSec * 1000)}
                  onChange={(e) =>
                    setPresentationConfig((c) => ({
                      ...c,
                      hitstopCritSec: Number(e.target.value) / 1000,
                    }))
                  }
                  className="h-1 w-24 accent-cyan-300"
                />
                <span className="w-11 text-right font-bold text-cyan-200">
                  {Math.round(presentationConfig.hitstopCritSec * 1000)}ms
                </span>
              </div>
            </label>

            <label className="flex items-center justify-between gap-2">
              <span className="text-slate-300">Zoom Norm / Crit</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="range"
                  min={1.15}
                  max={1.85}
                  step={0.02}
                  value={presentationConfig.zoomCrit}
                  onChange={(e) => {
                    const crit = Number(e.target.value);
                    setPresentationConfig((c) => ({
                      ...c,
                      zoomCrit: crit,
                      zoomNormal: Math.max(1.1, Math.min(crit - 0.12, c.zoomNormal)),
                    }));
                  }}
                  className="h-1 w-24 accent-cyan-300"
                />
                <span className="w-11 text-right font-bold text-cyan-200">
                  {presentationConfig.zoomCrit.toFixed(2)}×
                </span>
              </div>
            </label>

            <label className="flex items-center justify-between gap-2">
              <span className="text-slate-300">Hold Creep (%)</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="range"
                  min={0}
                  max={15}
                  step={1}
                  value={Math.round(presentationConfig.holdZoomCreepPct * 100)}
                  onChange={(e) =>
                    setPresentationConfig((c) => ({
                      ...c,
                      holdZoomCreepPct: Number(e.target.value) / 100,
                    }))
                  }
                  className="h-1 w-24 accent-cyan-300"
                />
                <span className="w-11 text-right font-bold text-cyan-200">
                  +{Math.round(presentationConfig.holdZoomCreepPct * 100)}%
                </span>
              </div>
            </label>

            <label className="flex items-center justify-between gap-2">
              <span className="text-slate-300">Clash Gap (% VW)</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="range"
                  min={8}
                  max={22}
                  step={0.5}
                  value={Number((presentationConfig.meleeClashGapVw * 100).toFixed(1))}
                  onChange={(e) =>
                    setPresentationConfig((c) => ({
                      ...c,
                      meleeClashGapVw: Number(e.target.value) / 100,
                    }))
                  }
                  className="h-1 w-24 accent-cyan-300"
                />
                <span className="w-11 text-right font-bold text-cyan-200">
                  {(presentationConfig.meleeClashGapVw * 100).toFixed(1)}%
                </span>
              </div>
            </label>

            <label className="flex items-center justify-between gap-2">
              <span className="text-slate-300">Dutch Tilt Crit (°)</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="range"
                  min={0}
                  max={5}
                  step={0.1}
                  value={presentationConfig.dutchDegCrit}
                  onChange={(e) =>
                    setPresentationConfig((c) => ({ ...c, dutchDegCrit: Number(e.target.value) }))
                  }
                  className="h-1 w-24 accent-cyan-300"
                />
                <span className="w-11 text-right font-bold text-cyan-200">
                  {presentationConfig.dutchDegCrit.toFixed(1)}°
                </span>
              </div>
            </label>

            <label className="flex items-center justify-between gap-2">
              <span className="text-slate-300">Shake Crit (% VW)</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="range"
                  min={0.4}
                  max={3.5}
                  step={0.1}
                  value={Number((presentationConfig.shakeCritVw * 100).toFixed(1))}
                  onChange={(e) =>
                    setPresentationConfig((c) => ({
                      ...c,
                      shakeCritVw: Number(e.target.value) / 100,
                    }))
                  }
                  className="h-1 w-24 accent-cyan-300"
                />
                <span className="w-11 text-right font-bold text-cyan-200">
                  {(presentationConfig.shakeCritVw * 100).toFixed(1)}%
                </span>
              </div>
            </label>

            <label className="flex items-center justify-between gap-2">
              <span className="text-slate-300">Knockback (% VW)</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="range"
                  min={2}
                  max={9}
                  step={0.5}
                  value={Number((presentationConfig.knockbackNormalVw * 100).toFixed(1))}
                  onChange={(e) => {
                    const norm = Number(e.target.value) / 100;
                    setPresentationConfig((c) => ({
                      ...c,
                      knockbackNormalVw: norm,
                      knockbackCritVw: Math.min(0.11, norm * 1.35),
                    }));
                  }}
                  className="h-1 w-24 accent-cyan-300"
                />
                <span className="w-11 text-right font-bold text-cyan-200">
                  {(presentationConfig.knockbackNormalVw * 100).toFixed(1)}%
                </span>
              </div>
            </label>

            <label className="flex items-center justify-between gap-2">
              <span className="text-slate-300">AoE Cascade (ms)</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="range"
                  min={20}
                  max={80}
                  step={5}
                  value={presentationConfig.aoeCascadeStepMs}
                  onChange={(e) =>
                    setPresentationConfig((c) => ({
                      ...c,
                      aoeCascadeStepMs: Number(e.target.value),
                    }))
                  }
                  className="h-1 w-24 accent-cyan-300"
                />
                <span className="w-11 text-right font-bold text-cyan-200">
                  {presentationConfig.aoeCascadeStepMs}ms
                </span>
              </div>
            </label>

            <label className="flex items-center justify-between gap-2">
              <span className="text-slate-300">Stage Dimmer</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="range"
                  min={0}
                  max={0.85}
                  step={0.05}
                  value={presentationConfig.dimmerAlpha}
                  onChange={(e) =>
                    setPresentationConfig((c) => ({ ...c, dimmerAlpha: Number(e.target.value) }))
                  }
                  className="h-1 w-24 accent-cyan-300"
                />
                <span className="w-11 text-right font-bold text-cyan-200">
                  {Math.round(presentationConfig.dimmerAlpha * 100)}%
                </span>
              </div>
            </label>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/10">
              <label className="flex items-center gap-1 cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={presentationConfig.adaptivePackSpeedup}
                  onChange={(e) =>
                    setPresentationConfig((c) => ({
                      ...c,
                      adaptivePackSpeedup: e.target.checked,
                    }))
                  }
                  className="accent-cyan-300"
                />
                <span className="text-slate-300">Adaptive Pack</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={presentationConfig.critInvertFlashEnabled}
                  onChange={(e) =>
                    setPresentationConfig((c) => ({
                      ...c,
                      critInvertFlashEnabled: e.target.checked,
                    }))
                  }
                  className="accent-cyan-300"
                />
                <span className="text-slate-300">Crit Flash</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={presentationConfig.hideWorldUiDuringCutIn}
                  onChange={(e) =>
                    setPresentationConfig((c) => ({
                      ...c,
                      hideWorldUiDuringCutIn: e.target.checked,
                    }))
                  }
                  className="accent-cyan-300"
                />
                <span className="text-slate-300">Hide HUD</span>
              </label>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default CombatDevLabsPanel;
