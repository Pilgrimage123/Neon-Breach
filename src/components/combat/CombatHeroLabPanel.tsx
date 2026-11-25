import type { CharacterId } from '../../engine/types';
import type { HeroAnimMode } from '../../utils/heroAnimator';

export interface CombatHeroLabPanelProps {
  activeHeroId: CharacterId;
  lastTrigger: HeroAnimMode;
  onSwitchHero?: (charId: CharacterId) => void;
  onFireTrigger: (mode: HeroAnimMode) => void;
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
            {clip.label}
          </button>
        ))}
      </div>
    </div>
  );
}
