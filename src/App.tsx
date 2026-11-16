import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ensureCombatAssetsReady } from './assets/assetPreloader';
import { soundEngine } from './audio/soundEngine';
import { BioMedBayView } from './components/BioMedBayView';
import { CodexModal, type CodexTab } from './components/CodexModal';
import { CombatStageCanvas } from './components/CombatStageCanvas';
import { CyberClinicView } from './components/CyberClinicView';
import { CyberEventView } from './components/CyberEventView';
import { EndRunModal, PauseModal, PoolModal } from './components/Modals';
import { SectorMapView } from './components/SectorMapView';
import { TacticalDock } from './components/TacticalDock';
import { TitleScreen } from './components/TitleScreen';
import { TopHud } from './components/TopHud';
import { EQUIPMENT_BY_ID, getEquippedEquipmentWeight } from './engine/data';
import {
  advanceRoundAfterEnemies,
  applyMedBayAction,
  buyClinicEquipment,
  claimCombatEquipmentReward,
  createInitialRun,
  equipEquipmentInstance,
  executeOverdrive,
  executeSingleEnemyAction,
  getSurgeThreshold,
  installCyberImplant,
  previewColorResolution,
  resolveCyberEventChoice,
  resolvePlayerColor,
  restockClinicShop,
  scrapEquipmentInstance,
  skipCyberClinic,
  startNodeEncounter,
  unequipEquipmentInstance,
} from './engine/gameEngine';
import { getNodeEncounterIntel } from './engine/mapGenerator';
import {
  clearActiveRun,
  loadActiveRun,
  loadBestRecord,
  loadEncounterSnapshot,
  recordRunCompletion,
  saveActiveRun,
  saveEncounterSnapshot,
} from './engine/persistence';
import type { BestRunRecord, CharacterId, CyberImplantId, RunState, TileType } from './engine/types';
import type { GlossaryTermId } from './i18n/codexTranslations';
import { TRANSLATIONS, type Language } from './i18n/translations';
import {
  cycleSemanticZoomLevel,
  detectPhysicalScreenProfile,
  loadAccessibilityPrefs,
  saveAccessibilityPrefs,
  type AccessibilityPrefs,
} from './utils/accessibilityAndScale';
import {
  applyFailForwardBuff,
  canRepositionEnemies,
  computeContextualMicroPrompt,
  computeEncounterObjectives,
  computeOptimalTurnHint,
  repositionFrontEnemies,
} from './utils/tacticalSandboxAndHints';
import { formatTileShortLabel } from './utils/tileDisplay';
import { useFullscreen } from './utils/useFullscreen';
import { useViewportMetrics } from './utils/useViewportMetrics';

function isAutostartEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('autostart') === '1';
}

function applyBossObjectivesIfVictory(
  state: RunState,
  startingHp: number,
  undosUsed: number,
  lang: Language,
): RunState {
  if (state.screen !== 'victory' || !state.combat || state.combat.nodeType !== 'BOSS') {
    return state;
  }
  const obj = computeEncounterObjectives({
    combat: state.combat,
    heroine: state.heroine,
    startingHp,
    undosUsed,
    lang,
  });
  return {
    ...state,
    score: state.score + obj.bonusScore,
    heroine: {
      ...state.heroine,
      credits: state.heroine.credits + obj.bonusCredits,
      nanites: (state.heroine.nanites ?? 0) + obj.bonusNanites,
    },
  };
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
  const viewport = useViewportMetrics();
  const fullscreen = useFullscreen();
  const [lang, setLang] = useState<Language>('en');
  const [muted, setMuted] = useState<boolean>(() => soundEngine.isMuted());
  const [hudMinimized, setHudMinimized] = useState<boolean>(false);
  const [showTitle, setShowTitle] = useState<boolean>(() => !isAutostartEnabled());
  const [paused, setPaused] = useState<boolean>(false);
  const [poolModalOpen, setPoolModalOpen] = useState<boolean>(false);
  const [codexTarget, setCodexTarget] = useState<{
    tab: CodexTab;
    hero: CharacterId;
    termId: GlossaryTermId | null;
  } | null>(null);
  const [hoveredColor, setHoveredColor] = useState<TileType | null>(null);
  const [selectedColor, setSelectedColor] = useState<TileType | null>(null);
  const [bestRecord, setBestRecord] = useState<BestRunRecord>(() => loadBestRecord());
  const [altHeldTactical, setAltHeldTactical] = useState<boolean>(false);
  const [hoveringSwap, setHoveringSwap] = useState<boolean>(false);

  const screenProfile = useMemo(
    () =>
      detectPhysicalScreenProfile(
        viewport.innerWidth,
        viewport.innerHeight,
        typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
        fullscreen.isTouchscreen,
      ),
    [viewport.innerWidth, viewport.innerHeight, fullscreen.isTouchscreen],
  );

  const [a11yPrefs, setA11yPrefs] = useState<AccessibilityPrefs>(() =>
    loadAccessibilityPrefs(
      detectPhysicalScreenProfile(
        typeof window !== 'undefined' ? window.innerWidth : 1280,
        typeof window !== 'undefined' ? window.innerHeight : 800,
        typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
        fullscreen.isTouchscreen,
      ),
    ),
  );

  const effectiveTacticalView = a11yPrefs.tacticalView || altHeldTactical;

  const [initialState] = useState<{
    saved: RunState | null;
    active: RunState;
    encounterSnapshot: RunState | null;
  }>(() => {
    const loaded = loadValidSavedRun();
    const active = loaded ?? createInitialRun(104729);
    const savedSnap = loaded && loaded.screen === 'combat' ? loadEncounterSnapshot() : null;
    const encounterSnapshot =
      active.screen === 'combat'
        ? savedSnap &&
          savedSnap.runId === active.runId &&
          savedSnap.combat?.nodeId === active.combat?.nodeId
          ? savedSnap
          : active
        : null;
    return {
      saved: loaded,
      active,
      encounterSnapshot,
    };
  });

  const [savedRunSnapshot, setSavedRunSnapshot] = useState<RunState | null>(initialState.saved);
  const [run, setRun] = useState<RunState>(initialState.active);
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterId>(
    () => initialState.saved?.heroine.characterId ?? 'kira',
  );
  const [readyOutcomeKey, setReadyOutcomeKey] = useState<string | null>(null);
  const [defibNoticeVisible, setDefibNoticeVisible] = useState<boolean>(false);

  // Low-Floor / High-Ceiling Tactical Sandbox & Onboarding State
  const [turnHistory, setTurnHistory] = useState<
    Array<{ run: RunState; swappedThisTurn: boolean }>
  >([]);
  const [encounterStartSnapshot, setEncounterStartSnapshot] = useState<RunState | null>(
    initialState.encounterSnapshot,
  );
  const [undosUsedInNode, setUndosUsedInNode] = useState<number>(0);
  const [swappedThisTurn, setSwappedThisTurn] = useState<boolean>(false);
  const [hasUsedSwapEver, setHasUsedSwapEver] = useState<boolean>(false);
  const [hintVisible, setHintVisible] = useState<boolean>(false);
  const [pipMathMode, setPipMathMode] = useState<boolean>(false);

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

  // Immediately begin combat asset warmup on direct ?autostart=1 boot
  useEffect(() => {
    if (showTitle) return;
    const current = runRef.current;
    if (current.screen === 'combat' && current.combat) {
      void ensureCombatAssetsReady(
        current.heroine.characterId ?? 'kira',
        current.combat.enemies.map((e) => e.archetype),
      );
    }
  }, [showTitle]);

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
    if (showTitle || paused || poolModalOpen || Boolean(codexTarget) || run.screen !== 'combat' || !combat) {
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
        const rawNextState = executeSingleEnemyAction(run, nextEnemyIdx);
        const nextState = applyBossObjectivesIfVictory(
          rawNextState,
          encounterStartSnapshot?.heroine.hp ?? run.heroine.maxHp,
          undosUsedInNode,
          lang,
        );
        const cues = nextState.combat?.lastCues ?? [];
        if (cues.some((c) => c.kind === 'enemy_acid')) soundEngine.playAcidSpit();
        else if (cues.some((c) => c.kind === 'enemy_attack')) soundEngine.playEnemyHit();
        else if (cues.some((c) => c.kind === 'enemy_bolster' || c.kind === 'enemy_armor')) {
          soundEngine.playEnemyArmor();
        } else if (cues.some((c) => c.kind === 'enemy_charge')) {
          soundEngine.playEnemyCharge();
        }
        if (cues.some((c) => c.kind === 'enemy_burst')) soundEngine.playBioBurst();
        if (cues.some((c) => c.kind === 'enemy_phase_gate')) soundEngine.playShieldPipCrack();
        setRun(nextState);
      } else {
        enemyActedSetRef.current.clear();
        const nextRoundState = advanceRoundAfterEnemies(run);
        const roundCues = nextRoundState.combat?.lastCues ?? [];
        if (roundCues.some((c) => c.kind === 'enemy_reinforce')) {
          soundEngine.playDropArrival();
        } else if (roundCues.some((c) => c.kind === 'enemy_enrage' || c.kind === 'heat_jam')) {
          soundEngine.playOverheatWarning();
        } else if (roundCues.some((c) => c.kind === 'enemy_telegraph')) {
          soundEngine.playTelegraphPing();
        }
        setRun(nextRoundState);
      }
    }, delayMs);

    return () => {
      window.clearTimeout(tid);
    };
  }, [combat, codexTarget, encounterStartSnapshot?.heroine.hp, lang, paused, poolModalOpen, run, showTitle, undosUsedInNode]);

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

  // Sync Physical DPI Scale & Tactical Accessibility DOM attributes
  useEffect(() => {
    document.body.dataset.tacticalView = effectiveTacticalView ? 'true' : 'false';
    document.body.dataset.semanticZoom = a11yPrefs.semanticZoom;
    document.body.dataset.physicalInches = String(screenProfile.diagonalInchesEst);
    document.documentElement.style.setProperty(
      '--ui-physical-scale',
      String(screenProfile.physicalScaleFactor),
    );
    soundEngine.setHapticsEnabled(a11yPrefs.hapticsEnabled);
  }, [
    effectiveTacticalView,
    a11yPrefs.semanticZoom,
    a11yPrefs.hapticsEnabled,
    screenProfile.diagonalInchesEst,
    screenProfile.physicalScaleFactor,
  ]);

  // Persist active run only when run actually changes outside title screen
  useEffect(() => {
    if (showTitle) return;

    if (run.screen === 'victory' || run.screen === 'gameover') {
      if (recordedRunIdRef.current !== run.runId) {
        recordedRunIdRef.current = run.runId;
        const nanitesEarned = run.heroine.nanites ?? 0;
        const nanitesBanked =
          run.screen === 'victory' ? nanitesEarned : Math.floor(nanitesEarned * 0.65);
        const nextRecord = recordRunCompletion(
          run.score,
          run.screen === 'victory',
          nanitesBanked,
        );
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

  const handleStartNewRun = useCallback(
    (charOverride?: CharacterId) => {
      const charId = charOverride ?? selectedCharacter;
      enemyActedSetRef.current.clear();
      blurActiveElement();
      soundEngine.playClick();
      clearActiveRun();
      const fresh = createInitialRun(Math.floor(Date.now() % 900000) + 10000, charId);
      if (fresh.screen === 'combat' && fresh.combat) {
        void ensureCombatAssetsReady(
          charId,
          fresh.combat.enemies.map((e) => e.archetype),
        );
      }
      recordedRunIdRef.current = null;
      setHoveredColor(null);
      setSelectedColor(null);
      setPaused(false);
      setPoolModalOpen(false);
      setDefibNoticeVisible(false);
      setTurnHistory([]);
      const nextSnapshot = fresh.screen === 'combat' ? fresh : null;
      setEncounterStartSnapshot(nextSnapshot);
      saveEncounterSnapshot(nextSnapshot);
      setUndosUsedInNode(0);
      setSwappedThisTurn(false);
      setHintVisible(false);
      setReadyOutcomeKey(null);
      setRun(fresh);
      setSavedRunSnapshot(fresh);
      setShowTitle(false);
      document.body.dataset.state = 'playing';
    },
    [selectedCharacter],
  );

  const handleContinueRun = useCallback(() => {
    blurActiveElement();
    soundEngine.playClick();
    if (savedRunSnapshot) {
      if (savedRunSnapshot.screen === 'combat' && savedRunSnapshot.combat) {
        void ensureCombatAssetsReady(
          savedRunSnapshot.heroine.characterId ?? 'kira',
          savedRunSnapshot.combat.enemies.map((e) => e.archetype),
        );
      }
      setRun(savedRunSnapshot);
      const savedSnap =
        savedRunSnapshot.screen === 'combat' ? loadEncounterSnapshot() : null;
      const nextSnapshot =
        savedRunSnapshot.screen === 'combat'
          ? savedSnap &&
            savedSnap.runId === savedRunSnapshot.runId &&
            savedSnap.combat?.nodeId === savedRunSnapshot.combat?.nodeId
            ? savedSnap
            : savedRunSnapshot
          : null;
      setEncounterStartSnapshot(nextSnapshot);
      setTurnHistory([]);
      setUndosUsedInNode(0);
      setSwappedThisTurn(false);
      setHintVisible(false);
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

  const handleToggleTacticalView = useCallback(() => {
    soundEngine.playClick();
    setA11yPrefs((prev) => {
      const next = { ...prev, tacticalView: !prev.tacticalView };
      saveAccessibilityPrefs(next);
      return next;
    });
  }, []);

  const handleCycleSemanticZoom = useCallback(() => {
    soundEngine.playClick();
    setA11yPrefs((prev) => {
      const next = { ...prev, semanticZoom: cycleSemanticZoomLevel(prev.semanticZoom) };
      saveAccessibilityPrefs(next);
      return next;
    });
  }, []);

  const handleToggleAutoFocusCamera = useCallback(() => {
    soundEngine.playClick();
    setA11yPrefs((prev) => {
      const next = { ...prev, autoFocusCamera: !prev.autoFocusCamera };
      saveAccessibilityPrefs(next);
      return next;
    });
  }, []);

  const handleToggleTwoStepConfirm = useCallback(() => {
    soundEngine.playClick();
    setA11yPrefs((prev) => {
      const next = { ...prev, twoStepConfirm: !prev.twoStepConfirm };
      saveAccessibilityPrefs(next);
      return next;
    });
  }, []);

  const handleToggleLang = useCallback(() => {
    soundEngine.playClick();
    setLang((prev) => (prev === 'en' ? 'cs' : 'en'));
  }, []);

  const handleHoverColor = useCallback((color: TileType | null) => {
    setHoveredColor((prev) => {
      if (color && color !== prev) {
        const currentRun = runRef.current;
        const boardTiles = currentRun.combat?.board ?? [];
        const activeCount = boardTiles.filter((t) => !t.isJammed && t.type === color).length;
        const surgeReq = getSurgeThreshold(currentRun.heroine.implants);
        soundEngine.playHover(activeCount >= surgeReq);
      }
      return color;
    });
  }, []);

  const handleSelectColor = useCallback((color: TileType | null) => {
    setSelectedColor((prev) => {
      if (color && color !== prev) {
        const currentRun = runRef.current;
        const boardTiles = currentRun.combat?.board ?? [];
        const activeCount = boardTiles.filter((t) => !t.isJammed && t.type === color).length;
        const surgeReq = getSurgeThreshold(currentRun.heroine.implants);
        soundEngine.playHover(activeCount >= surgeReq);
      }
      return color;
    });
  }, []);

  const handleCommitColor = useCallback(
    (color: TileType) => {
      const currentRun = runRef.current;
      if (showTitle || paused || poolModalOpen || Boolean(codexTarget)) return;
      if (currentRun.screen !== 'combat' || !currentRun.combat || currentRun.combat.phase !== 'PLAYER_IDLE') {
        return;
      }
      const preview = previewColorResolution(currentRun, color);
      if (preview.tileCount === 0) return;

      if (color === 'attack') soundEngine.playSlash(preview.surgeTriggered);
      else if (color === 'defense') soundEngine.playShield(preview.surgeTriggered);
      else soundEngine.playUpgrade(preview.surgeTriggered);

      setTurnHistory((prev) => [...prev.slice(-12), { run: currentRun, swappedThisTurn }]);
      setSwappedThisTurn(false);
      setHintVisible(false);
      enemyActedSetRef.current.clear();
      const rawNextState = resolvePlayerColor(currentRun, color);
      const nextState = applyBossObjectivesIfVictory(
        rawNextState,
        encounterStartSnapshot?.heroine.hp ?? currentRun.heroine.maxHp,
        undosUsedInNode,
        lang,
      );
      const cues = nextState.combat?.lastCues ?? [];
      if (cues.some((c) => c.kind === 'enemy_burst')) soundEngine.playBioBurst();
      if (cues.some((c) => c.kind === 'enemy_retaliate')) soundEngine.playRetaliateSpike();
      if (cues.some((c) => c.kind === 'enemy_phase_gate')) soundEngine.playShieldPipCrack();
      setRun(nextState);
      setHoveredColor(null);
      setSelectedColor(null);
    },
    [
      codexTarget,
      encounterStartSnapshot?.heroine.hp,
      lang,
      paused,
      poolModalOpen,
      showTitle,
      swappedThisTurn,
      undosUsedInNode,
    ],
  );

  const handleOverdrive = useCallback(() => {
    const currentRun = runRef.current;
    if (showTitle || paused || poolModalOpen || Boolean(codexTarget)) return;
    if (currentRun.screen !== 'combat' || !currentRun.combat || currentRun.combat.phase !== 'PLAYER_IDLE') {
      return;
    }
    if (currentRun.heroine.overdrive < 100) return;
    soundEngine.playOverdrive();
    setTurnHistory((prev) => [...prev.slice(-12), { run: currentRun, swappedThisTurn }]);
    setHintVisible(false);
    setHoveredColor(null);
    setSelectedColor(null);
    const rawNextState = executeOverdrive(currentRun);
    const nextState = applyBossObjectivesIfVictory(
      rawNextState,
      encounterStartSnapshot?.heroine.hp ?? currentRun.heroine.maxHp,
      undosUsedInNode,
      lang,
    );
    const cues = nextState.combat?.lastCues ?? [];
    if (cues.some((c) => c.kind === 'enemy_burst')) soundEngine.playBioBurst();
    if (cues.some((c) => c.kind === 'enemy_phase_gate')) soundEngine.playShieldPipCrack();
    setRun(nextState);
  }, [
    codexTarget,
    encounterStartSnapshot?.heroine.hp,
    lang,
    paused,
    poolModalOpen,
    showTitle,
    swappedThisTurn,
    undosUsedInNode,
  ]);

  const handleSwapEnemies = useCallback(() => {
    const currentRun = runRef.current;
    if (showTitle || paused || poolModalOpen || Boolean(codexTarget)) return;
    if (currentRun.screen !== 'combat' || !currentRun.combat || currentRun.combat.phase !== 'PLAYER_IDLE') {
      return;
    }
    if (!canRepositionEnemies(currentRun.combat, swappedThisTurn)) {
      soundEngine.playInvalidBuzz();
      return;
    }
    const swapped = repositionFrontEnemies(currentRun.combat);
    if (!swapped.swapped) return;
    soundEngine.playEnemyArmor();
    setTurnHistory((prev) => [...prev.slice(-12), { run: currentRun, swappedThisTurn }]);
    setSwappedThisTurn(true);
    setHasUsedSwapEver(true);
    setRun({
      ...currentRun,
      combat: {
        ...currentRun.combat,
        enemies: swapped.enemies,
      },
    });
  }, [codexTarget, paused, poolModalOpen, showTitle, swappedThisTurn]);

  const handleUndoTurn = useCallback(() => {
    if (showTitle || paused || poolModalOpen || Boolean(codexTarget)) return;
    if (turnHistory.length === 0) {
      soundEngine.playInvalidBuzz();
      return;
    }
    soundEngine.playClick();
    enemyActedSetRef.current.clear();
    const prevEntry = turnHistory[turnHistory.length - 1];
    setTurnHistory((prev) => prev.slice(0, -1));
    setUndosUsedInNode((u) => u + 1);
    setSwappedThisTurn(prevEntry.swappedThisTurn);
    setHintVisible(false);
    setHoveredColor(null);
    setSelectedColor(null);
    setReadyOutcomeKey(null);
    setRun(prevEntry.run);
  }, [codexTarget, paused, poolModalOpen, showTitle, turnHistory]);

  const handleResetEncounter = useCallback(() => {
    if (!encounterStartSnapshot) {
      soundEngine.playInvalidBuzz();
      return;
    }
    soundEngine.playClick();
    enemyActedSetRef.current.clear();
    setTurnHistory([]);
    setUndosUsedInNode((u) => u + 1);
    setSwappedThisTurn(false);
    setHintVisible(false);
    setHoveredColor(null);
    setSelectedColor(null);
    setReadyOutcomeKey(null);
    setRun(encounterStartSnapshot);
  }, [encounterStartSnapshot]);

  const handleFailForwardRetry = useCallback(() => {
    if (!encounterStartSnapshot) return;
    soundEngine.playUpgrade(true);
    enemyActedSetRef.current.clear();
    const buffed = applyFailForwardBuff(encounterStartSnapshot);
    setTurnHistory([]);
    setUndosUsedInNode((u) => u + 1);
    setSwappedThisTurn(false);
    setHintVisible(false);
    setHoveredColor(null);
    setSelectedColor(null);
    setReadyOutcomeKey(null);
    setRun(buffed);
  }, [encounterStartSnapshot]);

  const handleToggleHint = useCallback(() => {
    soundEngine.playClick();
    setHintVisible((prev) => !prev);
  }, []);

  const handleTogglePipMath = useCallback(() => {
    soundEngine.playClick();
    setPipMathMode((prev) => !prev);
  }, []);

  const objectivesSummary = useMemo(() => {
    if (!combat) return null;
    const startingHp = encounterStartSnapshot?.heroine.hp ?? run.heroine.maxHp;
    return computeEncounterObjectives({
      combat,
      heroine: run.heroine,
      startingHp,
      undosUsed: undosUsedInNode,
      lang,
    });
  }, [combat, encounterStartSnapshot?.heroine.hp, lang, run.heroine, undosUsedInNode]);

  const activeHint = useMemo(() => {
    if (!hintVisible || run.screen !== 'combat' || combat?.phase !== 'PLAYER_IDLE') {
      return null;
    }
    return computeOptimalTurnHint(run, lang, swappedThisTurn);
  }, [combat?.phase, hintVisible, lang, run, swappedThisTurn]);

  const handleClaimCombatReward = useCallback(
    (defId: string | null) => {
      soundEngine.playClick();
      const prev = runRef.current;
      const next = claimCombatEquipmentReward(prev, defId);
      if (!prev.heroine.emergencyDefibUsed && next.heroine.emergencyDefibUsed) {
        setDefibNoticeVisible(true);
      }
      const finalized = objectivesSummary
        ? {
            ...next,
            score: next.score + objectivesSummary.bonusScore,
            heroine: {
              ...next.heroine,
              credits: next.heroine.credits + objectivesSummary.bonusCredits,
              nanites: (next.heroine.nanites ?? 0) + objectivesSummary.bonusNanites,
            },
          }
        : next;
      setEncounterStartSnapshot(null);
      saveEncounterSnapshot(null);
      setRun(finalized);
    },
    [objectivesSummary],
  );

  const handleSelectMapNode = useCallback((nodeId: string) => {
    soundEngine.playClick();
    setHoveredColor(null);
    setSelectedColor(null);
    setDefibNoticeVisible(false);
    setTurnHistory([]);
    setUndosUsedInNode(0);
    setSwappedThisTurn(false);
    setHintVisible(false);
    setReadyOutcomeKey(null);
    const current = runRef.current;
    const targetNode = current.mapNodes.find((n) => n.id === nodeId);
    if (targetNode && targetNode.type !== 'CYBER_CLINIC' && targetNode.type !== 'MED_BAY') {
      const intel = getNodeEncounterIntel(targetNode, current.seed);
      void ensureCombatAssetsReady(
        current.heroine.characterId ?? 'kira',
        intel.enemies.map((e) => e.archetype),
      );
    }
    const nextRun = startNodeEncounter(current, nodeId);
    const nextSnapshot = nextRun.screen === 'combat' ? nextRun : null;
    setEncounterStartSnapshot(nextSnapshot);
    saveEncounterSnapshot(nextSnapshot);
    setRun(nextRun);
  }, []);

  const handleBuyEquipment = useCallback((defId: string) => {
    soundEngine.playUpgrade(false);
    setRun((prev) => buyClinicEquipment(prev, defId));
  }, []);

  const handleRestockShop = useCallback(() => {
    soundEngine.playClick();
    setRun((prev) => restockClinicShop(prev));
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
    (action: 'heal' | 'calibrate_max_hp' | 'salvage_credits' | 'tile_overclock' | 'extract_bank') => {
      soundEngine.playUpgrade(false);
      setRun((prev) => applyMedBayAction(prev, action));
    },
    [],
  );

  const handleResolveEventChoice = useCallback((choiceIndex: number) => {
    soundEngine.playUpgrade(true);
    setRun((prev) => resolveCyberEventChoice(prev, choiceIndex));
  }, []);

  const handleEquipInstance = useCallback((instanceId: string) => {
    soundEngine.playClick();
    setRun((prev) => equipEquipmentInstance(prev, instanceId));
  }, []);

  const handleUnequipInstance = useCallback((instanceId: string) => {
    soundEngine.playClick();
    setRun((prev) => unequipEquipmentInstance(prev, instanceId));
  }, []);

  const handleScrapInstance = useCallback((instanceId: string) => {
    soundEngine.playUpgrade(false);
    setRun((prev) => scrapEquipmentInstance(prev, instanceId));
  }, []);

  const handleOpenPool = useCallback(() => {
    soundEngine.playClick();
    setPoolModalOpen(true);
  }, []);

  const handleClosePool = useCallback(() => {
    setPoolModalOpen(false);
  }, []);

  const handleOpenCodex = useCallback(
    (tab: CodexTab = 'heroes', hero?: CharacterId, termId: GlossaryTermId | null = null) => {
      soundEngine.playClick();
      setPoolModalOpen(false);
      setPaused(false);
      setCodexTarget({
        tab,
        hero: hero ?? runRef.current.heroine.characterId ?? selectedCharacter,
        termId,
      });
    },
    [selectedCharacter],
  );

  const handleCloseCodex = useCallback(() => {
    setCodexTarget(null);
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

    const isTextEditableFocused = (target: EventTarget | null): boolean =>
      target instanceof HTMLElement && Boolean(target.closest('input, select, textarea, [contenteditable="true"]'));

    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === 'f' &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !isTextEditableFocused(e.target)
      ) {
        e.preventDefault();
        soundEngine.playClick();
        void fullscreen.toggleFullscreen();
        return;
      }

      if (
        e.key.toLowerCase() === 'g' &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !isTextEditableFocused(e.target)
      ) {
        e.preventDefault();
        soundEngine.playClick();
        if (codexTarget) {
          setCodexTarget(null);
        } else {
          handleOpenCodex(
            'heroes',
            showTitle ? selectedCharacter : runRef.current.heroine.characterId ?? 'kira',
            null,
          );
        }
        return;
      }

      if (showTitle) {
        if (e.key === 'Escape' && codexTarget) {
          e.preventDefault();
          setCodexTarget(null);
          return;
        }
        if (codexTarget) {
          if (e.key.toLowerCase() === 'l') {
            handleToggleLang();
          }
          return;
        }
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
        if (codexTarget) {
          setCodexTarget(null);
        } else if (poolModalOpen) {
          setPoolModalOpen(false);
        } else if (run.screen !== 'victory' && run.screen !== 'gameover') {
          setPaused((prev) => !prev);
        }
        return;
      }

      if (e.key === 'Alt' && !isTextEditableFocused(e.target)) {
        e.preventDefault();
        setAltHeldTactical(true);
        return;
      }

      if (e.key === 'Tab' && !isTextEditableFocused(e.target) && !paused && !poolModalOpen && !codexTarget) {
        e.preventDefault();
        handleToggleTacticalView();
        return;
      }

      if (e.key.toLowerCase() === 'z' && !e.ctrlKey && !e.metaKey && !isTextEditableFocused(e.target)) {
        e.preventDefault();
        handleCycleSemanticZoom();
        return;
      }

      if (
        e.key.toLowerCase() === 'c' &&
        run.screen === 'combat' &&
        !e.ctrlKey &&
        !e.metaKey &&
        !isTextEditableFocused(e.target)
      ) {
        e.preventDefault();
        handleToggleAutoFocusCamera();
        return;
      }

      if (e.key.toLowerCase() === 'm' && !isTextEditableFocused(e.target)) {
        handleToggleMute();
        return;
      }
      if (e.key.toLowerCase() === 'l' && !isTextEditableFocused(e.target)) {
        handleToggleLang();
        return;
      }
      if (e.key.toLowerCase() === 'h' && run.screen === 'combat' && !isTextEditableFocused(e.target)) {
        handleToggleHudMinimized();
        return;
      }

      if (paused || poolModalOpen || Boolean(codexTarget)) return;

      if (run.screen === 'combat' && !isTextEditableFocused(e.target)) {
        if (e.key === '1') {
          handleCommitColor('attack');
        } else if (e.key === '2') {
          handleCommitColor('defense');
        } else if (e.key === '3') {
          handleCommitColor('tech');
        } else if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          handleSwapEnemies();
        } else if (e.key.toLowerCase() === 'u' && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          handleUndoTurn();
        } else if (e.key === '?' || e.key === '/') {
          e.preventDefault();
          handleToggleHint();
        } else if (e.key === ' ' && !isInteractiveFocused(e.target)) {
          e.preventDefault();
          handleOverdrive();
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setAltHeldTactical(false);
      }
    };

    const onWindowBlur = () => {
      setAltHeldTactical(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, [
    codexTarget,
    fullscreen,
    handleCommitColor,
    handleContinueRun,
    handleCycleSemanticZoom,
    handleOpenCodex,
    handleOverdrive,
    handleStartNewRun,
    handleSwapEnemies,
    handleToggleAutoFocusCamera,
    handleToggleHint,
    handleToggleHudMinimized,
    handleToggleLang,
    handleToggleMute,
    handleToggleTacticalView,
    handleUndoTurn,
    paused,
    poolModalOpen,
    run.screen,
    savedRunSnapshot,
    selectedCharacter,
    showTitle,
  ]);

  const board = combat?.board;
  const countByColor = useMemo(() => {
    const counts: Record<TileType, number> = { attack: 0, defense: 0, tech: 0 };
    if (!board) return counts;
    for (const tile of board) {
      if (tile.isJammed) continue;
      counts[tile.type] += 1;
    }
    return counts;
  }, [board]);

  const onboardingPrompt = useMemo(() => {
    if (run.screen !== 'combat' || combat?.phase !== 'PLAYER_IDLE') return null;
    return computeContextualMicroPrompt({
      run,
      countByColor,
      alreadySwappedThisTurn: swappedThisTurn || hasUsedSwapEver,
      lang,
    });
  }, [combat?.phase, countByColor, hasUsedSwapEver, lang, run, swappedThisTurn]);

  const canPlay = Boolean(
    !showTitle &&
      !paused &&
      !poolModalOpen &&
      !codexTarget &&
      run.screen === 'combat' &&
      combat &&
      combat.phase === 'PLAYER_IDLE',
  );

  const shellStyle = viewport.isLandscapeRotated
    ? {
        width: `${viewport.innerHeight}px`,
        height: `${viewport.innerWidth}px`,
        transform: `translate(${viewport.innerWidth}px, 0px) rotate(90deg)`,
        transformOrigin: 'top left',
      }
    : undefined;

  const shellClassName = viewport.isLandscapeRotated
    ? 'cyber-vista-bg fixed top-0 left-0 flex flex-col overflow-hidden text-slate-100'
    : 'cyber-vista-bg flex h-dvh w-full flex-col overflow-hidden text-slate-100';

  const showFullscreenButton = fullscreen.isTouchscreen && fullscreen.isFullscreenSupported;
  const handleToggleFullscreen = useCallback(() => {
    soundEngine.playClick();
    void fullscreen.toggleFullscreen();
  }, [fullscreen]);

  if (showTitle) {
    return (
      <div className={shellClassName} style={shellStyle}>
        <TitleScreen
          lang={lang}
          onToggleLang={handleToggleLang}
          hasSavedRun={Boolean(savedRunSnapshot)}
          bestScore={bestRecord.bestScore}
          sectorsCleared={bestRecord.sectorsCleared}
          selectedCharacter={selectedCharacter}
          onSelectCharacter={setSelectedCharacter}
          onStartNewRun={() => handleStartNewRun(selectedCharacter)}
          onContinueRun={handleContinueRun}
          isCompactLandscape={viewport.isCompactLandscape}
          isNarrowPortrait={viewport.isNarrowPortrait}
          showLandscapeToggle={viewport.canOfferLandscapeToggle}
          isLandscapeRotated={viewport.isLandscapeRotated}
          onToggleLandscape={viewport.toggleLandscapeLock}
          showFullscreenButton={showFullscreenButton}
          isFullscreen={fullscreen.isFullscreen}
          onToggleFullscreen={handleToggleFullscreen}
          onOpenCodex={(tab, hero) => handleOpenCodex(tab, hero, null)}
        />
        {codexTarget && (
          <CodexModal
            lang={lang}
            initialTab={codexTarget.tab}
            initialHero={codexTarget.hero}
            initialTermId={codexTarget.termId}
            onClose={handleCloseCodex}
          />
        )}
      </div>
    );
  }

  return (
    <div className={shellClassName} style={shellStyle}>
      <TopHud
        run={run}
        lang={lang}
        objectivesSummary={objectivesSummary}
        canUndoTurn={turnHistory.length > 0}
        canResetEncounter={Boolean(
          encounterStartSnapshot && ((combat?.turn ?? 1) > 1 || turnHistory.length > 0),
        )}
        onUndoTurn={handleUndoTurn}
        onResetEncounter={handleResetEncounter}
        isCompactLandscape={viewport.isCompactLandscape}
        onOpenPool={handleOpenPool}
        onOpenCodex={() =>
          handleOpenCodex('heroes', run.heroine.characterId ?? 'kira', null)
        }
        onOpenPause={handleOpenPause}
      />

      {run.screen === 'map' && (
        <SectorMapView
          run={run}
          lang={lang}
          modalOpen={paused || poolModalOpen || Boolean(codexTarget)}
          tacticalView={effectiveTacticalView}
          semanticZoom={a11yPrefs.semanticZoom}
          twoStepConfirm={a11yPrefs.twoStepConfirm}
          highContrastBorders={a11yPrefs.highContrastBorders}
          isCompactLandscape={viewport.isCompactLandscape}
          isNarrowPortrait={viewport.isNarrowPortrait}
          effectiveWidth={viewport.effectiveWidth}
          onSelectNode={handleSelectMapNode}
          onOpenLoadout={handleOpenPool}
        />
      )}

      {run.screen === 'clinic' && (
        <CyberClinicView
          run={run}
          lang={lang}
          isCompactLandscape={viewport.isCompactLandscape}
          defibTriggeredNotice={defibNoticeVisible}
          onBuyEquipment={handleBuyEquipment}
          onRestockShop={handleRestockShop}
          onInstall={handleInstallImplant}
          onOpenPool={handleOpenPool}
          onSkip={handleSkipClinic}
        />
      )}

      {run.screen === 'medbay' && (
        <BioMedBayView
          run={run}
          lang={lang}
          isCompactLandscape={viewport.isCompactLandscape}
          onAction={handleMedBayAction}
        />
      )}

      {run.screen === 'event' && (
        <CyberEventView
          run={run}
          lang={lang}
          isCompactLandscape={viewport.isCompactLandscape}
          onChoice={handleResolveEventChoice}
        />
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
                paused={paused || poolModalOpen || Boolean(codexTarget) || postCombatOverlayReady}
                isCompactLandscape={viewport.isCompactLandscape}
                tacticalView={effectiveTacticalView}
                autoFocusCamera={a11yPrefs.autoFocusCamera}
                highContrastBorders={a11yPrefs.highContrastBorders}
                pipMathMode={pipMathMode}
                hoveringSwap={hoveringSwap}
                onUndoTurn={handleUndoTurn}
                onOpenCodex={handleOpenCodex}
              />

              {/* Non-boss Combat Clear + Equipment Loot Overlay (shown after full hit & KO animation) */}
              {run.screen === 'combat' && combat.phase === 'VICTORY' && postCombatOverlayReady && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/65 p-2.5 sm:p-4 backdrop-blur-sm animate-fadeIn">
                  <div className="chrome-panel-bright w-full max-w-2xl max-h-[94%] overflow-y-auto rounded-2xl p-3.5 sm:p-6">
                    <div className="text-center">
                      <h2 className="chrome-text-shimmer font-display text-lg sm:text-2xl font-bold">
                        {t.combatVictory}
                      </h2>
                      <div className="mt-1 sm:mt-2 flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-[11px] sm:text-xs font-mono-tabular text-slate-200">
                        <span>
                          {t.turnsLabel}: {combat.turn}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {t.damageDealtLabel}: {combat.totalDamageDealt}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-bold text-[#FFC700]">
                          +{combat.rewardCredits + (objectivesSummary?.bonusCredits ?? 0)}{' '}
                          {t.creditsLabel}
                        </span>
                      </div>
                      {combat.rewardBreakdown && (
                        <div
                          data-testid="combat-reward-breakdown"
                          className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5 font-mono-tabular text-[10px] sm:text-[11px]"
                        >
                          <span className="rounded border border-white/15 bg-slate-900/75 px-2 py-0.5 text-slate-200">
                            {t.baseLootLabel}: +{combat.rewardBreakdown.baseCredits}
                          </span>
                          {combat.rewardBreakdown.parCacheCredits > 0 && (
                            <span className="rounded border border-[#FFC700]/45 bg-amber-950/60 px-2 py-0.5 font-bold text-[#FFE066]">
                              {t.parBonusLabel} ({combat.rewardBreakdown.intactParCount}/3): +
                              {combat.rewardBreakdown.parCacheCredits}
                            </span>
                          )}
                          {combat.rewardBreakdown.tempoCredits > 0 && (
                            <span className="rounded border border-emerald-300/45 bg-emerald-950/60 px-2 py-0.5 font-bold text-emerald-200">
                              {t.tempoBonusLabel}: +{combat.rewardBreakdown.tempoCredits}
                            </span>
                          )}
                          {combat.rewardBreakdown.fastClearCredits > 0 && (
                            <span className="rounded border border-[#00F0FF]/50 bg-cyan-950/65 px-2 py-0.5 font-bold text-cyan-200">
                              {t.fastClearBonusLabel}: +{combat.rewardBreakdown.fastClearCredits}
                            </span>
                          )}
                        </div>
                      )}
                      {objectivesSummary && (
                        <div
                          data-testid="victory-tiered-objectives"
                          className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-3 text-left font-mono-tabular text-[10px]"
                        >
                          {objectivesSummary.tiers.map((tier) => (
                            <div
                              key={`victory_tier_${tier.tier}`}
                              data-achieved={tier.completed ? 'true' : 'false'}
                              className={`rounded-lg border p-2 ${
                                tier.completed
                                  ? 'border-emerald-300/60 bg-emerald-950/50 text-emerald-100'
                                  : 'border-white/10 bg-slate-900/60 text-slate-400 opacity-75'
                              }`}
                            >
                              <div className="flex items-center justify-between font-bold">
                                <span className={tier.completed ? 'text-[#FFC700]' : 'text-slate-400'}>
                                  {tier.tierLabel}
                                </span>
                                <span>{tier.completed ? '✓' : '—'}</span>
                              </div>
                              <div className="mt-0.5 text-[9px] text-slate-300">
                                {tier.title}
                              </div>
                              <div className="mt-0.5 text-[9px] font-bold text-cyan-200">
                                {tier.rewardText}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {combat.nodeType === 'ELITE' &&
                        !run.heroine.emergencyDefibUsed &&
                        run.heroine.hp <= Math.round(run.heroine.maxHp * 0.15) && (
                          <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/55 bg-emerald-950/60 px-3 py-1 font-mono-tabular text-[11px] font-bold text-emerald-200">
                            ⚡ {t.emergencyDefibTriggered}
                          </div>
                        )}
                    </div>

                    {combat.rewardEquipmentChoices.length > 0 && (() => {
                      const usedWeight = getEquippedEquipmentWeight(run.heroine);
                      return (
                        <div className="mt-2.5 sm:mt-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#00F0FF]">
                              {t.combatLootPrompt}
                            </span>
                            <div className="flex items-center gap-2 font-mono-tabular text-[11px]">
                              <span
                                className={
                                  usedWeight >= run.heroine.carryCapacity
                                    ? 'font-bold text-amber-300'
                                    : 'font-semibold text-cyan-200'
                                }
                              >
                                {t.capacityLabel}: {usedWeight}/{run.heroine.carryCapacity}
                              </span>
                              <button
                                type="button"
                                onClick={handleOpenPool}
                                className="chrome-pill rounded-md px-2 py-0.5 text-[10px] font-bold text-cyan-200 hover:border-cyan-300 hover:text-white cursor-pointer"
                              >
                                ▣ {t.inspectPool}
                              </button>
                            </div>
                          </div>
                          <div className="mt-2 grid grid-cols-1 gap-2 min-[500px]:grid-cols-2 sm:gap-3">
                            {combat.rewardEquipmentChoices.map((defId) => {
                              const def = EQUIPMENT_BY_ID[defId];
                              if (!def) return null;
                              const meta = t.equipment[def.id];
                              const fitsEquip = usedWeight + def.size <= run.heroine.carryCapacity;
                              return (
                                <button
                                  key={defId}
                                  type="button"
                                  onClick={() => handleClaimCombatReward(defId)}
                                  className="chrome-pill flex flex-col justify-between rounded-xl border-cyan-300/45 p-2.5 sm:p-4 text-left transition-all hover:-translate-y-0.5 hover:border-[#00F0FF] cursor-pointer"
                                >
                                  <div>
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="font-display text-sm sm:text-base font-bold text-white">
                                        {meta?.name ?? def.id}
                                      </span>
                                      <span
                                        className={`font-mono-tabular text-[11px] sm:text-xs font-bold ${
                                          fitsEquip ? 'text-[#00F0FF]' : 'text-amber-300'
                                        }`}
                                      >
                                        {t.sizeLabel}: {def.size}
                                      </span>
                                    </div>
                                    <p className="mt-0.5 sm:mt-1 text-[11px] sm:text-xs text-slate-200">
                                      {meta?.desc ?? ''}
                                    </p>
                                    <div className="mt-1.5 sm:mt-2 flex flex-wrap items-center gap-1.5 font-mono-tabular text-[10px] sm:text-[11px]">
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
                                  <div className="mt-2 sm:mt-3 flex items-center justify-between gap-2 text-[11px] sm:text-xs font-bold">
                                    <span className={fitsEquip ? 'text-[#00F0FF]' : 'text-amber-300'}>
                                      {fitsEquip
                                        ? `✓ ${lang === 'cs' ? 'Vybavit hned' : 'Auto-Equip'}`
                                        : `⬡ ${lang === 'cs' ? 'Do batohu (plno)' : 'Store to Bag (Full)'}`}
                                    </span>
                                    <span className="text-slate-300">→</span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    <div className="mt-3 sm:mt-5 flex justify-center">
                      <button
                        type="button"
                        onClick={() => handleClaimCombatReward(null)}
                        className="chrome-pill rounded-lg px-4 py-1.5 sm:px-5 sm:py-2.5 text-xs font-bold text-white transition-colors hover:border-[#FFC700] cursor-pointer"
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
              tacticalView={effectiveTacticalView}
              semanticZoom={a11yPrefs.semanticZoom}
              twoStepConfirm={a11yPrefs.twoStepConfirm}
              highContrastBorders={a11yPrefs.highContrastBorders}
              pipMathMode={pipMathMode}
              canSwapEnemies={canRepositionEnemies(combat, swappedThisTurn)}
              activeHint={activeHint}
              onboardingPrompt={onboardingPrompt}
              isCompactLandscape={viewport.isCompactLandscape}
              isNarrowPortrait={viewport.isNarrowPortrait}
              effectiveWidth={viewport.effectiveWidth}
              activeColor={activeColor}
              selectedColor={selectedColor}
              activePreview={activePreview}
              countByColor={countByColor}
              onHoverColor={handleHoverColor}
              onSelectColor={handleSelectColor}
              onCommitColor={handleCommitColor}
              onOverdrive={handleOverdrive}
              onSwapEnemies={handleSwapEnemies}
              onHoverSwap={setHoveringSwap}
              onToggleHint={handleToggleHint}
              onOpenCodex={handleOpenCodex}
            />
          </>
        )}

      {poolModalOpen && (
        <PoolModal
          run={run}
          lang={lang}
          onEquip={handleEquipInstance}
          onUnequip={handleUnequipInstance}
          onScrap={handleScrapInstance}
          onOpenCodex={(tab, hero) => handleOpenCodex(tab, hero, null)}
          onClose={handleClosePool}
        />
      )}

      {paused && (
        <PauseModal
          lang={lang}
          onResume={handleResumePause}
          onOpenCodex={() =>
            handleOpenCodex('heroes', run.heroine.characterId ?? 'kira', null)
          }
          onRestart={() => handleStartNewRun(run.heroine.characterId ?? 'kira')}
          onTitle={handleReturnToTitle}
          settings={{
            tacticalView: effectiveTacticalView,
            semanticZoom: a11yPrefs.semanticZoom,
            autoFocusCamera: a11yPrefs.autoFocusCamera,
            pipMathMode,
            hudMinimized,
            twoStepConfirm: a11yPrefs.twoStepConfirm,
            muted,
            showLandscapeToggle: viewport.canOfferLandscapeToggle,
            isLandscapeRotated: viewport.isLandscapeRotated,
            showFullscreenButton,
            isFullscreen: fullscreen.isFullscreen,
            onToggleTacticalView: handleToggleTacticalView,
            onCycleSemanticZoom: handleCycleSemanticZoom,
            onToggleAutoFocusCamera: handleToggleAutoFocusCamera,
            onTogglePipMath: handleTogglePipMath,
            onToggleHudMinimized: handleToggleHudMinimized,
            onToggleTwoStepConfirm: handleToggleTwoStepConfirm,
            onToggleMute: handleToggleMute,
            onToggleLang: handleToggleLang,
            onToggleLandscape: viewport.toggleLandscapeLock,
            onToggleFullscreen: handleToggleFullscreen,
          }}
        />
      )}

      {codexTarget && (
        <CodexModal
          lang={lang}
          initialTab={codexTarget.tab}
          initialHero={codexTarget.hero}
          initialTermId={codexTarget.termId}
          onClose={handleCloseCodex}
        />
      )}

      {(run.screen === 'victory' || run.screen === 'gameover') && postCombatOverlayReady && (
        <EndRunModal
          outcome={run.screen}
          characterId={run.heroine.characterId ?? 'kira'}
          lang={lang}
          score={run.score}
          bestScore={bestRecord.bestScore}
          turns={run.turnsCompleted}
          enemiesDefeated={run.enemiesDefeated}
          canRetryEncounter={Boolean(encounterStartSnapshot)}
          onRetryClean={handleResetEncounter}
          onFailForwardRetry={handleFailForwardRetry}
          onPlayAgain={() => handleStartNewRun(run.heroine.characterId ?? 'kira')}
          onTitle={handleReturnToTitle}
        />
      )}
    </div>
  );
}
