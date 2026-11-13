import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { soundEngine } from './audio/soundEngine';
import { BioMedBayView } from './components/BioMedBayView';
import { CombatStageCanvas } from './components/CombatStageCanvas';
import { CyberClinicView } from './components/CyberClinicView';
import { EndRunModal, PauseModal, PoolModal } from './components/Modals';
import { SectorMapView } from './components/SectorMapView';
import { TacticalDock } from './components/TacticalDock';
import { TitleScreen } from './components/TitleScreen';
import { TopHud } from './components/TopHud';
import { EQUIPMENT_BY_ID } from './engine/data';
import {
  advanceRoundAfterEnemies,
  applyMedBayAction,
  buyClinicEquipment,
  claimCombatEquipmentReward,
  createInitialRun,
  equipEquipmentInstance,
  executeOverdrive,
  executeSingleEnemyAction,
  installCyberImplant,
  previewColorResolution,
  resolvePlayerColor,
  skipCyberClinic,
  startNodeEncounter,
  unequipEquipmentInstance,
} from './engine/gameEngine';
import {
  clearActiveRun,
  loadActiveRun,
  loadBestRecord,
  recordRunCompletion,
  saveActiveRun,
} from './engine/persistence';
import type { BestRunRecord, CyberImplantId, RunState, TileType } from './engine/types';
import { TRANSLATIONS, type Language } from './i18n/translations';
import { formatTileShortLabel } from './utils/tileDisplay';

function isAutostartEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('autostart') === '1';
}

function loadValidSavedRun(): RunState | null {
  const loaded = loadActiveRun();
  if (loaded && loaded.screen !== 'victory' && loaded.screen !== 'gameover') {
    return loaded;
  }
  return null;
}

function blurActiveElement(): void {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}

export default function App() {
  const [lang, setLang] = useState<Language>('en');
  const [muted, setMuted] = useState<boolean>(() => soundEngine.isMuted());
  const [hudMinimized, setHudMinimized] = useState<boolean>(false);
  const [showTitle, setShowTitle] = useState<boolean>(() => !isAutostartEnabled());
  const [paused, setPaused] = useState<boolean>(false);
  const [poolModalOpen, setPoolModalOpen] = useState<boolean>(false);
  const [hoveredColor, setHoveredColor] = useState<TileType | null>(null);
  const [selectedColor, setSelectedColor] = useState<TileType | null>(null);
  const [bestRecord, setBestRecord] = useState<BestRunRecord>(() => loadBestRecord());

  const [initialState] = useState<{ saved: RunState | null; active: RunState }>(() => {
    const loaded = loadValidSavedRun();
    return {
      saved: loaded,
      active: loaded ?? createInitialRun(104729),
    };
  });

  const [savedRunSnapshot, setSavedRunSnapshot] = useState<RunState | null>(initialState.saved);
  const [run, setRun] = useState<RunState>(initialState.active);
  const [readyOutcomeKey, setReadyOutcomeKey] = useState<string | null>(null);

  const runRef = useRef(run);
  runRef.current = run;
  const enemyActedSetRef = useRef<Set<number>>(new Set());
  const recordedRunIdRef = useRef<string | null>(null);
  const lastPersistedRunRef = useRef<RunState | null>(initialState.saved);

  const t = TRANSLATIONS[lang];
  const combat = run.combat;

  const isPostCombatOutcome = Boolean(
    (run.screen === 'combat' && combat?.phase === 'VICTORY') ||
      run.screen === 'victory' ||
      run.screen === 'gameover',
  );
  const outcomeKey = isPostCombatOutcome
    ? `${run.runId}_${combat?.nodeId ?? 'end'}_${run.screen}_${combat?.phase ?? ''}`
    : null;
  const postCombatOverlayReady = Boolean(outcomeKey && readyOutcomeKey === outcomeKey);

  // Wait for the full hit, enemy stagger, blood spray, and KO animation of the last enemy before showing reward UI
  useEffect(() => {
    if (showTitle || paused || !outcomeKey) {
      return;
    }
    if (readyOutcomeKey === outcomeKey) {
      return;
    }

    const cues = combat?.lastCues ?? [];
    const hasOverdrive = cues.some((c) => c.kind === 'hero_overdrive');
    const hasSlash = cues.some((c) => c.kind === 'hero_slash');
    const delayMs =
      cues.length === 0
        ? 180
        : hasOverdrive
          ? 1580
          : hasSlash
            ? 1320
            : 1120;

    const tid = window.setTimeout(() => {
      setReadyOutcomeKey(outcomeKey);
    }, delayMs);

    return () => {
      window.clearTimeout(tid);
    };
  }, [combat?.lastCues, outcomeKey, paused, readyOutcomeKey, showTitle]);

  // Pause-safe, StrictMode-safe staggered enemy turn stepper
  useEffect(() => {
    if (showTitle || paused || poolModalOpen || run.screen !== 'combat' || !combat) {
      return;
    }

    if (combat.phase !== 'PLAYER_RESOLVED' && combat.phase !== 'ENEMY_ACTING') {
      enemyActedSetRef.current.clear();
      return;
    }

    const nextEnemyIdx = combat.enemies.findIndex(
      (e, idx) => e.hp > 0 && !enemyActedSetRef.current.has(idx),
    );

    const hasPrimaryAttackCue = combat.lastCues.some(
      (c) => c.kind === 'hero_slash' && !c.id.endsWith('_def_pulse'),
    );
    const hasTechCue = combat.lastCues.some((c) => c.kind === 'hero_tech');
    const delayMs =
      combat.phase === 'PLAYER_RESOLVED'
        ? hasTechCue
          ? 940
          : hasPrimaryAttackCue
            ? 880
            : 560
        : 560;
    const tid = window.setTimeout(() => {
      if (nextEnemyIdx !== -1) {
        enemyActedSetRef.current.add(nextEnemyIdx);
        const nextState = executeSingleEnemyAction(run, nextEnemyIdx);
        const cues = nextState.combat?.lastCues ?? [];
        if (cues.some((c) => c.kind === 'enemy_acid')) soundEngine.playAcidSpit();
        else if (cues.some((c) => c.kind === 'enemy_attack')) soundEngine.playEnemyHit();
        else if (cues.some((c) => c.kind === 'enemy_armor')) soundEngine.playEnemyArmor();
        setRun(nextState);
      } else {
        enemyActedSetRef.current.clear();
        setRun((prev) => advanceRoundAfterEnemies(prev));
      }
    }, delayMs);

    return () => {
      window.clearTimeout(tid);
    };
  }, [combat, paused, poolModalOpen, run, showTitle]);

  // Sync document.body.dataset.state cleanly without triggering storage writes
  useEffect(() => {
    if (showTitle) {
      document.body.dataset.state = 'title';
    } else if (run.screen === 'victory' || run.screen === 'gameover') {
      document.body.dataset.state = 'gameover';
    } else {
      document.body.dataset.state = paused ? 'paused' : 'playing';
    }
  }, [showTitle, run.screen, paused]);

  // Persist active run only when run actually changes outside title screen
  useEffect(() => {
    if (showTitle) return;

    if (run.screen === 'victory' || run.screen === 'gameover') {
      if (recordedRunIdRef.current !== run.runId) {
        recordedRunIdRef.current = run.runId;
        const nextRecord = recordRunCompletion(run.score, run.screen === 'victory');
        setBestRecord(nextRecord);
        clearActiveRun();
        lastPersistedRunRef.current = null;
        setSavedRunSnapshot(null);
        if (run.screen === 'victory') {
          soundEngine.playVictory();
        } else {
          soundEngine.playDefeat();
        }
      }
      return;
    }

    if (lastPersistedRunRef.current !== run) {
      lastPersistedRunRef.current = run;
      saveActiveRun(run);
      setSavedRunSnapshot(run);
    }
  }, [run, showTitle]);

  const activeColor = hoveredColor ?? selectedColor;

  const activePreview = useMemo(() => {
    if (!activeColor || run.screen !== 'combat' || run.combat?.phase !== 'PLAYER_IDLE') {
      return null;
    }
    return previewColorResolution(run, activeColor);
  }, [run, activeColor]);

  const handleStartNewRun = useCallback(() => {
    enemyActedSetRef.current.clear();
    blurActiveElement();
    soundEngine.playClick();
    clearActiveRun();
    const fresh = createInitialRun(Math.floor(Date.now() % 900000) + 10000);
    recordedRunIdRef.current = null;
    setHoveredColor(null);
    setSelectedColor(null);
    setPaused(false);
    setPoolModalOpen(false);
    setRun(fresh);
    setSavedRunSnapshot(fresh);
    setShowTitle(false);
    document.body.dataset.state = 'playing';
  }, []);

  const handleContinueRun = useCallback(() => {
    blurActiveElement();
    soundEngine.playClick();
    if (savedRunSnapshot) {
      setRun(savedRunSnapshot);
    }
    setHoveredColor(null);
    setSelectedColor(null);
    setPaused(false);
    setPoolModalOpen(false);
    setShowTitle(false);
    document.body.dataset.state = 'playing';
  }, [savedRunSnapshot]);

  const handleReturnToTitle = useCallback(() => {
    enemyActedSetRef.current.clear();
    soundEngine.playClick();
    setHoveredColor(null);
    setSelectedColor(null);
    setPaused(false);
    setPoolModalOpen(false);
    setShowTitle(true);
    document.body.dataset.state = 'title';
  }, []);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      return next;
    });
  }, []);

  const handleToggleHudMinimized = useCallback(() => {
    soundEngine.playClick();
    setHudMinimized((prev) => !prev);
  }, []);

  const handleToggleLang = useCallback(() => {
    soundEngine.playClick();
    setLang((prev) => (prev === 'en' ? 'cs' : 'en'));
  }, []);

  const handleHoverColor = useCallback((color: TileType | null) => {
    setHoveredColor((prev) => {
      if (color && color !== prev) {
        soundEngine.playHover();
      }
      return color;
    });
  }, []);

  const handleSelectColor = useCallback((color: TileType | null) => {
    setSelectedColor((prev) => {
      if (color && color !== prev) {
        soundEngine.playHover();
      }
      return color;
    });
  }, []);

  const handleCommitColor = useCallback(
    (color: TileType) => {
      const currentRun = runRef.current;
      if (showTitle || paused || poolModalOpen) return;
      if (currentRun.screen !== 'combat' || !currentRun.combat || currentRun.combat.phase !== 'PLAYER_IDLE') {
        return;
      }
      const preview = previewColorResolution(currentRun, color);
      if (preview.tileCount === 0) return;

      if (color === 'attack') soundEngine.playSlash(preview.surgeTriggered);
      else if (color === 'defense') soundEngine.playShield(preview.surgeTriggered);
      else soundEngine.playUpgrade(preview.surgeTriggered);

      enemyActedSetRef.current.clear();
      setRun(resolvePlayerColor(currentRun, color));
      setHoveredColor(null);
      setSelectedColor(null);
    },
    [paused, poolModalOpen, showTitle],
  );

  const handleOverdrive = useCallback(() => {
    const currentRun = runRef.current;
    if (showTitle || paused || poolModalOpen) return;
    if (currentRun.screen !== 'combat' || !currentRun.combat || currentRun.combat.phase !== 'PLAYER_IDLE') {
      return;
    }
    if (currentRun.heroine.overdrive < 100) return;
    soundEngine.playOverdrive();
    setHoveredColor(null);
    setSelectedColor(null);
    setRun((prev) => executeOverdrive(prev));
  }, [paused, poolModalOpen, showTitle]);

  const handleClaimCombatReward = useCallback((defId: string | null) => {
    soundEngine.playClick();
    setRun((prev) => claimCombatEquipmentReward(prev, defId));
  }, []);

  const handleSelectMapNode = useCallback((nodeId: string) => {
    soundEngine.playClick();
    setHoveredColor(null);
    setSelectedColor(null);
    setRun((prev) => startNodeEncounter(prev, nodeId));
  }, []);

  const handleBuyEquipment = useCallback((defId: string) => {
    soundEngine.playUpgrade(false);
    setRun((prev) => buyClinicEquipment(prev, defId));
  }, []);

  const handleInstallImplant = useCallback(
    (implantId: CyberImplantId, replaceId?: CyberImplantId) => {
      soundEngine.playUpgrade(true);
      setRun((prev) => installCyberImplant(prev, implantId, replaceId));
    },
    [],
  );

  const handleSkipClinic = useCallback(() => {
    soundEngine.playClick();
    setRun((prev) => skipCyberClinic(prev));
  }, []);

  const handleMedBayAction = useCallback(
    (action: 'heal' | 'calibrate_max_hp' | 'salvage_credits') => {
      soundEngine.playUpgrade(false);
      setRun((prev) => applyMedBayAction(prev, action));
    },
    [],
  );

  const handleEquipInstance = useCallback((instanceId: string) => {
    soundEngine.playClick();
    setRun((prev) => equipEquipmentInstance(prev, instanceId));
  }, []);

  const handleUnequipInstance = useCallback((instanceId: string) => {
    soundEngine.playClick();
    setRun((prev) => unequipEquipmentInstance(prev, instanceId));
  }, []);

  const handleOpenPool = useCallback(() => {
    soundEngine.playClick();
    setPoolModalOpen(true);
  }, []);

  const handleClosePool = useCallback(() => {
    setPoolModalOpen(false);
  }, []);

  const handleOpenPause = useCallback(() => {
    soundEngine.playClick();
    setPaused(true);
  }, []);

  const handleResumePause = useCallback(() => {
    setPaused(false);
  }, []);

  // Global & Gameplay Keyboard Controls
  useEffect(() => {
    const isInteractiveFocused = (target: EventTarget | null): boolean =>
      target instanceof HTMLElement && Boolean(target.closest('button, a, input, select, textarea'));

    const onKeyDown = (e: KeyboardEvent) => {
      if (showTitle) {
        if ((e.key === 'Enter' || e.key === ' ') && !isInteractiveFocused(e.target)) {
          e.preventDefault();
          if (savedRunSnapshot) handleContinueRun();
          else handleStartNewRun();
          return;
        }
        if (e.key.toLowerCase() === 'l') {
          handleToggleLang();
          return;
        }
        return;
      }

      if (e.key === 'Escape' || e.key.toLowerCase() === 'p') {
        e.preventDefault();
        if (poolModalOpen) {
          setPoolModalOpen(false);
        } else if (run.screen !== 'victory' && run.screen !== 'gameover') {
          setPaused((prev) => !prev);
        }
        return;
      }

      if (e.key.toLowerCase() === 'm') {
        handleToggleMute();
        return;
      }
      if (e.key.toLowerCase() === 'l') {
        handleToggleLang();
        return;
      }
      if (e.key.toLowerCase() === 'h' && run.screen === 'combat') {
        handleToggleHudMinimized();
        return;
      }

      if (paused || poolModalOpen) return;

      if (run.screen === 'combat') {
        if (e.key === '1') {
          handleCommitColor('attack');
        } else if (e.key === '2') {
          handleCommitColor('defense');
        } else if (e.key === '3') {
          handleCommitColor('tech');
        } else if (e.key === ' ' && !isInteractiveFocused(e.target)) {
          e.preventDefault();
          handleOverdrive();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handleCommitColor,
    handleContinueRun,
    handleOverdrive,
    handleStartNewRun,
    handleToggleHudMinimized,
    handleToggleLang,
    handleToggleMute,
    paused,
    poolModalOpen,
    run.screen,
    savedRunSnapshot,
    showTitle,
  ]);

  const board = combat?.board;
  const countByColor = useMemo(() => {
    const counts: Record<TileType, number> = { attack: 0, defense: 0, tech: 0 };
    if (!board) return counts;
    for (const tile of board) {
      counts[tile.type] += 1;
    }
    return counts;
  }, [board]);

  const canPlay = Boolean(
    !showTitle &&
      !paused &&
      !poolModalOpen &&
      run.screen === 'combat' &&
      combat &&
      combat.phase === 'PLAYER_IDLE',
  );

  if (showTitle) {
    return (
      <TitleScreen
        lang={lang}
        onToggleLang={handleToggleLang}
        hasSavedRun={Boolean(savedRunSnapshot)}
        bestScore={bestRecord.bestScore}
        sectorsCleared={bestRecord.sectorsCleared}
        onStartNewRun={handleStartNewRun}
        onContinueRun={handleContinueRun}
      />
    );
  }

  return (
    <div className="cyber-vista-bg flex min-h-screen w-full flex-col overflow-y-auto lg:h-screen lg:overflow-hidden text-slate-100">
      <TopHud
        run={run}
        lang={lang}
        muted={muted}
        hudMinimized={hudMinimized}
        activePreview={activePreview}
        onToggleHudMinimized={handleToggleHudMinimized}
        onToggleLang={handleToggleLang}
        onToggleMute={handleToggleMute}
        onOpenPool={handleOpenPool}
        onOpenPause={handleOpenPause}
      />

      {run.screen === 'map' && (
        <SectorMapView
          run={run}
          lang={lang}
          modalOpen={paused || poolModalOpen}
          onSelectNode={handleSelectMapNode}
          onOpenLoadout={handleOpenPool}
        />
      )}

      {run.screen === 'clinic' && (
        <CyberClinicView
          run={run}
          lang={lang}
          onBuyEquipment={handleBuyEquipment}
          onInstall={handleInstallImplant}
          onSkip={handleSkipClinic}
        />
      )}

      {run.screen === 'medbay' && (
        <BioMedBayView run={run} lang={lang} onAction={handleMedBayAction} />
      )}

      {(run.screen === 'combat' || run.screen === 'victory' || run.screen === 'gameover') &&
        combat && (
          <>
            <div className="relative flex flex-1 min-h-0 flex-col">
              <CombatStageCanvas
                runId={run.runId}
                combat={combat}
                heroine={run.heroine}
                lang={lang}
                activePreview={activePreview}
                paused={paused}
              />

              {/* Non-boss Combat Clear + Equipment Loot Overlay (shown after full hit & KO animation) */}
              {run.screen === 'combat' && combat.phase === 'VICTORY' && postCombatOverlayReady && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm animate-fadeIn">
                  <div className="chrome-panel-bright w-full max-w-2xl rounded-2xl p-6">
                    <div className="text-center">
                      <h2 className="chrome-text-shimmer font-display text-2xl font-bold">
                        {t.combatVictory}
                      </h2>
                      <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-xs font-mono-tabular text-slate-200">
                        <span>
                          {t.turnsLabel}: {combat.turn}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {t.damageDealtLabel}: {combat.totalDamageDealt}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-bold text-[#FFC700]">
                          +{combat.rewardCredits} {t.creditsLabel}
                        </span>
                      </div>
                    </div>

                    {combat.rewardEquipmentChoices.length > 0 && (
                      <div className="mt-4">
                        <div className="text-center text-xs font-bold uppercase tracking-wider text-[#00F0FF]">
                          {t.combatLootPrompt}
                        </div>
                        <div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {combat.rewardEquipmentChoices.map((defId) => {
                            const def = EQUIPMENT_BY_ID[defId];
                            if (!def) return null;
                            const meta = t.equipment[def.id];
                            return (
                              <button
                                key={defId}
                                type="button"
                                onClick={() => handleClaimCombatReward(defId)}
                                className="chrome-pill flex flex-col justify-between rounded-xl border-cyan-300/45 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-[#00F0FF] cursor-pointer"
                              >
                                <div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-display text-base font-bold text-white">
                                      {meta?.name ?? def.id}
                                    </span>
                                    <span className="font-mono-tabular text-xs font-bold text-[#00F0FF]">
                                      {t.sizeLabel}: {def.size}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-xs text-slate-200">{meta?.desc ?? ''}</p>
                                  <div className="mt-2 flex flex-wrap items-center gap-1.5 font-mono-tabular text-[11px]">
                                    {def.tiles.map((spec, idx) => (
                                      <span
                                        key={`${defId}_loot_${idx}`}
                                        className={`font-bold ${
                                          spec.type === 'attack'
                                            ? 'text-rose-200'
                                            : spec.type === 'defense'
                                              ? 'text-cyan-200'
                                              : 'text-amber-200'
                                        }`}
                                      >
                                        {idx > 0 ? '· ' : ''}
                                        {formatTileShortLabel(spec, lang)}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <div className="mt-3 text-xs font-bold text-[#00F0FF]">
                                  {t.claimEquipment} →
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="mt-5 flex justify-center">
                      <button
                        type="button"
                        onClick={() => handleClaimCombatReward(null)}
                        className="chrome-pill rounded-lg px-5 py-2.5 text-xs font-bold text-white transition-colors hover:border-[#FFC700] cursor-pointer"
                      >
                        {combat.rewardEquipmentChoices.length > 0
                          ? t.salvageForCredits
                          : t.continueToMap}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <TacticalDock
              run={run}
              lang={lang}
              canPlay={canPlay}
              hudMinimized={hudMinimized}
              activeColor={activeColor}
              selectedColor={selectedColor}
              activePreview={activePreview}
              countByColor={countByColor}
              onHoverColor={handleHoverColor}
              onSelectColor={handleSelectColor}
              onCommitColor={handleCommitColor}
              onOverdrive={handleOverdrive}
            />
          </>
        )}

      {poolModalOpen && (
        <PoolModal
          run={run}
          lang={lang}
          onEquip={handleEquipInstance}
          onUnequip={handleUnequipInstance}
          onClose={handleClosePool}
        />
      )}

      {paused && (
        <PauseModal
          lang={lang}
          onResume={handleResumePause}
          onRestart={handleStartNewRun}
          onTitle={handleReturnToTitle}
        />
      )}

      {(run.screen === 'victory' || run.screen === 'gameover') && postCombatOverlayReady && (
        <EndRunModal
          outcome={run.screen}
          lang={lang}
          score={run.score}
          bestScore={bestRecord.bestScore}
          turns={run.turnsCompleted}
          enemiesDefeated={run.enemiesDefeated}
          onPlayAgain={handleStartNewRun}
          onTitle={handleReturnToTitle}
        />
      )}
    </div>
  );
}
