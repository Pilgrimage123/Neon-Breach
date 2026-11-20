import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ensureCombatAssetsReady } from '../assets/assetPreloader';
import { soundEngine } from '../audio/soundEngine';
import { DEFAULT_DIFFICULTY_TIER, getDifficultyProfile } from '../engine/difficulty';
import {
  advanceRoundAfterEnemies,
  createInitialRun,
  executeSingleEnemyAction,
} from '../engine/gameEngine';
import {
  clearActiveRun,
  loadActiveRun,
  loadBestRecord,
  loadEncounterSnapshot,
  recordRunCompletion,
  saveActiveRun,
  saveEncounterSnapshot,
} from '../engine/persistence';
import type {
  BestRunRecord,
  CharacterId,
  DifficultyTier,
  RunState,
} from '../engine/types';
import type { Language } from '../i18n/translations';
import { applyBossObjectivesIfVictory, useCombatSandbox } from './useCombatSandbox';
import { useNodeNavigationAndVendors } from './useNodeNavigationAndVendors';

function loadValidSavedRun(): RunState | null {
  const loaded = loadActiveRun();
  if (loaded && loaded.screen !== 'victory' && loaded.screen !== 'gameover') {
    return loaded;
  }
  return null;
}

function blurActiveElement(): void {
  if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}

export interface UseRunControllerOptions {
  lang: Language;
  showTitle: boolean;
  setShowTitle: (show: boolean) => void;
  paused: boolean;
  setPaused: (paused: boolean) => void;
  poolModalOpen: boolean;
  setPoolModalOpen: (open: boolean) => void;
  codexOpen: boolean;
  effectiveTacticalView: boolean;
}

export function useRunController({
  lang,
  showTitle,
  setShowTitle,
  paused,
  setPaused,
  poolModalOpen,
  setPoolModalOpen,
  codexOpen,
  effectiveTacticalView,
}: UseRunControllerOptions) {
  const [bestRecord, setBestRecord] = useState<BestRunRecord>(() => loadBestRecord());

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
    () => initialState.saved?.hero.characterId ?? 'kira',
  );
  const [selectedDifficultyTier, setSelectedDifficultyTier] = useState<DifficultyTier>(
    () => initialState.saved?.difficultyTier ?? DEFAULT_DIFFICULTY_TIER,
  );
  const [readyOutcomeKey, setReadyOutcomeKey] = useState<string | null>(null);
  const [completedCueBatchKey, setCompletedCueBatchKey] = useState<string>('');

  const runRef = useRef(run);
  runRef.current = run;
  const langRef = useRef(lang);
  langRef.current = lang;
  const effectiveTacticalViewRef = useRef(effectiveTacticalView);
  effectiveTacticalViewRef.current = effectiveTacticalView;

  // Track acted enemies by unique enemy.id (not array index) so reinforcements/deaths/swaps never skip or double-act
  const enemyActedSetRef = useRef<Set<string>>(new Set());
  const recordedRunIdRef = useRef<string | null>(null);
  const defeatSoundPlayedOutcomeRef = useRef<string | null>(null);
  const lastPersistedRunRef = useRef<RunState | null>(initialState.saved);

  const combat = run.combat;
  const diffProfile = useMemo(
    () => getDifficultyProfile(run.difficultyTier),
    [run.difficultyTier],
  );

  const sandbox = useCombatSandbox({
    run,
    runRef,
    setRun,
    initialSnapshot: initialState.encounterSnapshot,
    lang,
    langRef,
    showTitle,
    paused,
    poolModalOpen,
    codexOpen,
    diffProfile,
    enemyActedSetRef,
    defeatSoundPlayedOutcomeRef,
    setReadyOutcomeKey,
  });

  const {
    encounterStartSnapshot,
    setEncounterStartSnapshot,
    undosUsedInNode,
    hintsUsedInNode,
    failForwardUsedInNode,
    hasDefeatRecoveryOption,
    objectivesSummary,
    resetCombatSandboxForNewNode,
    restoreCombatSandboxFromSaved,
    setHoveredColor,
    setSelectedColor,
  } = sandbox;

  const finalizeEndedRunIfNeeded = useCallback((candidateRun: RunState) => {
    if (candidateRun.screen !== 'victory' && candidateRun.screen !== 'gameover') {
      return;
    }
    if (recordedRunIdRef.current === candidateRun.runId) {
      return;
    }
    recordedRunIdRef.current = candidateRun.runId;
    const nanitesEarned = candidateRun.hero.nanites ?? 0;
    const nanitesBanked =
      candidateRun.screen === 'victory' ? nanitesEarned : Math.floor(nanitesEarned * 0.65);
    const nextRecord = recordRunCompletion(
      candidateRun.score,
      candidateRun.screen === 'victory',
      nanitesBanked,
    );
    setBestRecord(nextRecord);
    clearActiveRun();
    lastPersistedRunRef.current = null;
    setSavedRunSnapshot(null);
  }, []);

  const currentCueBatchKey = useMemo(
    () => (combat?.lastCues ?? []).map((c) => c.id).join('|'),
    [combat?.lastCues],
  );
  const handleCueSequenceComplete = useCallback((batchKey: string) => {
    setCompletedCueBatchKey(batchKey);
  }, []);

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
        current.hero.characterId ?? 'kira',
        current.combat.enemies.map((e) => e.archetype),
      );
    }
  }, [showTitle]);

  // Wait for hit, Hit-Stop, enemy stagger, KO animation, and camera reset before showing reward/end UI
  useEffect(() => {
    if (showTitle || paused || !outcomeKey) {
      return;
    }
    if (readyOutcomeKey === outcomeKey) {
      return;
    }

    const cues = combat?.lastCues ?? [];
    const seqCompleted =
      currentCueBatchKey !== '' && completedCueBatchKey === currentCueBatchKey;
    const delayMs =
      cues.length === 0
        ? 180
        : seqCompleted
          ? 40
          : effectiveTacticalViewRef.current
            ? 880
            : 2200;

    const tid = window.setTimeout(() => {
      setReadyOutcomeKey(outcomeKey);
    }, delayMs);

    return () => {
      window.clearTimeout(tid);
    };
  }, [
    combat?.lastCues,
    completedCueBatchKey,
    currentCueBatchKey,
    outcomeKey,
    paused,
    readyOutcomeKey,
    showTitle,
  ]);

  // Sequential enemy turn stepper tracking acted enemies by enemy.id and decoupled from lang / effectiveTacticalView
  useEffect(() => {
    if (showTitle || paused || poolModalOpen || codexOpen || run.screen !== 'combat' || !combat) {
      return;
    }

    if (combat.phase !== 'PLAYER_RESOLVED' && combat.phase !== 'ENEMY_ACTING') {
      enemyActedSetRef.current.clear();
      return;
    }

    const nextEnemyIdx = combat.enemies.findIndex(
      (e) => e.hp > 0 && !e.escaped && !enemyActedSetRef.current.has(e.id),
    );

    const seqCompleted =
      currentCueBatchKey !== '' && completedCueBatchKey === currentCueBatchKey;
    const isEmptyBatch = currentCueBatchKey === '';
    const delayMs = isEmptyBatch
      ? 180
      : seqCompleted
        ? combat.phase === 'PLAYER_RESOLVED'
          ? 80
          : 60
        : effectiveTacticalViewRef.current
          ? 900
          : 2600;

    const tid = window.setTimeout(() => {
      if (nextEnemyIdx !== -1) {
        const actingEnemy = combat.enemies[nextEnemyIdx];
        if (actingEnemy) {
          enemyActedSetRef.current.add(actingEnemy.id);
        }
        const rawNextState = executeSingleEnemyAction(run, nextEnemyIdx);
        const nextState = applyBossObjectivesIfVictory(
          rawNextState,
          encounterStartSnapshot?.hero.hp ?? run.hero.maxHp,
          undosUsedInNode,
          hintsUsedInNode,
          failForwardUsedInNode,
          langRef.current,
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
  }, [
    combat,
    codexOpen,
    completedCueBatchKey,
    currentCueBatchKey,
    encounterStartSnapshot?.hero.hp,
    failForwardUsedInNode,
    hintsUsedInNode,
    paused,
    poolModalOpen,
    run,
    showTitle,
    undosUsedInNode,
  ]);

  // Persist active run and defer run-completion recording on gameover if encounter retry/skip recovery is available
  useEffect(() => {
    if (showTitle) return;

    if (run.screen === 'victory') {
      if (recordedRunIdRef.current !== run.runId) {
        finalizeEndedRunIfNeeded(run);
        soundEngine.playVictory();
      }
      return;
    }

    if (run.screen === 'gameover') {
      if (defeatSoundPlayedOutcomeRef.current !== outcomeKey) {
        defeatSoundPlayedOutcomeRef.current = outcomeKey;
        soundEngine.playDefeat();
      }
      if (!hasDefeatRecoveryOption) {
        finalizeEndedRunIfNeeded(run);
        setEncounterStartSnapshot(null);
      }
      return;
    }

    if (lastPersistedRunRef.current !== run) {
      lastPersistedRunRef.current = run;
      saveActiveRun(run);
      setSavedRunSnapshot(run);
    }
  }, [
    finalizeEndedRunIfNeeded,
    hasDefeatRecoveryOption,
    outcomeKey,
    run,
    setEncounterStartSnapshot,
    showTitle,
  ]);

  const navAndVendors = useNodeNavigationAndVendors({
    runRef,
    setRun,
    langRef,
    objectivesSummary,
    resetCombatSandboxForNewNode,
  });

  const handleStartNewRun = useCallback(
    (charOverride?: CharacterId) => {
      if (runRef.current.screen === 'gameover') {
        finalizeEndedRunIfNeeded(runRef.current);
      }
      const charId = charOverride ?? selectedCharacter;
      blurActiveElement();
      soundEngine.playClick();
      clearActiveRun();
      const fresh = createInitialRun(
        Math.floor(Date.now() % 900000) + 10000,
        charId,
        selectedDifficultyTier,
        true,
      );
      if (fresh.screen === 'combat' && fresh.combat) {
        void ensureCombatAssetsReady(
          charId,
          fresh.combat.enemies.map((e) => e.archetype),
        );
      }
      recordedRunIdRef.current = null;
      defeatSoundPlayedOutcomeRef.current = null;
      setPaused(false);
      setPoolModalOpen(false);
      navAndVendors.setDefibNoticeVisible(false);
      const isIronman = getDifficultyProfile(selectedDifficultyTier).maxRunResets === 0;
      const nextSnapshot = !isIronman && fresh.screen === 'combat' ? fresh : null;
      resetCombatSandboxForNewNode(nextSnapshot);
      saveEncounterSnapshot(nextSnapshot);
      setRun(fresh);
      setSavedRunSnapshot(fresh);
      setShowTitle(false);
      if (typeof document !== 'undefined') {
        document.body.dataset.state = 'playing';
      }
    },
    [
      finalizeEndedRunIfNeeded,
      navAndVendors,
      resetCombatSandboxForNewNode,
      selectedCharacter,
      selectedDifficultyTier,
      setPaused,
      setPoolModalOpen,
      setShowTitle,
    ],
  );

  const handleContinueRun = useCallback(() => {
    blurActiveElement();
    soundEngine.playClick();
    if (savedRunSnapshot) {
      if (savedRunSnapshot.screen === 'combat' && savedRunSnapshot.combat) {
        void ensureCombatAssetsReady(
          savedRunSnapshot.hero.characterId ?? 'kira',
          savedRunSnapshot.combat.enemies.map((e) => e.archetype),
        );
      }
      setSelectedDifficultyTier(savedRunSnapshot.difficultyTier ?? DEFAULT_DIFFICULTY_TIER);
      setRun(savedRunSnapshot);
      const isIronmanSaved =
        getDifficultyProfile(savedRunSnapshot.difficultyTier ?? DEFAULT_DIFFICULTY_TIER)
          .maxRunResets === 0;
      const savedSnap =
        !isIronmanSaved && savedRunSnapshot.screen === 'combat' ? loadEncounterSnapshot() : null;
      const nextSnapshot =
        !isIronmanSaved && savedRunSnapshot.screen === 'combat'
          ? savedSnap &&
            savedSnap.runId === savedRunSnapshot.runId &&
            savedSnap.combat?.nodeId === savedRunSnapshot.combat?.nodeId
            ? savedSnap
            : savedRunSnapshot
          : null;
      restoreCombatSandboxFromSaved(savedRunSnapshot, nextSnapshot);
    } else {
      setHoveredColor(null);
      setSelectedColor(null);
    }
    setPaused(false);
    setPoolModalOpen(false);
    setShowTitle(false);
    if (typeof document !== 'undefined') {
      document.body.dataset.state = 'playing';
    }
  }, [
    restoreCombatSandboxFromSaved,
    savedRunSnapshot,
    setHoveredColor,
    setPaused,
    setPoolModalOpen,
    setSelectedColor,
    setShowTitle,
  ]);

  const handleReturnToTitle = useCallback(() => {
    if (runRef.current.screen === 'gameover' || runRef.current.screen === 'victory') {
      finalizeEndedRunIfNeeded(runRef.current);
      setEncounterStartSnapshot(null);
    }
    enemyActedSetRef.current.clear();
    soundEngine.playClick();
    setHoveredColor(null);
    setSelectedColor(null);
    setPaused(false);
    setPoolModalOpen(false);
    setShowTitle(true);
    if (typeof document !== 'undefined') {
      document.body.dataset.state = 'title';
    }
  }, [
    finalizeEndedRunIfNeeded,
    setEncounterStartSnapshot,
    setHoveredColor,
    setPaused,
    setPoolModalOpen,
    setSelectedColor,
    setShowTitle,
  ]);

  return {
    run,
    combat,
    savedRunSnapshot,
    bestRecord,
    selectedCharacter,
    setSelectedCharacter,
    selectedDifficultyTier,
    setSelectedDifficultyTier,
    diffProfile,
    postCombatOverlayReady,
    handleCueSequenceComplete,
    handleStartNewRun,
    handleContinueRun,
    handleReturnToTitle,
    ...sandbox,
    ...navAndVendors,
  };
}
