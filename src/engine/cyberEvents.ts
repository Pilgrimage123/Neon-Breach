import type { CyberEvent, HeroineState, MapNode } from './types';

export const CYBER_EVENT_TEMPLATES: CyberEvent[] = [
  {
    id: 'rogue_ai_cache',
    title: 'Sub-Canopy AI Core',
    subtitle: 'Decommissioned Surveillance Sub-Routine',
    story:
      'A flickering military terminal hums behind a shattered bulkhead. Its quantum storage contains unencrypted corporate telemetry and live power conduits.',
    choices: [
      {
        id: 'ai_overclock',
        label: 'Overclock Neural Tap',
        description: 'Take 6 HP bio-burn to siphon raw data credits and combat charge.',
        hpCost: 6,
        rewardCredits: 40,
        rewardOverdrive: 25,
      },
      {
        id: 'ai_siphon',
        label: 'Siphon Shield Capacitor',
        description: 'Reroute emergency capacitors for +14 Shield and system cleanse.',
        rewardHp: 8,
        rewardOverdrive: 10,
      },
      {
        id: 'ai_nanites',
        label: 'Extract Nanite Memory Core',
        description: 'Carefully extract +2 Nanite Cores for permanent meta-progression.',
        rewardNanites: 2,
        rewardCredits: 10,
      },
    ],
  },
  {
    id: 'black_market_smuggler',
    title: 'Black Market Smuggler',
    subtitle: 'Shadow Catwalk Arms Dealer',
    story:
      'A cloaked courier emerges from the steam vents with customized combat stims and prototype hardware salvaged from the lower canopy breach.',
    choices: [
      {
        id: 'smuggler_booster',
        label: 'Purchase Experimental Booster (-25 CR)',
        description: 'Pay 25 Credits to permanently tune weapons for +20% Damage Boost.',
        costCredits: 25,
        rewardDamageBoostPct: 20,
      },
      {
        id: 'smuggler_sell',
        label: 'Sell Surplus Scrap & Ordnance',
        description: 'Trade excess ammunition and scrap telemetry for +30 Credits.',
        rewardCredits: 30,
      },
      {
        id: 'smuggler_bypass',
        label: 'Decline & Scavenge Periphery',
        description: 'Politely pass by and scavenge dropped conduit components (+8 Credits).',
        rewardCredits: 8,
      },
    ],
  },
  {
    id: 'derelict_combat_drone',
    title: 'Derelict Combat Drone',
    subtitle: 'Crash-Landed Aegis Vanguard Unit',
    story:
      'An intact combat drone hangs suspended from severed magnetic cables above the bridge chasm, its plasma core still pulsing with residual energy.',
    choices: [
      {
        id: 'drone_hotwire',
        label: 'Hotwire Plasma Core',
        description: 'Immediately supercharge your Plasma Overdrive to 100% capacity.',
        rewardOverdrive: 100,
      },
      {
        id: 'drone_repair',
        label: 'Salvage Nano-Armor Plates',
        description: 'Integrate the drone’s undamaged chassis plates to restore +20 HP.',
        rewardHp: 20,
      },
      {
        id: 'drone_components',
        label: 'Strip Rare Core Components',
        description: 'Extract specialized Nanite Cores (+2 Nanites) and +15 Credits.',
        rewardNanites: 2,
        rewardCredits: 15,
      },
    ],
  },
  {
    id: 'tachyon_terminal',
    title: 'Quantum Anomaly Terminus',
    subtitle: 'Tachyon Grid Distortion',
    story:
      'A localized quantum disruption has warped the sky-bridge sensor arrays. Interfacing with the core allows spatial reality manipulation.',
    choices: [
      {
        id: 'tachyon_extract',
        label: 'Deep System Extraction',
        description: 'Endure 5 HP bio-trauma to extract high-value data (+45 Credits, +1 Nanite).',
        hpCost: 5,
        rewardCredits: 45,
        rewardNanites: 1,
      },
      {
        id: 'tachyon_recalibrate',
        label: 'Harmonic Pulse Calibration',
        description: 'Stabilize the local field to repair +14 HP and gain +15 Credits.',
        rewardHp: 14,
        rewardCredits: 15,
      },
      {
        id: 'tachyon_charge',
        label: 'Harness Field Energy',
        description: 'Channel warp radiation into a +10% Damage Boost and +30% Overdrive.',
        rewardDamageBoostPct: 10,
        rewardOverdrive: 30,
      },
    ],
  },
];

export function getCyberEventForNode(
  node: MapNode,
  seed: number,
  _heroine: HeroineState,
): CyberEvent {
  const hash = Math.abs(seed * 31 + node.layer * 13 + node.lane * 7);
  const template = CYBER_EVENT_TEMPLATES[hash % CYBER_EVENT_TEMPLATES.length];
  return {
    ...template,
    choices: template.choices.map((c) => ({ ...c })),
  };
}
