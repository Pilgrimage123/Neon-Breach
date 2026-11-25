import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { soundEngine } from '../audio/soundEngine';
import { DEFAULT_DIFFICULTY_TIER, getDifficultyProfile, type DifficultyTierProfile } from '../engine/difficulty';
import { executeOverdrive, getSurgeThreshold, previewColorResolution, resolvePlayerColor, skipCombatEncounter } from '../engine/gameEngine';
import { saveEncounterSnapshot } from '../engine/persistence';
import type { RunState, TileType } from '../engine/types';
import type { Language } from '../i18n/translations';
import { isDevLabRunId } from '../utils/devLabMode';
import { applyFailForwardBuff, canRepositionEnemies, computeContextualMicroPrompt, computeEncounterObjectives, computeOptimalTurnHint, repositionFrontEnemies } from '../utils/tacticalSandboxAndHints';

export function applyBossObjectivesIfVictory(
  state: RunState,
  startingHp: number,
  undosUsed: number,
  hintsUsed: number,
  failForwardUsed: boolean,
  lang: Language,
): RunState {
  if (state.screen !== 'victory' || !state.combat || state.combat.nodeType !== 'BOSS') {
    return state;
  }
  const obj = computeEncounterObjectives({
    combat: state.combat,
    hero: state.hero,
    startingHp: state.combat.startingHeroHp ?? startingHp,
    undosUsed,
    hintsUsed,
    failForwardUsed,
    difficultyTier: state.difficultyTier ?? DEFAULT_DIFFICULTY_TIER,
    lang,
  });
  return {
    ...state,
    score: state.score + obj.bonusScore,
    hero: {
      ...state.hero,
      credits: state.hero.credits + obj.bonusCredits,
      nanites: (state.hero.nanites ?? 0) + obj.bonusNanites,
    },
  };
}

export interface UseCombatSandboxOptions {
  run: RunState;
  runRef: MutableRefObject<RunState>;
  setRun: Dispatch<SetStateAction<RunState>>;
  initialSnapshot: RunState | null;
  lang: Language;
  langRef: MutableRefObject<Language>;
  showTitle: boolean;
  paused: boolean;
  poolModalOpen: boolean;
  codexOpen: boolean;
  diffProfile: DifficultyTierProfile;
  enemyActedSetRef: MutableRefObject<Set<string>>;
  defeatSoundPlayedOutcomeRef: MutableRefObject<string | null>;
  setReadyOutcomeKey: Dispatch<SetStateAction<string | null>>;
}

export function useCombatSandbox({
  run,
  runRef,
  setRun,
  initialSnapshot,
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
}: UseCombatSandboxOptions) {
  const combat = run.combat;
  const [hoveredColor, setHoveredColor] = useState<TileType | null>(null);
  const [selectedColor, setSelectedColor] = useState<TileType | null>(null);
  const [turnHistory, setTurnHistory] = useState<
    Array<{ run: RunState; swappedThisTurn: boolean; isSwapOnly?: boolean }>
  >([]);
  const [encounterStartSnapshot, setEncounterStartSnapshot] = useState<RunState | null>(
    initialSnapshot,
  );
  const [undosUsedInNode, setUndosUsedInNode] = useState<number>(
    () => run.combat?.committedUndosUsed ?? 0,
  );
  const [committedUndosUsedInNode, setCommittedUndosUsedInNode] = useState<number>(
    () => run.combat?.committedUndosUsed ?? 0,
  );
  const [battleResetsUsedInNode, setBattleResetsUsedInNode] = useState<number>(
    () => run.combat?.battleResetsUsed ?? 0,
  );
  const [failedAttemptsInNode, setFailedAttemptsInNode] = useState<number>(
    () => run.combat?.failedAttempts ?? 0,
  );
  const [hintsUsedInNode, setHintsUsedInNode] = useState<number>(0);
  const [failForwardUsedInNode, setFailForwardUsedInNode] = useState<boolean>(false);
  const [swappedThisTurn, setSwappedThisTurn] = useState<boolean>(false);
  const [hasUsedSwapEver, setHasUsedSwapEver] = useState<boolean>(false);
  const [hintVisible, setHintVisible] = useState<boolean>(false);
  const gameoverCountedRef = useRef<boolean>(false);

  // Track defeat attempts in the current node (for Tier 1 Story encounter skip after 2 fails)
  useEffect(() => {
    if (run.screen === 'gameover') {
      if (!gameoverCountedRef.current) {
        gameoverCountedRef.current = true;
        setFailedAttemptsInNode((f) => f + 1);
      }
    } else {
      gameoverCountedRef.current = false;
    }
  }, [run.screen]);

  const canUndoTurn = useMemo(() => {
    if (
      run.screen !== 'combat' ||
      !combat ||
      combat.phase === 'VICTORY' ||
      combat.phase === 'DEFEAT'
    ) {
      return false;
    }
    if (turnHistory.length === 0) return false;
    const lastEntry = turnHistory[turnHistory.length - 1];
    if (lastEntry.isSwapOnly) {
      return diffProfile.allowSwapUndoBeforeCommit;
    }
    return (
      diffProfile.maxCommittedUndosPerBattle === null ||
      committedUndosUsedInNode < diffProfile.maxCommittedUndosPerBattle
    );
  }, [combat, committedUndosUsedInNode, diffProfile, run.screen, turnHistory]);

  const runResetsUsed = run.runResetsUsed ?? 0;
  const hasResetBudget =
    (diffProfile.maxBattleResets === null ||
      battleResetsUsedInNode < diffProfile.maxBattleResets) &&
    (diffProfile.maxRunResets === null || runResetsUsed < diffProfile.maxRunResets);

  const canResetEncounter = Boolean(
    encounterStartSnapshot &&
      hasResetBudget &&
      ((combat?.turn ?? 1) > 1 || turnHistory.length > 0 || run.screen === 'gameover'),
  );

  const canSkipEncounter = Boolean(
    diffProfile.skipEncounterAfterFails !== null &&
      failedAttemptsInNode >= diffProfile.skipEncounterAfterFails &&
      combat &&
      combat.nodeType !== 'BOSS',
  );

  const hasDefeatRecoveryOption = Boolean(
    run.screen === 'gameover' &&
      ((encounterStartSnapshot && (diffProfile.failForwardAllowed || hasResetBudget)) ||
        canSkipEncounter),
  );

  const activeColor = hoveredColor ?? selectedColor;
  const activePreview = useMemo(() => {
    if (!activeColor || run.screen !== 'combat' || run.combat?.phase !== 'PLAYER_IDLE') {
      return null;
    }
    return previewColorResolution(run, activeColor);
  }, [run, activeColor]);

  const objectivesSummary = useMemo(() => {
    if (!combat) return null;
    const startingHp = combat.startingHeroHp ?? encounterStartSnapshot?.hero.hp ?? run.hero.maxHp;
    return computeEncounterObjectives({
      combat,
      hero: run.hero,
      startingHp,
      undosUsed: undosUsedInNode,
      hintsUsed: hintsUsedInNode,
      failForwardUsed: failForwardUsedInNode,
      difficultyTier: run.difficultyTier ?? DEFAULT_DIFFICULTY_TIER,
      lang,
    });
  }, [
    combat,
    encounterStartSnapshot?.hero.hp,
    failForwardUsedInNode,
    hintsUsedInNode,
    lang,
    run.difficultyTier,
    run.hero,
    undosUsedInNode,
  ]);

  const activeHint = useMemo(() => {
    if (!hintVisible || run.screen !== 'combat' || combat?.phase !== 'PLAYER_IDLE') {
      return null;
    }
    return computeOptimalTurnHint(run, lang, swappedThisTurn);
  }, [combat?.phase, hintVisible, lang, run, swappedThisTurn]);

  const undoResetHint = useMemo(() => {
    const isCs = lang === 'cs';
    if (diffProfile.tier === 1) return isCs ? 'Zpět: ∞' : 'Undo: ∞';
    if (diffProfile.tier === 2) return isCs ? 'Reset: ∞' : 'Reset: ∞';
    if (diffProfile.tier === 3) {
      const remU = Math.max(0, 1 - committedUndosUsedInNode);
      const remR = Math.max(0, 1 - battleResetsUsedInNode);
      return isCs ? `Zpět ${remU} · Reset ${remR}` : `Undo ${remU} · Rst ${remR}`;
    }
    if (diffProfile.tier === 4) {
      const remR = Math.max(0, 1 - runResetsUsed);
      return isCs ? `Prohoz zpět · Reset ${remR}/výprava` : `Swap Undo · Rst ${remR}/Run`;
    }
    return 'IRONMAN';
  }, [battleResetsUsedInNode, committedUndosUsedInNode, diffProfile.tier, lang, runResetsUsed]);

  const resetCombatSandboxForNewNode = useCallback(
    (nextSnapshot: RunState | null) => {
      enemyActedSetRef.current.clear();
      setHoveredColor(null);
      setSelectedColor(null);
      setTurnHistory([]);
      setEncounterStartSnapshot(nextSnapshot);
      setUndosUsedInNode(0);
      setCommittedUndosUsedInNode(0);
      setBattleResetsUsedInNode(0);
      setFailedAttemptsInNode(0);
      setHintsUsedInNode(0);
      setFailForwardUsedInNode(false);
      setSwappedThisTurn(false);
      setHintVisible(false);
      setReadyOutcomeKey(null);
    },
    [enemyActedSetRef, setReadyOutcomeKey],
  );

  const restoreCombatSandboxFromSaved = useCallback(
    (savedRun: RunState, nextSnapshot: RunState | null) => {
      setEncounterStartSnapshot(nextSnapshot);
      setTurnHistory([]);
      setUndosUsedInNode(savedRun.combat?.committedUndosUsed ?? 0);
      setCommittedUndosUsedInNode(savedRun.combat?.committedUndosUsed ?? 0);
      setBattleResetsUsedInNode(savedRun.combat?.battleResetsUsed ?? 0);
      setFailedAttemptsInNode(savedRun.combat?.failedAttempts ?? 0);
      setHintsUsedInNode(0);
      setFailForwardUsedInNode(false);
      setSwappedThisTurn(false);
      setHintVisible(false);
      setHoveredColor(null);
      setSelectedColor(null);
    },
    [],
  );

  const playHoverIfChanged = useCallback(
    (color: TileType | null, prevColor: TileType | null) => {
      if (color && color !== prevColor) {
        const currentRun = runRef.current;
        const boardTiles = currentRun.combat?.board ?? [];
        const activeCount = boardTiles.filter((t) => !t.isJammed && t.type === color).length;
        const surgeReq = getSurgeThreshold(currentRun.hero.implants);
        soundEngine.playHover(activeCount >= surgeReq);
      }
    },
    [runRef],
  );

  const handleHoverColor = useCallback(
    (color: TileType | null) => {
      playHoverIfChanged(color, hoveredColor);
      setHoveredColor(color);
    },
    [hoveredColor, playHoverIfChanged],
  );

  const handleSelectColor = useCallback(
    (color: TileType | null) => {
      playHoverIfChanged(color, selectedColor);
      setSelectedColor(color);
    },
    [playHoverIfChanged, selectedColor],
  );

  const handleCommitColor = useCallback(
    (color: TileType) => {
      const currentRun = runRef.current;
      if (showTitle || paused || poolModalOpen || codexOpen) return;
      if (
        currentRun.screen !== 'combat' ||
        !currentRun.combat ||
        currentRun.combat.phase !== 'PLAYER_IDLE'
      ) {
        return;
      }
      const preview = previewColorResolution(currentRun, color);
      if (preview.tileCount === 0) return;

      if (color === 'attack') soundEngine.playSlash(preview.surgeTriggered);
      else if (color === 'defense') soundEngine.playShield(preview.surgeTriggered);
      else soundEngine.playUpgrade(preview.surgeTriggered);

      setTurnHistory((prev) => [
        ...prev.slice(-12),
        { run: currentRun, swappedThisTurn, isSwapOnly: false },
      ]);
      setSwappedThisTurn(false);
      setHintVisible(false);
      enemyActedSetRef.current.clear();
      const rawNextState = resolvePlayerColor(currentRun, color);
      const nextState = applyBossObjectivesIfVictory(
        rawNextState,
        encounterStartSnapshot?.hero.hp ?? currentRun.hero.maxHp,
        undosUsedInNode,
        hintsUsedInNode,
        failForwardUsedInNode,
        langRef.current,
      );
      const cues = nextState.combat?.lastCues ?? [];
      if (cues.some((c) => c.kind === 'enemy_burst')) soundEngine.playBioBurst();
      if (cues.some((c) => c.kind === 'enemy_retaliate' || c.kind === 'enemy_pustule_rupture')) {
        soundEngine.playRetaliateSpike();
      }
      if (cues.some((c) => c.kind === 'enemy_phase_gate')) soundEngine.playShieldPipCrack();
      setRun(nextState);
      setHoveredColor(null);
      setSelectedColor(null);
    },
    [
      codexOpen,
      encounterStartSnapshot?.hero.hp,
      enemyActedSetRef,
      failForwardUsedInNode,
      hintsUsedInNode,
      langRef,
      paused,
      poolModalOpen,
      runRef,
      setRun,
      showTitle,
      swappedThisTurn,
      undosUsedInNode,
    ],
  );

  const handleOverdrive = useCallback(() => {
    const currentRun = runRef.current;
    if (showTitle || paused || poolModalOpen || codexOpen) return;
    if (
      currentRun.screen !== 'combat' ||
      !currentRun.combat ||
      currentRun.combat.phase !== 'PLAYER_IDLE'
    ) {
      return;
    }
    if (currentRun.hero.overdrive < 100) return;
    soundEngine.playOverdrive();
    setTurnHistory((prev) => [
      ...prev.slice(-12),
      { run: currentRun, swappedThisTurn, isSwapOnly: false },
    ]);
    setHintVisible(false);
    setHoveredColor(null);
    setSelectedColor(null);
    const rawNextState = executeOverdrive(currentRun);
    const nextState = applyBossObjectivesIfVictory(
      rawNextState,
      encounterStartSnapshot?.hero.hp ?? currentRun.hero.maxHp,
      undosUsedInNode,
      hintsUsedInNode,
      failForwardUsedInNode,
      langRef.current,
    );
    const cues = nextState.combat?.lastCues ?? [];
    if (cues.some((c) => c.kind === 'enemy_burst')) soundEngine.playBioBurst();
    if (cues.some((c) => c.kind === 'enemy_phase_gate')) soundEngine.playShieldPipCrack();
    setRun(nextState);
  }, [
    codexOpen,
    encounterStartSnapshot?.hero.hp,
    failForwardUsedInNode,
    hintsUsedInNode,
    langRef,
    paused,
    poolModalOpen,
    runRef,
    setRun,
    showTitle,
    swappedThisTurn,
    undosUsedInNode,
  ]);

  const handleSwapEnemies = useCallback(() => {
    const currentRun = runRef.current;
    if (showTitle || paused || poolModalOpen || codexOpen) return;
    if (
      currentRun.screen !== 'combat' ||
      !currentRun.combat ||
      currentRun.combat.phase !== 'PLAYER_IDLE'
    ) {
      return;
    }
    if (!canRepositionEnemies(currentRun.combat, swappedThisTurn)) {
      soundEngine.playInvalidBuzz();
      return;
    }
    const swapped = repositionFrontEnemies(currentRun.combat);
    if (!swapped.swapped) return;
    soundEngine.playEnemyArmor();
    const currentDiffProfile = getDifficultyProfile(currentRun.difficultyTier);
    if (currentDiffProfile.allowSwapUndoBeforeCommit) {
      setTurnHistory((prev) => [
        ...prev.slice(-12),
        { run: currentRun, swappedThisTurn, isSwapOnly: true },
      ]);
    }
    setSwappedThisTurn(true);
    setHasUsedSwapEver(true);
    setRun({
      ...currentRun,
      combat: {
        ...currentRun.combat,
        enemies: swapped.enemies,
      },
    });
  }, [codexOpen, paused, poolModalOpen, runRef, setRun, showTitle, swappedThisTurn]);

  const handleUndoTurn = useCallback(() => {
    if (showTitle || paused || poolModalOpen || codexOpen) return;
    const currentRun = runRef.current;
    if (
      currentRun.screen !== 'combat' ||
      !currentRun.combat ||
      currentRun.combat.phase === 'VICTORY' ||
      currentRun.combat.phase === 'DEFEAT'
    ) {
      return;
    }
    if (turnHistory.length === 0 || !canUndoTurn) {
      soundEngine.playInvalidBuzz();
      return;
    }
    soundEngine.playClick();
    enemyActedSetRef.current.clear();
    const prevEntry = turnHistory[turnHistory.length - 1];
    const nextCommittedUndos = !prevEntry.isSwapOnly
      ? committedUndosUsedInNode + 1
      : committedUndosUsedInNode;
    setTurnHistory((prev) => prev.slice(0, -1));
    setUndosUsedInNode((u) => u + 1);
    if (!prevEntry.isSwapOnly) {
      setCommittedUndosUsedInNode(nextCommittedUndos);
    }
    setSwappedThisTurn(prevEntry.swappedThisTurn);
    setHintVisible(false);
    setHoveredColor(null);
    setSelectedColor(null);
    setReadyOutcomeKey(null);
    const restoredRun: RunState = prevEntry.run.combat
      ? {
          ...prevEntry.run,
          combat: {
            ...prevEntry.run.combat,
            committedUndosUsed: nextCommittedUndos,
            battleResetsUsed: battleResetsUsedInNode,
            failedAttempts: failedAttemptsInNode,
          },
        }
      : prevEntry.run;
    setRun(restoredRun);
  }, [
    battleResetsUsedInNode,
    canUndoTurn,
    codexOpen,
    committedUndosUsedInNode,
    enemyActedSetRef,
    failedAttemptsInNode,
    paused,
    poolModalOpen,
    setReadyOutcomeKey,
    setRun,
    showTitle,
    turnHistory,
  ]);

  const handleResetEncounter = useCallback(() => {
    if (!encounterStartSnapshot || !hasResetBudget) {
      soundEngine.playInvalidBuzz();
      return;
    }
    soundEngine.playClick();
    enemyActedSetRef.current.clear();
    defeatSoundPlayedOutcomeRef.current = null;
    const nextRunResetsUsed = (runRef.current.runResetsUsed ?? 0) + 1;
    const nextBattleResetsUsed = battleResetsUsedInNode + 1;
    const restored: RunState = {
      ...encounterStartSnapshot,
      runResetsUsed: nextRunResetsUsed,
      combat: encounterStartSnapshot.combat
        ? {
            ...encounterStartSnapshot.combat,
            committedUndosUsed: 0,
            battleResetsUsed: nextBattleResetsUsed,
            failedAttempts: failedAttemptsInNode,
          }
        : encounterStartSnapshot.combat,
    };
    setEncounterStartSnapshot(restored);
    if (!isDevLabRunId(restored.runId)) {
      saveEncounterSnapshot(restored);
    }
    setTurnHistory([]);
    setUndosUsedInNode((u) => u + 1);
    setCommittedUndosUsedInNode(0);
    setBattleResetsUsedInNode(nextBattleResetsUsed);
    setSwappedThisTurn(false);
    setHintVisible(false);
    setHoveredColor(null);
    setSelectedColor(null);
    setReadyOutcomeKey(null);
    setRun(restored);
  }, [
    battleResetsUsedInNode,
    defeatSoundPlayedOutcomeRef,
    encounterStartSnapshot,
    enemyActedSetRef,
    failedAttemptsInNode,
    hasResetBudget,
    runRef,
    setReadyOutcomeKey,
    setRun,
  ]);

  const handleFailForwardRetry = useCallback(() => {
    if (!encounterStartSnapshot || !diffProfile.failForwardAllowed) {
      soundEngine.playInvalidBuzz();
      return;
    }
    soundEngine.playUpgrade(true);
    enemyActedSetRef.current.clear();
    defeatSoundPlayedOutcomeRef.current = null;
    const buffed = applyFailForwardBuff(encounterStartSnapshot);
    setTurnHistory([]);
    setUndosUsedInNode((u) => u + 1);
    setFailForwardUsedInNode(true);
    setSwappedThisTurn(false);
    setHintVisible(false);
    setHoveredColor(null);
    setSelectedColor(null);
    setReadyOutcomeKey(null);
    setRun(buffed);
  }, [
    defeatSoundPlayedOutcomeRef,
    diffProfile.failForwardAllowed,
    encounterStartSnapshot,
    enemyActedSetRef,
    setReadyOutcomeKey,
    setRun,
  ]);

  const handleSkipEncounter = useCallback(() => {
    if (!canSkipEncounter) {
      soundEngine.playInvalidBuzz();
      return;
    }
    soundEngine.playClick();
    defeatSoundPlayedOutcomeRef.current = null;
    const skipped = skipCombatEncounter(runRef.current);
    resetCombatSandboxForNewNode(null);
    if (!isDevLabRunId(runRef.current.runId)) {
      saveEncounterSnapshot(null);
    }
    setRun(skipped);
  }, [canSkipEncounter, defeatSoundPlayedOutcomeRef, resetCombatSandboxForNewNode, runRef, setRun]);

  const handleToggleHint = useCallback(() => {
    if (!diffProfile.hintsAllowed) {
      soundEngine.playInvalidBuzz();
      setHintVisible(false);
      return;
    }
    soundEngine.playClick();
    if (!hintVisible) {
      setHintsUsedInNode((h) => h + 1);
    }
    setHintVisible((prev) => !prev);
  }, [diffProfile.hintsAllowed, hintVisible]);

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

  return {
    hoveredColor,
    setHoveredColor,
    selectedColor,
    setSelectedColor,
    activeColor,
    activePreview,
    encounterStartSnapshot,
    setEncounterStartSnapshot,
    undosUsedInNode,
    hintsUsedInNode,
    failForwardUsedInNode,
    swappedThisTurn,
    canUndoTurn,
    hasResetBudget,
    canResetEncounter,
    canSkipEncounter,
    hasDefeatRecoveryOption,
    undoResetHint,
    objectivesSummary,
    activeHint,
    countByColor,
    onboardingPrompt,
    resetCombatSandboxForNewNode,
    restoreCombatSandboxFromSaved,
    handleHoverColor,
    handleSelectColor,
    handleCommitColor,
    handleOverdrive,
    handleSwapEnemies,
    handleUndoTurn,
    handleResetEncounter,
    handleFailForwardRetry,
    handleSkipEncounter,
    handleToggleHint,
  };
}
