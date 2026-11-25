import type { Dispatch, SetStateAction } from 'react';
import {
  DEFAULT_FERAL_NURSE_JUICE_CONFIG,
  type FeralNurseJuiceConfig,
  type FeralNurseJuiceTrigger,
} from '../../utils/feralNurseJuiceController';

export interface CombatFeralNurseLabPanelProps {
  feralNurseJuiceConfig: FeralNurseJuiceConfig;
  setFeralNurseJuiceConfig: Dispatch<SetStateAction<FeralNurseJuiceConfig>>;
  lastFeralNurseTrigger: FeralNurseJuiceTrigger;
  onFireTrigger: (trig: FeralNurseJuiceTrigger) => void;
  onOpenSpitterLab: () => void;
  onOpenBruteLab: () => void;
  onOpenMutdogLab: () => void;
  onOpenCameraLab: () => void;
  onClose: () => void;
}

export function CombatFeralNurseLabPanel({
  feralNurseJuiceConfig,
  setFeralNurseJuiceConfig,
  lastFeralNurseTrigger,
  onFireTrigger,
  onOpenSpitterLab,
  onOpenBruteLab,
  onOpenMutdogLab,
  onOpenCameraLab,
  onClose,
}: CombatFeralNurseLabPanelProps) {
  return (
    <div
      role="region"
      data-testid="feral-nurse-juice-lab-panel"
      aria-label="Feral Nurse 4-Layer Procedural Juice Lab"
      onClick={(e) => e.stopPropagation()}
      className="aaa-charcoal-surface pointer-events-auto absolute left-2 bottom-2 z-30 w-[356px] max-w-[calc(100vw-16px)] max-h-[calc(100%-8px)] overflow-y-auto sm:w-[404px] rounded-xl border border-fuchsia-400/65 bg-[#0B121E]/95 p-2.5 text-[10px] font-mono-tabular text-slate-100 shadow-2xl"
    >
      <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded bg-fuchsia-400 text-[9px] font-black text-slate-950">
            ✚
          </span>
          <span className="font-display text-[11px] font-extrabold tracking-wider text-fuchsia-300 uppercase whitespace-nowrap">
            Feral Nurse
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            data-testid="spitter-lab-tab-from-feral-nurse"
            onClick={onOpenSpitterLab}
            className="rounded border border-lime-400/40 bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-lime-300 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            ⬡ Spit
          </button>
          <button
            type="button"
            data-testid="brute-lab-tab-from-feral-nurse"
            onClick={onOpenBruteLab}
            className="rounded border border-amber-400/40 bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-amber-300 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            ■ Brute
          </button>
          <button
            type="button"
            data-testid="mutdog-lab-tab-from-feral-nurse"
            onClick={onOpenMutdogLab}
            className="rounded border border-lime-400/40 bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-lime-200 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            ✦ Dog
          </button>
          <button
            type="button"
            data-testid="camera-lab-tab-from-feral-nurse"
            onClick={onOpenCameraLab}
            className="rounded border border-cyan-400/40 bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-cyan-200 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            ◎ Cam
          </button>
          <button
            type="button"
            data-testid="feral-nurse-lab-reset-btn"
            onClick={() => setFeralNurseJuiceConfig(DEFAULT_FERAL_NURSE_JUICE_CONFIG)}
            className="rounded border border-white/15 bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-slate-300 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            Reset
          </button>
          <button
            type="button"
            data-testid="feral-nurse-lab-close-btn"
            onClick={onClose}
            className="rounded border border-white/15 bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-slate-300 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1">
        {(
          [
            { key: '1', id: 'idle', label: '1 · Idle + Hiss' },
            { key: '2', id: 'prowl_stalk', label: '2 · Prowl Stalk' },
            { key: '3', id: 'optical_cloak', label: '3 · Optical Cloak' },
            { key: '4', id: 'pierce_strike', label: '4 · Prepare + 7 Pierce' },
            { key: '5', id: 'take_hit', label: '5 · Take Hit' },
            { key: '6', id: 'turn_around', label: '6 · 2.5D Flip' },
          ] as const
        ).map((btn) => {
          const active = lastFeralNurseTrigger === btn.id;
          return (
            <button
              key={btn.id}
              type="button"
              data-testid={`feral-nurse-trigger-${btn.key}`}
              onClick={() => onFireTrigger(btn.id)}
              className={`rounded px-1.5 py-1 text-left text-[9px] font-extrabold whitespace-nowrap transition-colors cursor-pointer ${
                active
                  ? 'bg-fuchsia-400 text-slate-950 ring-1 ring-fuchsia-200'
                  : 'bg-slate-900/90 text-fuchsia-200 ring-1 ring-white/15 hover:bg-slate-800'
              }`}
            >
              {btn.label}
            </button>
          );
        })}
      </div>

      <div className="mt-2 space-y-1 border-t border-white/10 pt-1.5">
        <label className="flex items-center justify-between gap-2">
          <span className="text-slate-300">Spring Stiffness (k)</span>
          <div className="flex items-center gap-1.5">
            <input
              type="range"
              min={120}
              max={520}
              step={10}
              value={feralNurseJuiceConfig.springStiffness}
              onChange={(e) =>
                setFeralNurseJuiceConfig((c) => ({
                  ...c,
                  springStiffness: Number(e.target.value),
                }))
              }
              className="h-1 w-24 accent-fuchsia-400"
            />
            <span className="w-8 text-right font-bold text-fuchsia-300">
              {feralNurseJuiceConfig.springStiffness}
            </span>
          </div>
        </label>

        <label className="flex items-center justify-between gap-2">
          <span className="text-slate-300">Spring Damping (c)</span>
          <div className="flex items-center gap-1.5">
            <input
              type="range"
              min={8}
              max={36}
              step={1}
              value={feralNurseJuiceConfig.springDamping}
              onChange={(e) =>
                setFeralNurseJuiceConfig((c) => ({
                  ...c,
                  springDamping: Number(e.target.value),
                }))
              }
              className="h-1 w-24 accent-fuchsia-400"
            />
            <span className="w-8 text-right font-bold text-fuchsia-300">
              {feralNurseJuiceConfig.springDamping}
            </span>
          </div>
        </label>

        <label className="flex items-center justify-between gap-2">
          <span className="text-slate-300">Prowl Cadence (Hz)</span>
          <div className="flex items-center gap-1.5">
            <input
              type="range"
              min={0.6}
              max={3.0}
              step={0.05}
              value={feralNurseJuiceConfig.prowlFreqHz}
              onChange={(e) =>
                setFeralNurseJuiceConfig((c) => ({
                  ...c,
                  prowlFreqHz: Number(e.target.value),
                }))
              }
              className="h-1 w-24 accent-fuchsia-400"
            />
            <span className="w-8 text-right font-bold text-fuchsia-300">
              {feralNurseJuiceConfig.prowlFreqHz.toFixed(1)}
            </span>
          </div>
        </label>

        <label className="flex items-center justify-between gap-2">
          <span className="text-slate-300">Velocity Shear (px)</span>
          <div className="flex items-center gap-1.5">
            <input
              type="range"
              min={0}
              max={16}
              step={0.5}
              value={feralNurseJuiceConfig.maxVelocityShearPx}
              onChange={(e) =>
                setFeralNurseJuiceConfig((c) => ({
                  ...c,
                  maxVelocityShearPx: Number(e.target.value),
                }))
              }
              className="h-1 w-24 accent-fuchsia-400"
            />
            <span className="w-8 text-right font-bold text-fuchsia-300">
              {feralNurseJuiceConfig.maxVelocityShearPx.toFixed(1)}
            </span>
          </div>
        </label>

        <label className="flex items-center justify-between gap-2">
          <span className="text-slate-300">Spine Deform Amp</span>
          <div className="flex items-center gap-1.5">
            <input
              type="range"
              min={0.4}
              max={2.0}
              step={0.1}
              value={feralNurseJuiceConfig.deformIntensity}
              onChange={(e) =>
                setFeralNurseJuiceConfig((c) => ({
                  ...c,
                  deformIntensity: Number(e.target.value),
                }))
              }
              className="h-1 w-24 accent-fuchsia-400"
            />
            <span className="w-8 text-right font-bold text-fuchsia-300">
              {feralNurseJuiceConfig.deformIntensity.toFixed(1)}×
            </span>
          </div>
        </label>

        <label className="flex items-center justify-between gap-2">
          <span className="text-slate-300">Playback Speed</span>
          <div className="flex items-center gap-1.5">
            <input
              type="range"
              min={0.4}
              max={1.8}
              step={0.1}
              value={feralNurseJuiceConfig.speed}
              onChange={(e) =>
                setFeralNurseJuiceConfig((c) => ({
                  ...c,
                  speed: Number(e.target.value),
                }))
              }
              className="h-1 w-24 accent-fuchsia-400"
            />
            <span className="w-8 text-right font-bold text-fuchsia-300">
              {feralNurseJuiceConfig.speed.toFixed(1)}×
            </span>
          </div>
        </label>
      </div>
    </div>
  );
}
