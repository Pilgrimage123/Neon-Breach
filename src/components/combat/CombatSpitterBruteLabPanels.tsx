import type { Dispatch, SetStateAction } from 'react';
import {
  DEFAULT_SPITTER_JUICE_CONFIG,
  type SpitterJuiceConfig,
  type SpitterJuiceTrigger,
} from '../../utils/spitterJuiceController';
import {
  type BruteJuiceConfig,
  type BruteJuiceTrigger,
  DEFAULT_BRUTE_JUICE_CONFIG,
} from '../../utils/bruteJuiceController';

export interface CombatSpitterLabPanelProps {
  spitterJuiceConfig: SpitterJuiceConfig;
  setSpitterJuiceConfig: Dispatch<SetStateAction<SpitterJuiceConfig>>;
  lastSpitterTrigger: SpitterJuiceTrigger;
  onFireTrigger: (trig: SpitterJuiceTrigger) => void;
  onOpenBruteLab: () => void;
  onOpenMutdogLab: () => void;
  onOpenFeralNurseLab: () => void;
  onOpenCameraLab: () => void;
  onClose: () => void;
}

export function CombatSpitterLabPanel({
  spitterJuiceConfig,
  setSpitterJuiceConfig,
  lastSpitterTrigger,
  onFireTrigger,
  onOpenBruteLab,
  onOpenMutdogLab,
  onOpenFeralNurseLab,
  onOpenCameraLab,
  onClose,
}: CombatSpitterLabPanelProps) {
  return (
    <div
      role="region"
      data-testid="spitter-juice-lab-panel"
      aria-label="Bile Spitter 4-Layer Procedural Juice Lab"
      onClick={(e) => e.stopPropagation()}
      className="aaa-charcoal-surface pointer-events-auto absolute left-2 bottom-2 z-30 w-[332px] max-w-[calc(100vw-16px)] max-h-[calc(100%-8px)] overflow-y-auto sm:w-[376px] rounded-xl border border-lime-400/65 bg-[#0B121E]/95 p-2.5 text-[10px] font-mono-tabular text-slate-100 shadow-2xl"
    >
      <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-white/10 pb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-lime-400 text-[9px] font-black text-slate-950">
            ⬡
          </span>
          <span className="font-display text-[11px] font-extrabold tracking-wider text-lime-300 uppercase">
            Bile Spitter Juice Lab
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            data-testid="brute-lab-tab"
            onClick={onOpenBruteLab}
            className="rounded border border-amber-400/40 bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-amber-300 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            ■ Brute
          </button>
          <button
            type="button"
            data-testid="mutdog-lab-tab-from-spitter"
            onClick={onOpenMutdogLab}
            className="rounded border border-lime-400/40 bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-lime-300 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            ✦ Dog
          </button>
          <button
            type="button"
            data-testid="feral-nurse-lab-tab-from-spitter"
            onClick={onOpenFeralNurseLab}
            className="rounded border border-fuchsia-400/40 bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-fuchsia-300 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            ✚ Nurse
          </button>
          <button
            type="button"
            data-testid="camera-lab-tab"
            onClick={onOpenCameraLab}
            className="rounded border border-cyan-400/40 bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-cyan-200 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            ◎ Cam
          </button>
          <button
            type="button"
            data-testid="spitter-lab-reset-btn"
            onClick={() => setSpitterJuiceConfig(DEFAULT_SPITTER_JUICE_CONFIG)}
            className="rounded border border-white/15 bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-slate-300 hover:text-white cursor-pointer"
          >
            Reset
          </button>
          <button
            type="button"
            data-testid="spitter-lab-close-btn"
            onClick={onClose}
            className="rounded border border-white/15 bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-slate-300 hover:text-white cursor-pointer"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1">
        {(
          [
            { key: '1', id: 'idle', label: '1 · Idle + Blink' },
            { key: '2', id: 'advance_retreat', label: '2 · Walk Waddle' },
            { key: '3', id: 'attack_lunge', label: '3 · Attack Lunge' },
            { key: '4', id: 'cast_charge', label: '4 · Cast / UV Boil' },
            { key: '5', id: 'take_hit', label: '5 · Take Hit' },
            { key: '6', id: 'turn_around', label: '6 · 2.5D Flip' },
          ] as const
        ).map((btn) => {
          const active = lastSpitterTrigger === btn.id;
          return (
            <button
              key={btn.id}
              type="button"
              data-testid={`spitter-trigger-${btn.key}`}
              onClick={() => onFireTrigger(btn.id)}
              className={`rounded px-1.5 py-1 text-left text-[9px] font-extrabold transition-colors cursor-pointer ${
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
              min={80}
              max={480}
              step={10}
              value={spitterJuiceConfig.springStiffness}
              onChange={(e) =>
                setSpitterJuiceConfig((c) => ({
                  ...c,
                  springStiffness: Number(e.target.value),
                }))
              }
              className="h-1 w-24 accent-lime-400"
            />
            <span className="w-8 text-right font-bold text-lime-300">
              {spitterJuiceConfig.springStiffness}
            </span>
          </div>
        </label>

        <label className="flex items-center justify-between gap-2">
          <span className="text-slate-300">Spring Damping (c)</span>
          <div className="flex items-center gap-1.5">
            <input
              type="range"
              min={6}
              max={36}
              step={1}
              value={spitterJuiceConfig.springDamping}
              onChange={(e) =>
                setSpitterJuiceConfig((c) => ({
                  ...c,
                  springDamping: Number(e.target.value),
                }))
              }
              className="h-1 w-24 accent-lime-400"
            />
            <span className="w-8 text-right font-bold text-lime-300">
              {spitterJuiceConfig.springDamping}
            </span>
          </div>
        </label>

        <label className="flex items-center justify-between gap-2">
          <span className="text-slate-300">Waddle Speed (rad/s)</span>
          <div className="flex items-center gap-1.5">
            <input
              type="range"
              min={6}
              max={28}
              step={1}
              value={spitterJuiceConfig.waddleSpeed}
              onChange={(e) =>
                setSpitterJuiceConfig((c) => ({
                  ...c,
                  waddleSpeed: Number(e.target.value),
                }))
              }
              className="h-1 w-24 accent-lime-400"
            />
            <span className="w-8 text-right font-bold text-lime-300">
              {spitterJuiceConfig.waddleSpeed}
            </span>
          </div>
        </label>

        <label className="flex items-center justify-between gap-2">
          <span className="text-slate-300">Velocity Skew Factor</span>
          <div className="flex items-center gap-1.5">
            <input
              type="range"
              min={0}
              max={0.12}
              step={0.004}
              value={spitterJuiceConfig.velocitySkewFactor}
              onChange={(e) =>
                setSpitterJuiceConfig((c) => ({
                  ...c,
                  velocitySkewFactor: Number(e.target.value),
                }))
              }
              className="h-1 w-24 accent-lime-400"
            />
            <span className="w-8 text-right font-bold text-lime-300">
              {spitterJuiceConfig.velocitySkewFactor.toFixed(3)}
            </span>
          </div>
        </label>

        <label className="flex items-center justify-between gap-2">
          <span className="text-slate-300">UV Acid Distortion</span>
          <div className="flex items-center gap-1.5">
            <input
              type="range"
              min={0}
              max={2.5}
              step={0.1}
              value={spitterJuiceConfig.uvDistortStrength}
              onChange={(e) =>
                setSpitterJuiceConfig((c) => ({
                  ...c,
                  uvDistortStrength: Number(e.target.value),
                }))
              }
              className="h-1 w-24 accent-lime-400"
            />
            <span className="w-8 text-right font-bold text-lime-300">
              {spitterJuiceConfig.uvDistortStrength.toFixed(1)}×
            </span>
          </div>
        </label>
      </div>
    </div>
  );
}

export interface CombatBruteLabPanelProps {
  bruteJuiceConfig: BruteJuiceConfig;
  setBruteJuiceConfig: Dispatch<SetStateAction<BruteJuiceConfig>>;
  lastBruteTrigger: BruteJuiceTrigger;
  onFireTrigger: (trig: BruteJuiceTrigger) => void;
  onOpenSpitterLab: () => void;
  onOpenMutdogLab: () => void;
  onOpenFeralNurseLab: () => void;
  onOpenCameraLab: () => void;
  onClose: () => void;
}

export function CombatBruteLabPanel({
  bruteJuiceConfig,
  setBruteJuiceConfig,
  lastBruteTrigger,
  onFireTrigger,
  onOpenSpitterLab,
  onOpenMutdogLab,
  onOpenFeralNurseLab,
  onOpenCameraLab,
  onClose,
}: CombatBruteLabPanelProps) {
  return (
    <div
      role="region"
      data-testid="brute-juice-lab-panel"
      aria-label="Carapace Brute 4-Layer Procedural Juice Lab"
      onClick={(e) => e.stopPropagation()}
      className="aaa-charcoal-surface pointer-events-auto absolute left-2 bottom-2 z-30 w-[332px] max-w-[calc(100vw-16px)] max-h-[calc(100%-8px)] overflow-y-auto sm:w-[376px] rounded-xl border border-amber-400/65 bg-[#0B121E]/95 p-2.5 text-[10px] font-mono-tabular text-slate-100 shadow-2xl"
    >
      <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-white/10 pb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-amber-400 text-[9px] font-black text-slate-950">
            ■
          </span>
          <span className="font-display text-[11px] font-extrabold tracking-wider text-amber-300 uppercase">
            Carapace Brute Juice Lab
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            data-testid="spitter-lab-tab"
            onClick={onOpenSpitterLab}
            className="rounded border border-lime-400/40 bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-lime-300 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            ⬡ Spit
          </button>
          <button
            type="button"
            data-testid="mutdog-lab-tab-from-brute"
            onClick={onOpenMutdogLab}
            className="rounded border border-lime-400/40 bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-lime-300 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            ✦ Dog
          </button>
          <button
            type="button"
            data-testid="feral-nurse-lab-tab-from-brute"
            onClick={onOpenFeralNurseLab}
            className="rounded border border-fuchsia-400/40 bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-fuchsia-300 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            ✚ Nurse
          </button>
          <button
            type="button"
            data-testid="camera-lab-tab-from-brute"
            onClick={onOpenCameraLab}
            className="rounded border border-cyan-400/40 bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-cyan-200 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            ◎ Cam
          </button>
          <button
            type="button"
            data-testid="brute-lab-reset-btn"
            onClick={() => setBruteJuiceConfig(DEFAULT_BRUTE_JUICE_CONFIG)}
            className="rounded border border-white/15 bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-slate-300 hover:text-white cursor-pointer"
          >
            Reset
          </button>
          <button
            type="button"
            data-testid="brute-lab-close-btn"
            onClick={onClose}
            className="rounded border border-white/15 bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-slate-300 hover:text-white cursor-pointer"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1">
        {(
          [
            { key: '1', id: 'idle', label: '1 · Idle + Snarl' },
            { key: '2', id: 'stomp_walk', label: '2 · Stomp Walk' },
            { key: '3', id: 'seismic_smash', label: '3 · Seismic Smash' },
            { key: '4', id: 'mutagen_brace', label: '4 · Mutagen Brace' },
            { key: '5', id: 'take_hit', label: '5 · Take Hit' },
            { key: '6', id: 'turn_around', label: '6 · 2.5D Flip' },
          ] as const
        ).map((btn) => {
          const active = lastBruteTrigger === btn.id;
          return (
            <button
              key={btn.id}
              type="button"
              data-testid={`brute-trigger-${btn.key}`}
              onClick={() => onFireTrigger(btn.id)}
              className={`rounded px-1.5 py-1 text-left text-[9px] font-extrabold transition-colors cursor-pointer ${
                active
                  ? 'bg-amber-400 text-slate-950 ring-1 ring-amber-200'
                  : 'bg-slate-900/90 text-amber-200 ring-1 ring-white/15 hover:bg-slate-800'
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
              value={bruteJuiceConfig.springStiffness}
              onChange={(e) =>
                setBruteJuiceConfig((c) => ({
                  ...c,
                  springStiffness: Number(e.target.value),
                }))
              }
              className="h-1 w-24 accent-amber-400"
            />
            <span className="w-8 text-right font-bold text-amber-300">
              {bruteJuiceConfig.springStiffness}
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
              value={bruteJuiceConfig.springDamping}
              onChange={(e) =>
                setBruteJuiceConfig((c) => ({
                  ...c,
                  springDamping: Number(e.target.value),
                }))
              }
              className="h-1 w-24 accent-amber-400"
            />
            <span className="w-8 text-right font-bold text-amber-300">
              {bruteJuiceConfig.springDamping}
            </span>
          </div>
        </label>

        <label className="flex items-center justify-between gap-2">
          <span className="text-slate-300">Stomp Cadence (rad/s)</span>
          <div className="flex items-center gap-1.5">
            <input
              type="range"
              min={5}
              max={22}
              step={0.5}
              value={bruteJuiceConfig.stompSpeed}
              onChange={(e) =>
                setBruteJuiceConfig((c) => ({
                  ...c,
                  stompSpeed: Number(e.target.value),
                }))
              }
              className="h-1 w-24 accent-amber-400"
            />
            <span className="w-8 text-right font-bold text-amber-300">
              {bruteJuiceConfig.stompSpeed.toFixed(1)}
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
              value={bruteJuiceConfig.velocitySkewFactor}
              onChange={(e) =>
                setBruteJuiceConfig((c) => ({
                  ...c,
                  velocitySkewFactor: Number(e.target.value),
                }))
              }
              className="h-1 w-24 accent-amber-400"
            />
            <span className="w-8 text-right font-bold text-amber-300">
              {bruteJuiceConfig.velocitySkewFactor.toFixed(3)}
            </span>
          </div>
        </label>

        <label className="flex items-center justify-between gap-2">
          <span className="text-slate-300">Seismic VFX Impact</span>
          <div className="flex items-center gap-1.5">
            <input
              type="range"
              min={0.4}
              max={2.0}
              step={0.1}
              value={bruteJuiceConfig.seismicImpactStrength}
              onChange={(e) =>
                setBruteJuiceConfig((c) => ({
                  ...c,
                  seismicImpactStrength: Number(e.target.value),
                }))
              }
              className="h-1 w-24 accent-amber-400"
            />
            <span className="w-8 text-right font-bold text-amber-300">
              {bruteJuiceConfig.seismicImpactStrength.toFixed(1)}×
            </span>
          </div>
        </label>
      </div>
    </div>
  );
}
