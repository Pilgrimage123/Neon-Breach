import { useEffect } from 'react';
import { soundEngine } from '../audio/soundEngine';
import type { CodexTab } from '../components/CodexModal';
import type { CharacterId, RunState, TileType } from '../engine/types';
import type { GlossaryTermId } from '../i18n/codexTranslations';

export interface UseGlobalHotkeysOptions {
  showTitle: boolean;
  paused: boolean;
  poolModalOpen: boolean;
  codexTarget: {
    tab: CodexTab;
    hero: CharacterId;
    termId: GlossaryTermId | null;
  } | null;
  run: RunState;
  savedRunSnapshot: RunState | null;
  selectedCharacter: CharacterId;
  postCombatOverlayReady: boolean;
  onToggleFullscreen: () => void;
  onOpenCodex: (tab?: CodexTab, hero?: CharacterId, termId?: GlossaryTermId | null) => void;
  onCloseCodex: () => void;
  onClosePool: () => void;
  onTogglePause: () => void;
  onSetAltHeldTactical: (held: boolean) => void;
  onToggleTacticalView: () => void;
  onCycleSemanticZoom: () => void;
  onToggleAutoFocusCamera: () => void;
  onToggleMute: () => void;
  onToggleLang: () => void;
  onToggleHudMinimized: () => void;
  onContinueRun: () => void;
  onStartNewRun: (charOverride?: CharacterId) => void;
  onClaimCombatReward: (defId: string | null) => void;
  onCommitColor: (color: TileType) => void;
  onSwapEnemies: () => void;
  onUndoTurn: () => void;
  onToggleHint: () => void;
  onOverdrive: () => void;
}

function isEditableOrInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
    return true;
  }
  return Boolean(target.closest('input, select, textarea, [contenteditable="true"]'));
}

function isInteractiveFocused(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (isEditableOrInputTarget(target) || Boolean(target.closest('button, a')))
  );
}

export function useGlobalHotkeys({
  showTitle,
  paused,
  poolModalOpen,
  codexTarget,
  run,
  savedRunSnapshot,
  selectedCharacter,
  postCombatOverlayReady,
  onToggleFullscreen,
  onOpenCodex,
  onCloseCodex,
  onClosePool,
  onTogglePause,
  onSetAltHeldTactical,
  onToggleTacticalView,
  onCycleSemanticZoom,
  onToggleAutoFocusCamera,
  onToggleMute,
  onToggleLang,
  onToggleHudMinimized,
  onContinueRun,
  onStartNewRun,
  onClaimCombatReward,
  onCommitColor,
  onSwapEnemies,
  onUndoTurn,
  onToggleHint,
  onOverdrive,
}: UseGlobalHotkeysOptions): void {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt' && !e.ctrlKey && !e.metaKey && !isEditableOrInputTarget(e.target)) {
        if (!showTitle) {
          e.preventDefault();
          onSetAltHeldTactical(true);
        }
        return;
      }

      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      const isEditable = isEditableOrInputTarget(e.target);

      if (e.key.toLowerCase() === 'f' && !isEditable) {
        e.preventDefault();
        soundEngine.playClick();
        onToggleFullscreen();
        return;
      }

      if (e.key.toLowerCase() === 'g' && !isEditable) {
        e.preventDefault();
        soundEngine.playClick();
        if (codexTarget) {
          onCloseCodex();
        } else {
          onOpenCodex(
            'heroes',
            showTitle ? selectedCharacter : (run.hero.characterId ?? 'kira'),
            null,
          );
        }
        return;
      }

      if (showTitle) {
        if (e.key === 'Escape' && codexTarget) {
          e.preventDefault();
          onCloseCodex();
          return;
        }
        if (codexTarget) {
          if (e.key.toLowerCase() === 'l' && !isEditable) {
            onToggleLang();
          }
          return;
        }
        if (
          (e.key === 'Enter' || e.key === ' ') &&
          !isInteractiveFocused(e.target) &&
          !document.querySelector('[data-title-overlay-open="true"]')
        ) {
          e.preventDefault();
          if (savedRunSnapshot) onContinueRun();
          else onStartNewRun();
          return;
        }
        if (e.key.toLowerCase() === 'l' && !isEditable) {
          onToggleLang();
          return;
        }
        return;
      }

      if ((e.key === 'Escape' || e.key.toLowerCase() === 'p') && !isEditable) {
        e.preventDefault();
        if (codexTarget) {
          onCloseCodex();
        } else if (poolModalOpen) {
          onClosePool();
        } else if (run.screen !== 'victory' && run.screen !== 'gameover') {
          onTogglePause();
        }
        return;
      }

      if (isEditable) {
        return;
      }

      if (e.key === 'Tab' && !paused && !poolModalOpen && !codexTarget) {
        e.preventDefault();
        onToggleTacticalView();
        return;
      }

      if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        onCycleSemanticZoom();
        return;
      }

      if (e.key.toLowerCase() === 'c' && run.screen === 'combat') {
        e.preventDefault();
        onToggleAutoFocusCamera();
        return;
      }

      if (e.key.toLowerCase() === 'm') {
        onToggleMute();
        return;
      }
      if (e.key.toLowerCase() === 'l') {
        onToggleLang();
        return;
      }
      if (e.key.toLowerCase() === 'h' && run.screen === 'combat') {
        onToggleHudMinimized();
        return;
      }

      if (paused || poolModalOpen || Boolean(codexTarget)) return;

      if (run.screen === 'combat') {
        if (run.combat?.phase === 'VICTORY' && postCombatOverlayReady) {
          const choices = run.combat.rewardChipChoices;
          if (e.key === '1' && choices[0]) {
            e.preventDefault();
            onClaimCombatReward(choices[0]);
            return;
          }
          if (e.key === '2' && choices[1]) {
            e.preventDefault();
            onClaimCombatReward(choices[1]);
            return;
          }
          if (e.key === '0' || (e.key === 'Enter' && !isInteractiveFocused(e.target))) {
            e.preventDefault();
            onClaimCombatReward(null);
            return;
          }
        }
        if (e.key === '1') {
          onCommitColor('attack');
        } else if (e.key === '2') {
          onCommitColor('defense');
        } else if (e.key === '3') {
          onCommitColor('tech');
        } else if (e.key.toLowerCase() === 'r') {
          e.preventDefault();
          onSwapEnemies();
        } else if (e.key.toLowerCase() === 'u') {
          e.preventDefault();
          onUndoTurn();
        } else if (e.key === '?' || e.key === '/') {
          e.preventDefault();
          onToggleHint();
        } else if (e.key === ' ' && !isInteractiveFocused(e.target)) {
          e.preventDefault();
          onOverdrive();
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        onSetAltHeldTactical(false);
      }
    };

    const onWindowBlur = () => {
      onSetAltHeldTactical(false);
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
    onClaimCombatReward,
    onCloseCodex,
    onClosePool,
    onCommitColor,
    onContinueRun,
    onCycleSemanticZoom,
    onOpenCodex,
    onOverdrive,
    onSetAltHeldTactical,
    onStartNewRun,
    onSwapEnemies,
    onToggleAutoFocusCamera,
    onToggleFullscreen,
    onToggleHint,
    onToggleHudMinimized,
    onToggleLang,
    onToggleMute,
    onTogglePause,
    onToggleTacticalView,
    onUndoTurn,
    paused,
    poolModalOpen,
    postCombatOverlayReady,
    run.combat,
    run.hero.characterId,
    run.screen,
    savedRunSnapshot,
    selectedCharacter,
    showTitle,
  ]);
}
