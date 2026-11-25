import { useCallback, useEffect, useMemo, useState } from 'react';
import { soundEngine } from './audio/soundEngine';
import { BioMedBayView } from './components/BioMedBayView';
import { ChipDealerView } from './components/ChipDealerView';
import { CodexModal, type CodexTab } from './components/CodexModal';
import { CombatLootOverlay } from './components/CombatLootOverlay';
import { CombatStageCanvas } from './components/CombatStageCanvas';
import { CyberClinicView } from './components/CyberClinicView';
import { CyberEventView } from './components/CyberEventView';
import { EndRunModal, PauseModal, PoolModal } from './components/Modals';
import { SectorMapView } from './components/SectorMapView';
import { TacticalDock } from './components/TacticalDock';
import { TitleScreen } from './components/TitleScreen';
import { TopHud } from './components/TopHud';
import type { CharacterId } from './engine/types';
import { useGlobalHotkeys } from './hooks/useGlobalHotkeys';
import { useRunController } from './hooks/useRunController';
import type { GlossaryTermId } from './i18n/codexTranslations';
import type { Language } from './i18n/translations';
import {
  cycleSemanticZoomLevel,
  detectPhysicalScreenProfile,
  loadAccessibilityPrefs,
  saveAccessibilityPrefs,
  type AccessibilityPrefs,
} from './utils/accessibilityAndScale';
import { canRepositionEnemies } from './utils/tacticalSandboxAndHints';
import {
  type DevLabTabId,
  getInitialDevLabTab,
  isDevLabRunId,
  isDevLabsQueryEnabled,
} from './utils/devLabMode';
import { useFullscreen } from './utils/useFullscreen';
import { useViewportMetrics } from './utils/useViewportMetrics';

function isAutostartEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('autostart') === '1';
}

export default function App() {
  const viewport = useViewportMetrics();
  const fullscreen = useFullscreen();
  const [lang, setLang] = useState<Language>('cs');
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
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
  const [altHeldTactical, setAltHeldTactical] = useState<boolean>(false);
  const [hoveringSwap, setHoveringSwap] = useState<boolean>(false);
  const [quantizedScaleMode, setQuantizedScaleMode] = useState<boolean>(false);
  const [devLabsEnabled, setDevLabsEnabled] = useState<boolean>(() => isDevLabsQueryEnabled());
  const [initialDevLabTab, setInitialDevLabTab] = useState<DevLabTabId | null>(() =>
    getInitialDevLabTab(),
  );

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

  const controller = useRunController({
    lang,
    showTitle,
    setShowTitle,
    paused,
    setPaused,
    poolModalOpen,
    setPoolModalOpen,
    codexOpen: Boolean(codexTarget),
    effectiveTacticalView,
  });

  const { run, combat } = controller;

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

  const handleToggleMute = useCallback(() => {
    const next = !muted;
    soundEngine.setMuted(next);
    setMuted(next);
  }, [muted]);

  const handleToggleHudMinimized = useCallback(() => {
    soundEngine.playClick();
    setHudMinimized((prev) => !prev);
  }, []);

  const handleToggleTacticalView = useCallback(() => {
    soundEngine.playClick();
    const next = { ...a11yPrefs, tacticalView: !a11yPrefs.tacticalView };
    saveAccessibilityPrefs(next);
    setA11yPrefs(next);
  }, [a11yPrefs]);

  const handleCycleSemanticZoom = useCallback(() => {
    soundEngine.playClick();
    const next = {
      ...a11yPrefs,
      semanticZoom: cycleSemanticZoomLevel(a11yPrefs.semanticZoom),
    };
    saveAccessibilityPrefs(next);
    setA11yPrefs(next);
  }, [a11yPrefs]);

  const handleToggleAutoFocusCamera = useCallback(() => {
    soundEngine.playClick();
    const next = { ...a11yPrefs, autoFocusCamera: !a11yPrefs.autoFocusCamera };
    saveAccessibilityPrefs(next);
    setA11yPrefs(next);
  }, [a11yPrefs]);

  const handleToggleTwoStepConfirm = useCallback(() => {
    soundEngine.playClick();
    const next = { ...a11yPrefs, twoStepConfirm: !a11yPrefs.twoStepConfirm };
    saveAccessibilityPrefs(next);
    setA11yPrefs(next);
  }, [a11yPrefs]);

  const handleToggleLang = useCallback(() => {
    soundEngine.playClick();
    setLang((prev) => (prev === 'en' ? 'cs' : 'en'));
  }, []);

  const handleToggleQuantizedScale = useCallback(() => {
    soundEngine.playClick();
    setQuantizedScaleMode((prev) => !prev);
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
        hero: hero ?? run.hero.characterId ?? controller.selectedCharacter,
        termId,
      });
    },
    [controller.selectedCharacter, run.hero.characterId],
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

  const handleTogglePause = useCallback(() => {
    setPaused((prev) => !prev);
  }, []);

  const showFullscreenButton = fullscreen.isTouchscreen && fullscreen.isFullscreenSupported;
  const handleToggleFullscreen = useCallback(() => {
    soundEngine.playClick();
    void fullscreen.toggleFullscreen();
  }, [fullscreen]);

  const handleOpenDevLab = useCallback(() => {
    setDevLabsEnabled(true);
    setInitialDevLabTab('camera');
    controller.handleStartDevLab(controller.selectedCharacter);
  }, [controller]);

  const handleToggleDevLabs = useCallback(() => {
    soundEngine.playClick();
    setDevLabsEnabled((prev) => {
      const next = !prev;
      if (!next) {
        setInitialDevLabTab(null);
      }
      return next;
    });
  }, []);

  const handleSwitchDevLabHero = useCallback(
    (charId: CharacterId) => {
      controller.setSelectedCharacter(charId);
      if (isDevLabRunId(run.runId)) {
        controller.handleStartDevLab(charId);
      }
    },
    [controller, run.runId],
  );

  const handleReturnToTitleFromRun = useCallback(() => {
    if (isDevLabRunId(run.runId)) {
      setDevLabsEnabled(isDevLabsQueryEnabled());
      setInitialDevLabTab(getInitialDevLabTab());
    }
    controller.handleReturnToTitle();
  }, [controller, run.runId]);

  useGlobalHotkeys({
    showTitle,
    paused,
    poolModalOpen,
    codexTarget,
    run,
    savedRunSnapshot: controller.savedRunSnapshot,
    selectedCharacter: controller.selectedCharacter,
    postCombatOverlayReady: controller.postCombatOverlayReady,
    onToggleFullscreen: handleToggleFullscreen,
    onOpenCodex: handleOpenCodex,
    onCloseCodex: handleCloseCodex,
    onClosePool: handleClosePool,
    onTogglePause: handleTogglePause,
    onSetAltHeldTactical: setAltHeldTactical,
    onToggleTacticalView: handleToggleTacticalView,
    onCycleSemanticZoom: handleCycleSemanticZoom,
    onToggleAutoFocusCamera: handleToggleAutoFocusCamera,
    onToggleMute: handleToggleMute,
    onToggleLang: handleToggleLang,
    onToggleHudMinimized: handleToggleHudMinimized,
    onContinueRun: controller.handleContinueRun,
    onStartNewRun: controller.handleStartNewRun,
    onClaimCombatReward: controller.handleClaimCombatReward,
    onCommitColor: controller.handleCommitColor,
    onSwapEnemies: controller.handleSwapEnemies,
    onUndoTurn: controller.handleUndoTurn,
    onToggleHint: controller.handleToggleHint,
    onOverdrive: controller.handleOverdrive,
  });

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

  if (showTitle) {
    return (
      <div className={shellClassName} style={shellStyle}>
        <TitleScreen
          lang={lang}
          onToggleLang={handleToggleLang}
          hasSavedRun={Boolean(controller.savedRunSnapshot)}
          bestScore={controller.bestRecord.bestScore}
          stagesCleared={controller.bestRecord.stagesCleared}
          selectedCharacter={controller.selectedCharacter}
          onSelectCharacter={controller.setSelectedCharacter}
          selectedDifficultyTier={controller.selectedDifficultyTier}
          onSelectDifficultyTier={controller.setSelectedDifficultyTier}
          onStartNewRun={() => controller.handleStartNewRun(controller.selectedCharacter)}
          onContinueRun={controller.handleContinueRun}
          isCompactLandscape={viewport.isCompactLandscape}
          isNarrowPortrait={viewport.isNarrowPortrait}
          showLandscapeToggle={viewport.canOfferLandscapeToggle}
          isLandscapeRotated={viewport.isLandscapeRotated}
          onToggleLandscape={viewport.toggleLandscapeLock}
          showFullscreenButton={showFullscreenButton}
          isFullscreen={fullscreen.isFullscreen}
          onToggleFullscreen={handleToggleFullscreen}
          onOpenCodex={(tab, hero) => handleOpenCodex(tab, hero, null)}
          onOpenDevLab={handleOpenDevLab}
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
        objectivesSummary={controller.objectivesSummary}
        canUndoTurn={controller.canUndoTurn}
        canResetEncounter={controller.canResetEncounter}
        undoResetHint={controller.undoResetHint}
        onUndoTurn={controller.handleUndoTurn}
        onResetEncounter={controller.handleResetEncounter}
        isCompactLandscape={viewport.isCompactLandscape}
        onOpenPool={handleOpenPool}
        onOpenCodex={() => handleOpenCodex('heroes', run.hero.characterId ?? 'kira', null)}
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
          onSelectNode={controller.handleSelectMapNode}
          onOpenLoadout={handleOpenPool}
          onRerouteMeshNet={controller.handleRerouteMeshNet}
          onCharterEstate={controller.handleCharterEstate}
          onRideMagLev={controller.handleRideMagLev}
        />
      )}

      {run.screen === 'clinic' && (
        <CyberClinicView
          run={run}
          lang={lang}
          modalOpen={paused || poolModalOpen || Boolean(codexTarget)}
          isCompactLandscape={viewport.isCompactLandscape}
          defibTriggeredNotice={controller.defibNoticeVisible}
          onPurgeInnateTile={controller.handlePurgeInnateTile}
          onInstall={controller.handleInstallImplant}
          onOpenPool={handleOpenPool}
          onSkip={controller.handleSkipClinic}
          onIncubateTile={controller.handleIncubateTile}
          onMarryBloodline={controller.handleMarryBloodline}
          onEnrollProdigyTile={controller.handleEnrollProdigy}
          onSpliceTiles={controller.handleSpliceTiles}
        />
      )}

      {run.screen === 'chip_dealer' && (
        <ChipDealerView
          run={run}
          lang={lang}
          modalOpen={paused || poolModalOpen || Boolean(codexTarget)}
          isCompactLandscape={viewport.isCompactLandscape}
          onBuyChip={controller.handleBuyEquipment}
          onRestockShop={controller.handleRestockShop}
          onOpenPool={handleOpenPool}
          onLeave={controller.handleSkipChipDealer}
          onAdoptNannyBot={controller.handleAdoptNannyBot}
          onStartBetaTrial={controller.handleStartBetaTrial}
          onEngraveHeirloom={controller.handleEngraveHeirloom}
        />
      )}

      {run.screen === 'medbay' && (
        <BioMedBayView
          run={run}
          lang={lang}
          modalOpen={paused || poolModalOpen || Boolean(codexTarget)}
          isCompactLandscape={viewport.isCompactLandscape}
          onAction={controller.handleMedBayAction}
        />
      )}

      {run.screen === 'event' && (
        <CyberEventView
          run={run}
          lang={lang}
          modalOpen={paused || poolModalOpen || Boolean(codexTarget)}
          isCompactLandscape={viewport.isCompactLandscape}
          onChoice={controller.handleResolveEventChoice}
          onSwitchEvent={controller.handleSwitchEvent}
        />
      )}

      {(run.screen === 'combat' || run.screen === 'victory' || run.screen === 'gameover') &&
        combat && (
          <>
            <div className="relative flex flex-1 min-h-0 flex-col">
              {(combat.cradleObjective ||
                combat.battlefieldRule ||
                run.hero.bloodlineCrest ||
                run.hero.nannyBotInstalled ||
                run.hero.activeTempoRule) && (
                <div
                  data-testid="dynasty-combat-hud-banner"
                  className="pointer-events-none absolute top-2 left-1/2 z-10 flex -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 px-2"
                >
                  {combat.cradleObjective && (
                    <span
                      data-testid="bio-cradle-hud-pill"
                      className={`rounded-md border px-2 py-0.5 font-mono-tabular text-[10px] font-bold shadow-md backdrop-blur-sm ${
                        combat.cradleObjective.hp > 0
                          ? 'border-pink-300/65 bg-pink-950/75 text-pink-100'
                          : 'border-rose-400/65 bg-rose-950/75 text-rose-200'
                      }`}
                    >
                      🍼 {lang === 'cs' ? 'Bio-kolébka' : 'Bio-Cradle'}: {combat.cradleObjective.hp}
                      /{combat.cradleObjective.maxHp} HP
                    </span>
                  )}
                  {combat.battlefieldRule && (
                    <span
                      data-testid="battlefield-rule-hud-pill"
                      className="rounded-md border border-orange-300/60 bg-orange-950/75 px-2 py-0.5 font-mono-tabular text-[10px] font-bold text-orange-100 shadow-md backdrop-blur-sm"
                    >
                      ⚠ {combat.battlefieldRule.toUpperCase()}
                    </span>
                  )}
                  {run.hero.bloodlineCrest && (
                    <span className="rounded-md border border-amber-300/60 bg-amber-950/75 px-2 py-0.5 font-mono-tabular text-[10px] font-bold text-[#FFE066] shadow-md backdrop-blur-sm">
                      ⚜ {run.hero.bloodlineCrest.primary.toUpperCase()} ⚭{' '}
                      {run.hero.bloodlineCrest.secondary.toUpperCase()}
                      {combat.bloodlineResonanceActive
                        ? ` · +${run.hero.bloodlineCrest.bonusValue} + ⚡ (${combat.bloodlineResonanceActive.toUpperCase()})`
                        : ''}
                    </span>
                  )}
                  {run.hero.nannyBotInstalled && (
                    <span className="rounded-md border border-cyan-300/55 bg-cyan-950/75 px-2 py-0.5 font-mono-tabular text-[10px] font-bold text-cyan-100 shadow-md backdrop-blur-sm">
                      🤖{' '}
                      {run.hero.nannyBotInstalled === 'guardian_nanny'
                        ? lang === 'cs'
                          ? 'Strážný bot'
                          : 'Guardian Bot'
                        : run.hero.nannyBotInstalled === 'caretaker_nanny'
                          ? lang === 'cs'
                            ? 'Pečovatelský bot'
                            : 'Caretaker Bot'
                          : lang === 'cs'
                            ? 'Mentorský bot'
                            : 'Tutor Bot'}
                    </span>
                  )}
                  {run.hero.activeTempoRule && (
                    <span
                      data-testid="active-tempo-rule-hud-pill"
                      className="rounded-md border border-fuchsia-300/60 bg-fuchsia-950/75 px-2 py-0.5 font-mono-tabular text-[10px] font-bold text-fuchsia-100 shadow-md backdrop-blur-sm"
                    >
                      ⚡{' '}
                      {run.hero.activeTempoRule.id === 'algo_rave_surge'
                        ? lang === 'cs'
                          ? 'Algo-Rave (+2 dílky T1)'
                          : 'Algo-Rave (+2 T1 Draw)'
                        : run.hero.activeTempoRule.id === 'kids_vitality_boost'
                          ? lang === 'cs'
                            ? 'Vitalita (+4 Štít / +25 % OD)'
                            : 'Vitality (+4 Shd / +25% OD)'
                          : lang === 'cs'
                            ? 'Šířka pásma'
                            : 'Bandwidth Vow'}{' '}
                      ({run.hero.activeTempoRule.nodesRemaining})
                    </span>
                  )}
                </div>
              )}
              <CombatStageCanvas
                runId={run.runId}
                combat={combat}
                hero={run.hero}
                lang={lang}
                activePreview={controller.activePreview}
                paused={
                  paused ||
                  poolModalOpen ||
                  Boolean(codexTarget) ||
                  controller.postCombatOverlayReady
                }
                isCompactLandscape={viewport.isCompactLandscape}
                tacticalView={effectiveTacticalView}
                autoFocusCamera={a11yPrefs.autoFocusCamera}
                highContrastBorders={a11yPrefs.highContrastBorders}
                quantizedScaleMode={quantizedScaleMode}
                hoveringSwap={hoveringSwap}
                difficultyTier={controller.diffProfile.tier}
                devLabsEnabled={devLabsEnabled}
                initialDevLabTab={initialDevLabTab}
                onSwitchDevLabHero={handleSwitchDevLabHero}
                onUndoTurn={controller.handleUndoTurn}
                onOpenCodex={handleOpenCodex}
                onCueSequenceComplete={controller.handleCueSequenceComplete}
              />

              {run.screen === 'combat' &&
                combat.phase === 'VICTORY' &&
                controller.postCombatOverlayReady && (
                  <CombatLootOverlay
                    combat={combat}
                    hero={run.hero}
                    lang={lang}
                    objectivesSummary={controller.objectivesSummary}
                    onOpenPool={handleOpenPool}
                    onClaimReward={controller.handleClaimCombatReward}
                  />
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
              quantizedScaleMode={quantizedScaleMode}
              canSwapEnemies={canRepositionEnemies(combat, controller.swappedThisTurn)}
              activeHint={controller.activeHint}
              hintsAllowed={controller.diffProfile.hintsAllowed}
              onboardingPrompt={controller.onboardingPrompt}
              isCompactLandscape={viewport.isCompactLandscape}
              isNarrowPortrait={viewport.isNarrowPortrait}
              effectiveWidth={viewport.effectiveWidth}
              activeColor={controller.activeColor}
              selectedColor={controller.selectedColor}
              activePreview={controller.activePreview}
              countByColor={controller.countByColor}
              onHoverColor={controller.handleHoverColor}
              onSelectColor={controller.handleSelectColor}
              onCommitColor={controller.handleCommitColor}
              onOverdrive={controller.handleOverdrive}
              onSwapEnemies={controller.handleSwapEnemies}
              onHoverSwap={setHoveringSwap}
              onToggleHint={controller.handleToggleHint}
              onOpenCodex={handleOpenCodex}
            />
          </>
        )}

      {poolModalOpen && (
        <PoolModal
          run={run}
          lang={lang}
          onEquip={controller.handleEquipInstance}
          onUnequip={controller.handleUnequipInstance}
          onScrap={controller.handleScrapInstance}
          onOpenCodex={(tab, hero) => handleOpenCodex(tab, hero, null)}
          onClose={handleClosePool}
        />
      )}

      {paused && (
        <PauseModal
          lang={lang}
          onResume={handleResumePause}
          onOpenCodex={() => handleOpenCodex('heroes', run.hero.characterId ?? 'kira', null)}
          onRestart={() =>
            isDevLabRunId(run.runId)
              ? controller.handleStartDevLab(run.hero.characterId ?? 'kira')
              : controller.handleStartNewRun(run.hero.characterId ?? 'kira')
          }
          onTitle={handleReturnToTitleFromRun}
          settings={{
            tacticalView: effectiveTacticalView,
            semanticZoom: a11yPrefs.semanticZoom,
            autoFocusCamera: a11yPrefs.autoFocusCamera,
            quantizedScaleMode,
            hudMinimized,
            twoStepConfirm: a11yPrefs.twoStepConfirm,
            muted,
            showLandscapeToggle: viewport.canOfferLandscapeToggle,
            isLandscapeRotated: viewport.isLandscapeRotated,
            showFullscreenButton,
            isFullscreen: fullscreen.isFullscreen,
            devLabsEnabled,
            onToggleTacticalView: handleToggleTacticalView,
            onCycleSemanticZoom: handleCycleSemanticZoom,
            onToggleAutoFocusCamera: handleToggleAutoFocusCamera,
            onToggleQuantizedScale: handleToggleQuantizedScale,
            onToggleHudMinimized: handleToggleHudMinimized,
            onToggleTwoStepConfirm: handleToggleTwoStepConfirm,
            onToggleMute: handleToggleMute,
            onToggleLang: handleToggleLang,
            onToggleLandscape: viewport.toggleLandscapeLock,
            onToggleFullscreen: handleToggleFullscreen,
            onToggleDevLabs: handleToggleDevLabs,
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

      {(run.screen === 'victory' || run.screen === 'gameover') &&
        controller.postCombatOverlayReady && (
          <EndRunModal
            outcome={run.screen}
            characterId={run.hero.characterId ?? 'kira'}
            lang={lang}
            score={run.score}
            bestScore={controller.bestRecord.bestScore}
            turns={run.turnsCompleted}
            enemiesDefeated={run.enemiesDefeated}
            canRetryEncounter={Boolean(
              controller.encounterStartSnapshot &&
                (controller.diffProfile.failForwardAllowed || controller.hasResetBudget),
            )}
            failForwardAllowed={controller.diffProfile.failForwardAllowed}
            canSkipEncounter={controller.canSkipEncounter}
            onRetryClean={controller.hasResetBudget ? controller.handleResetEncounter : undefined}
            onFailForwardRetry={controller.handleFailForwardRetry}
            onSkipEncounter={controller.handleSkipEncounter}
            onPlayAgain={() => controller.handleStartNewRun(run.hero.characterId ?? 'kira')}
            onTitle={handleReturnToTitleFromRun}
          />
        )}
    </div>
  );
}
