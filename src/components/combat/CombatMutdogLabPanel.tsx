import type { Dispatch, SetStateAction } from 'react';
import {
  DEFAULT_MUTDOG_JUICE_CONFIG,
  type MutdogJuiceConfig,
  type MutdogJuiceTrigger,
} from '../../utils/mutdogJuiceController';

export interface CombatMutdogLabPanelProps {
  mutdogJuiceConfig: MutdogJuiceConfig;
  setMutdogJuiceConfig: Dispatch<SetStateAction<MutdogJuiceConfig>>;
  lastMutdogTrigger: MutdogJuiceTrigger;
  onFireTrigger: (trig: MutdogJuiceTrigger) => void;
  onOpenSpitterLab: () => void;
  onOpenBruteLab: () => void;
  onOpenFeralNurseLab: () => void;
  onOpenCameraLab: () => void;
  onClose: () => void;
}

export function CombatMutdogLabPanel({
  mutdogJuiceConfig,
  setMutdogJuiceConfig,
  lastMutdogTrigger,
  onFireTrigger,
  onOpenSpitterLab,
  onOpenBruteLab,
  onOpenFeralNurseLab,
  onOpenCameraLab,
  onClose,
}: CombatMutdogLabPanelProps) {
  return (
    <div
      role="region"
      data-testid="mutdog-juice-lab-panel"
      aria-label="Rabid MutDog 4-Layer Procedural Juice Lab"
      onClick={(e) => e.stopPropagation()}
      className="aaa-charcoal-surface pointer-events-auto absolute left-2 bottom-2 z-30 w-[348px] max-w-[calc(100vw-16px)] max-h-[calc(100%-8px)] overflow-y-auto sm:w-[392px] rounded-xl border border-lime-400/65 bg-[#0B121E]/95 p-2.5 text-[10px] font-mono-tabular text-slate-100 shadow-2xl"
    >
      <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-white/10 pb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded bg-lime-400 text-[9px] font-black text-slate-950">
            ✦
          </span>
          <span className="font-display text-[11px] font-extrabold tracking-wider text-lime-300 uppercase truncate">
            MutDog Juice Lab
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1 shrink-0">
          <button
            type="button"
            data-testid="spitter-lab-tab-from-mutdog"
            onClick={onOpenSpitterLab}
            className="rounded border border-lime-400/40 bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-lime-300 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            ⬡ Spit
          </button>
          <button
            type="button"
            data-testid="brute-lab-tab-from-mutdog"
            onClick={onOpenBruteLab}
            className="rounded border border-amber-400/40 bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-amber-300 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            ■ Brute
          </button>
          <button
            type="button"
            data-testid="feral-nurse-lab-tab-from-mutdog"
            onClick={onOpenFeralNurseLab}
            className="rounded border border-fuchsia-400/40 bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-fuchsia-300 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            ✚ Nurse
          </button>
          <button
            type="button"
            data-testid="camera-lab-tab-from-mutdog"
            onClick={onOpenCameraLab}
            className="rounded border border-cyan-400/40 bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-cyan-200 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            ◎ Cam
          </button>
          <button
            type="button"
            data-testid="mutdog-lab-reset-btn"
            onClick={() => setMutdogJuiceConfig(DEFAULT_MUTDOG_JUICE_CONFIG)}
            className="rounded border border-white/15 bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-slate-300 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            Reset
          </button>
          <button
            type="button"
            data-testid="mutdog-lab-close-btn"
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
            { key: '1', id: 'idle', label: '1 · Idle + Snarl' },
            { key: '2', id: 'prowl_stalk', label: '2 · Prowl Stalk' },
            { key: '3', id: 'pounce_maul', label: '3 · Pounce Maul' },
            { key: '4', id: 'frenzy_howl', label: '4 · Frenzy Howl' },
            { key: '5', id: 'take_hit', label: '5 · Take Hit' },
            { key: '6', id: 'turn_around', label: '6 · 2.5D Flip' },
          ] as const
        ).map((btn) => {
          const active = lastMutdogTrigger === btn.id;
          return (
            <button
              key={btn.id}
              type="button"
              data-testid={`mutdog-trigger-${btn.key}`}
              onClick={() => onFireTrigger(btn.id)}
              className={`rounded px-1.5 py-1 text-left text-[9px] font-extrabold whitespace-nowrap transition-colors cursor-pointer ${
                active
                  ? 'bg-lime-400 text-slate-950 ring-1 ring-lime-200'
                  : 'bg-slate-900/90 text-lime-200 ring-1 ring-white/15 hover:bg-slate-800'
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
              min={100}
              max={480}
              step={10}
              value={mutdogJuiceConfig.springStiffness}
              onChange={(e) =>
                setMutdogJuiceConfig((c) => ({
                  ...c,
                  springStiffness: Number(e.target.value),
                }))
              }
              className="h-1 w-24 accent-lime-400"
            />
            <span className="w-8 text-right font-bold text-lime-300">
              {mutdogJuiceConfig.springStiffness}
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
              value={mutdogJuiceConfig.springDamping}
              onChange={(e) =>
                setMutdogJuiceConfig((c) => ({
                  ...c,
                  springDamping: Number(e.target.value),
                }))
              }
              className="h-1 w-24 accent-lime-400"
            />
            <span className="w-8 text-right font-bold text-lime-300">
              {mutdogJuiceConfig.springDamping}
            </span>
          </div>
        </label>

        <label className="flex items-center justify-between gap-2">
          <span className="text-slate-300">Prowl Cadence (rad/s)</span>
          <div className="flex items-center gap-1.5">
            <input
              type="range"
              min={6}
              max={24}
              step={0.5}
              value={mutdogJuiceConfig.prowlSpeed}
              onChange={(e) =>
                setMutdogJuiceConfig((c) => ({
                  ...c,
                  prowlSpeed: Number(e.target.value),
                }))
              }
              className="h-1 w-24 accent-lime-400"
            />
            <span className="w-8 text-right font-bold text-lime-300">
              {mutdogJuiceConfig.prowlSpeed.toFixed(1)}
            </span>
          </div>
        </label>

        <label className="flex items-center justify-between gap-2">
          <span className="text-slate-300">Velocity Skew Factor</span>
          <div className="flex items-center gap-1.5">
            <input
              type="range"
              min={0}
              max={0.1}
              step={0.004}
              value={mutdogJuiceConfig.velocitySkewFactor}
              onChange={(e) =>
                setMutdogJuiceConfig((c) => ({
                  ...c,
                  velocitySkewFactor: Number(e.target.value),
                }))
              }
              className="h-1 w-24 accent-lime-400"
            />
            <span className="w-8 text-right font-bold text-lime-300">
              {mutdogJuiceConfig.velocitySkewFactor.toFixed(3)}
            </span>
          </div>
        </label>

        <label className="flex items-center justify-between gap-2">
          <span className="text-slate-300">Feral VFX Impact</span>
          <div className="flex items-center gap-1.5">
            <input
              type="range"
              min={0.4}
              max={2.0}
              step={0.1}
              value={mutdogJuiceConfig.feralVfxStrength}
              onChange={(e) =>
                setMutdogJuiceConfig((c) => ({
                  ...c,
                  feralVfxStrength: Number(e.target.value),
                }))
              }
              className="h-1 w-24 accent-lime-400"
            />
            <span className="w-8 text-right font-bold text-lime-300">
              {mutdogJuiceConfig.feralVfxStrength.toFixed(1)}×
            </span>
          </div>
        </label>
      </div>
    </div>
  );
}
