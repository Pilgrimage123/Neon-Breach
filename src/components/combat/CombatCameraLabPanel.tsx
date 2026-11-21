import type { Dispatch, SetStateAction } from 'react';
import type { CombatPresentationConfig } from './combatPresentationConfig';
import type { CameraLabTriggerKind } from './combatDevLabsTypes';

export interface CombatCameraLabPanelProps {
  presentationConfig: CombatPresentationConfig;
  setPresentationConfig: Dispatch<SetStateAction<CombatPresentationConfig>>;
  lastCameraTrigger: CameraLabTriggerKind;
  onFireTrigger: (
    kind: 'melee_normal' | 'melee_crit' | 'ranged_single' | 'ranged_aoe' | 'kira_dodge',
  ) => void;
  onOpenSpitterLab: () => void;
  onOpenBruteLab: () => void;
  onReset: () => void;
  onClose: () => void;
}

export function CombatCameraLabPanel({
  presentationConfig,
  setPresentationConfig,
  lastCameraTrigger,
  onFireTrigger,
  onOpenSpitterLab,
  onOpenBruteLab,
  onReset,
  onClose,
}: CombatCameraLabPanelProps) {
  return (
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
            onClick={onOpenSpitterLab}
            className="rounded border border-lime-400/40 bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-lime-300 hover:text-white cursor-pointer"
          >
            ⬡ Spitter
          </button>
          <button
            type="button"
            data-testid="brute-lab-tab-from-cam"
            onClick={onOpenBruteLab}
            className="rounded border border-amber-400/40 bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-amber-300 hover:text-white cursor-pointer"
          >
            ■ Brute
          </button>
          <button
            type="button"
            data-testid="camera-lab-reset-btn"
            onClick={onReset}
            className="rounded border border-white/15 bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-slate-300 hover:text-white cursor-pointer"
          >
            Reset
          </button>
          <button
            type="button"
            data-testid="camera-lab-close-btn"
            onClick={onClose}
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
              onClick={() => onFireTrigger(btn.id)}
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
  );
}
