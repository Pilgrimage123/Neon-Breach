import type { CharacterId } from '../../engine/types';
import type { HeroAnimMode } from '../../utils/heroAnimator';
import {
  DEFAULT_KIRA_JUICE_CONFIG,
  type KiraJuiceConfig,
} from '../../utils/kiraJuiceController';

export interface CombatHeroLabPanelProps {
  activeHeroId: CharacterId;
  lastTrigger: HeroAnimMode;
  onSwitchHero?: (charId: CharacterId) => void;
  onFireTrigger: (mode: HeroAnimMode) => void;
  kiraJuiceConfig?: KiraJuiceConfig;
  onChangeKiraConfig?: (next: KiraJuiceConfig) => void;
}

const HERO_IDS: readonly { id: CharacterId; label: string }[] = [
  { id: 'kira', label: 'Kira' },
  { id: 'auraline', label: 'Auraline' },
  { id: 'zuri', label: 'Zuri' },
];

const HERO_CLIPS: readonly { mode: HeroAnimMode; keyHint?: string; label: string }[] = [
  { mode: 'idle', keyHint: '1', label: 'Idle' },
  { mode: 'idle1', keyHint: '2', label: 'Emote 1' },
  { mode: 'idle2', keyHint: '3', label: 'Emote 2' },
  { mode: 'shoot', keyHint: '4', label: 'Shoot' },
  { mode: 'dash_kick', keyHint: '5', label: 'Dash / Kick' },
  { mode: 'overdrive', keyHint: '6', label: 'Overdrive' },
  { mode: 'guard', keyHint: '7', label: 'Guard' },
  { mode: 'dodge', keyHint: '8', label: 'Dodge' },
  { mode: 'upgrade', keyHint: '9', label: 'Upgrade' },
  { mode: 'hit', keyHint: '0', label: 'Hit' },
  { mode: 'defeat', label: 'Defeat' },
  { mode: 'victory', label: 'Victory' },
];

export function CombatHeroLabPanel({
  activeHeroId,
  lastTrigger,
  onSwitchHero,
  onFireTrigger,
  kiraJuiceConfig,
  onChangeKiraConfig,
}: CombatHeroLabPanelProps) {
  return (
    <div
      data-testid="hero-lab-panel"
      className="fixed bottom-4 left-4 z-50 w-[330px] rounded-xl border border-cyan-400/40 bg-slate-950/92 p-3 text-xs text-slate-100 shadow-[0_12px_36px_rgba(0,0,0,0.7)] backdrop-blur-md"
    >
      <div className="mb-2 flex items-center justify-between border-b border-white/10 pb-1.5">
        <span className="font-extrabold tracking-wider text-cyan-300 uppercase">
          ★ Hero Animation Lab
        </span>
        <span className="text-[10px] text-slate-400">Keys 1–9, 0</span>
      </div>

      {onSwitchHero && (
        <div className="mb-2.5 flex items-center gap-1.5">
          {HERO_IDS.map((hero) => (
            <button
              key={hero.id}
              type="button"
              onClick={() => onSwitchHero(hero.id)}
              className={`flex-1 rounded px-2 py-1 text-[11px] font-bold uppercase cursor-pointer transition-colors ${
                activeHeroId === hero.id
                  ? 'bg-cyan-400 text-slate-950'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {hero.label}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-1.5">
        {HERO_CLIPS.map((clip) => (
          <button
            key={clip.mode}
            type="button"
            onClick={() => onFireTrigger(clip.mode)}
            className={`rounded px-2 py-1 text-left text-[11px] font-semibold cursor-pointer transition-colors ${
              lastTrigger === clip.mode
                ? 'bg-cyan-400/25 text-cyan-200 ring-1 ring-cyan-300'
                : 'bg-slate-900/90 text-slate-300 ring-1 ring-white/10 hover:bg-slate-800'
            }`}
          >
            {clip.keyHint ? `${clip.keyHint}. ` : ''}
            {activeHeroId === 'kira' && clip.mode === 'dash_kick' ? 'Surge Blast' : clip.label}
          </button>
        ))}
      </div>

      {activeHeroId === 'kira' && kiraJuiceConfig && onChangeKiraConfig && (
        <div className="mt-2.5 space-y-1.5 border-t border-white/10 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-wider text-cyan-300 uppercase">
              Tier A Rig Tuning
            </span>
            <button
              type="button"
              onClick={() => onChangeKiraConfig({ ...DEFAULT_KIRA_JUICE_CONFIG })}
              className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-700 cursor-pointer"
            >
              Reset
            </button>
          </div>
          {(
            [
              { key: 'springStiffness', label: 'Spring Stiffness', min: 140, max: 520, step: 10 },
              { key: 'springDamping', label: 'Spring Damping', min: 8, max: 36, step: 1 },
              { key: 'deformIntensity', label: 'Spine Deform', min: 0, max: 2, step: 0.1 },
              { key: 'maxVelocityShearPx', label: 'Dash Shear (px)', min: 0, max: 18, step: 0.5 },
              { key: 'flipHopHeightPx', label: 'Dodge Flip Hop', min: 0, max: 32, step: 1 },
              { key: 'flipDurationSec', label: 'Flip Dur (s)', min: 0.12, max: 0.45, step: 0.02 },
            ] as const
          ).map((slider) => (
            <label key={slider.key} className="flex items-center justify-between gap-2 text-[10px] text-slate-300">
              <span className="w-28 truncate">{slider.label}</span>
              <input
                type="range"
                min={slider.min}
                max={slider.max}
                step={slider.step}
                value={kiraJuiceConfig[slider.key]}
                onChange={(e) =>
                  onChangeKiraConfig({
                    ...kiraJuiceConfig,
                    [slider.key]: Number(e.target.value),
                  })
                }
                className="h-1 flex-1 accent-cyan-400 cursor-pointer"
              />
              <span className="w-9 text-right font-mono text-[10px] text-cyan-200">
                {kiraJuiceConfig[slider.key]}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
