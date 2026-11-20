import { CODEX_TRANSLATIONS } from '../../i18n/codexTranslations';
import { TRANSLATIONS, type Language } from '../../i18n/translations';

export interface PauseSettingsProps {
  tacticalView: boolean;
  semanticZoom: 'overview' | 'standard' | 'closeup';
  autoFocusCamera: boolean;
  pipMathMode: boolean;
  hudMinimized: boolean;
  twoStepConfirm: boolean;
  muted: boolean;
  showLandscapeToggle?: boolean;
  isLandscapeRotated?: boolean;
  showFullscreenButton?: boolean;
  isFullscreen?: boolean;
  onToggleTacticalView: () => void;
  onCycleSemanticZoom: () => void;
  onToggleAutoFocusCamera: () => void;
  onTogglePipMath: () => void;
  onToggleHudMinimized: () => void;
  onToggleTwoStepConfirm: () => void;
  onToggleMute: () => void;
  onToggleLang: () => void;
  onToggleLandscape?: () => void;
  onToggleFullscreen?: () => void;
}

export interface PauseModalProps {
  lang: Language;
  onResume: () => void;
  onOpenCodex?: () => void;
  onRestart: () => void;
  onTitle: () => void;
  settings?: PauseSettingsProps;
}

export function PauseModal({
  lang,
  onResume,
  onOpenCodex,
  onRestart,
  onTitle,
  settings,
}: PauseModalProps) {
  const t = TRANSLATIONS[lang];
  const codexT = CODEX_TRANSLATIONS[lang];
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 sm:p-4 backdrop-blur-sm"
    >
      <div className="chrome-panel-bright max-h-[94dvh] w-full max-w-md overflow-y-auto rounded-2xl p-4 sm:p-6 text-center">
        <h2
          id="pause-modal-title"
          className="chrome-text-shimmer font-display text-xl sm:text-2xl font-bold"
        >
          {t.pauseTitle}
        </h2>
        <div className="mt-3.5 sm:mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={onResume}
            className="chrome-btn-primary w-full rounded-lg px-4 py-2.5 text-sm font-bold transition-all cursor-pointer"
          >
            {t.resume}
          </button>
          {onOpenCodex && (
            <button
              type="button"
              data-testid="pause-open-codex-btn"
              onClick={onOpenCodex}
              className="chrome-pill w-full rounded-lg border-amber-300/45 px-4 py-2 text-sm font-semibold text-[#FFC700] transition-colors hover:border-amber-200 hover:text-white cursor-pointer"
            >
              {codexT.inspectHeroDossierBtn}
            </button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onRestart}
              className="chrome-pill rounded-lg px-3 py-2 text-xs sm:text-sm font-semibold text-white transition-colors hover:border-rose-400 cursor-pointer"
            >
              {t.restart}
            </button>
            <button
              type="button"
              onClick={onTitle}
              className="chrome-pill rounded-lg px-3 py-2 text-xs sm:text-sm font-semibold text-slate-200 transition-colors hover:text-white cursor-pointer"
            >
              {t.returnTitle}
            </button>
          </div>
        </div>

        {settings && (
          <div className="mt-4 border-t border-white/15 pt-3 text-left">
            <div className="mb-2 text-[12px] font-bold uppercase tracking-wider text-cyan-300">
              {lang === 'cs' ? 'Zobrazení a ovládání' : 'Display & Controls'}
            </div>
            <div className="grid grid-cols-2 gap-1.5 font-mono-tabular text-[12.5px]">
              <button
                type="button"
                data-testid="tactical-view-toggle"
                onClick={settings.onToggleTacticalView}
                aria-pressed={settings.tacticalView}
                className={`chrome-pill rounded-lg px-2.5 py-1.5 text-left font-bold transition cursor-pointer ${
                  settings.tacticalView ? 'border-cyan-300 bg-cyan-500/20 text-white' : 'text-slate-200'
                }`}
              >
                ⌖ {lang === 'cs' ? 'Taktický pohled' : 'Tactical View'}: {settings.tacticalView ? (lang === 'cs' ? 'ZAP' : 'ON') : (lang === 'cs' ? 'VYP' : 'OFF')}
              </button>
              <button
                type="button"
                data-testid="semantic-zoom-toggle"
                onClick={settings.onCycleSemanticZoom}
                className="chrome-pill rounded-lg px-2.5 py-1.5 text-left font-bold text-cyan-200 transition cursor-pointer"
              >
                🔍 {lang === 'cs' ? 'Zoom' : 'Zoom'}: {settings.semanticZoom.toUpperCase()}
              </button>
              <button
                type="button"
                data-testid="autofocus-camera-toggle"
                onClick={settings.onToggleAutoFocusCamera}
                aria-pressed={settings.autoFocusCamera}
                className={`chrome-pill rounded-lg px-2.5 py-1.5 text-left font-bold transition cursor-pointer ${
                  settings.autoFocusCamera ? 'border-cyan-300 bg-cyan-500/20 text-white' : 'text-slate-200'
                }`}
              >
                🎥 {lang === 'cs' ? 'Auto-kamera' : 'Auto Cam'}: {settings.autoFocusCamera ? (lang === 'cs' ? 'ZAP' : 'ON') : (lang === 'cs' ? 'VYP' : 'OFF')}
              </button>
              <button
                type="button"
                data-testid="tactical-pip-math-toggle"
                onClick={settings.onTogglePipMath}
                aria-pressed={settings.pipMathMode}
                className={`chrome-pill rounded-lg px-2.5 py-1.5 text-left font-bold transition cursor-pointer ${
                  settings.pipMathMode ? 'border-[#FFC700] bg-amber-500/20 text-white' : 'text-slate-200'
                }`}
              >
                ⊞ {lang === 'cs' ? 'Přepočet 1P=5' : '1P=5 Math'}: {settings.pipMathMode ? (lang === 'cs' ? 'ZAP' : 'ON') : (lang === 'cs' ? 'VYP' : 'OFF')}
              </button>
              <button
                type="button"
                onClick={settings.onToggleHudMinimized}
                aria-pressed={settings.hudMinimized}
                className={`chrome-pill rounded-lg px-2.5 py-1.5 text-left font-bold transition cursor-pointer ${
                  settings.hudMinimized ? 'border-cyan-300 bg-cyan-500/20 text-white' : 'text-slate-200'
                }`}
              >
                {settings.hudMinimized ? '▼' : '▲'} {lang === 'cs' ? 'Kompaktní HUD' : 'Compact HUD'}: {settings.hudMinimized ? (lang === 'cs' ? 'ZAP' : 'ON') : (lang === 'cs' ? 'VYP' : 'OFF')}
              </button>
              <button
                type="button"
                onClick={settings.onToggleTwoStepConfirm}
                aria-pressed={settings.twoStepConfirm}
                className={`chrome-pill rounded-lg px-2.5 py-1.5 text-left font-bold transition cursor-pointer ${
                  settings.twoStepConfirm ? 'border-cyan-300 bg-cyan-500/20 text-white' : 'text-slate-200'
                }`}
              >
                ✓ {lang === 'cs' ? 'Dvoukrokové potvrzení' : '2-Step Confirm'}: {settings.twoStepConfirm ? (lang === 'cs' ? 'ZAP' : 'ON') : (lang === 'cs' ? 'VYP' : 'OFF')}
              </button>
              <button
                type="button"
                onClick={settings.onToggleLang}
                className="chrome-pill rounded-lg px-2.5 py-1.5 text-left font-bold text-cyan-200 transition cursor-pointer"
              >
                🌐 {lang === 'cs' ? 'Jazyk: CS' : 'Language: EN'}
              </button>
              <button
                type="button"
                onClick={settings.onToggleMute}
                aria-label={settings.muted ? t.unmute : t.mute}
                className="chrome-pill rounded-lg px-2.5 py-1.5 text-left font-bold text-slate-200 transition cursor-pointer"
              >
                {settings.muted ? '🔇' : '🔊'} {settings.muted ? t.unmute : t.mute}
              </button>
              {settings.showLandscapeToggle && settings.onToggleLandscape && (
                <button
                  type="button"
                  onClick={settings.onToggleLandscape}
                  className="chrome-pill rounded-lg px-2.5 py-1.5 text-left font-bold text-cyan-200 transition cursor-pointer"
                >
                  {settings.isLandscapeRotated ? `📱 ${t.portraitToggle}` : `🔄 ${t.landscapeToggle}`}
                </button>
              )}
              {settings.showFullscreenButton && settings.onToggleFullscreen && (
                <button
                  type="button"
                  onClick={settings.onToggleFullscreen}
                  className="chrome-pill rounded-lg px-2.5 py-1.5 text-left font-bold text-cyan-200 transition cursor-pointer"
                >
                  {settings.isFullscreen ? `🗗 ${t.fullscreenExit}` : `⛶ ${t.fullscreenEnter}`}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
