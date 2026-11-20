import type { Language } from '../i18n/translations';
import type { CyberEvent, HeroineState, MapNode } from './types';

export const CYBER_EVENT_TEMPLATES: CyberEvent[] = [
  {
    id: 'rogue_ai_cache',
    title: 'Sub-Canopy AI Core',
    subtitle: 'Decommissioned Surveillance Sub-Routine',
    story: 'Abandoned military terminal with live conduits.',
    choices: [
      {
        id: 'ai_overclock',
        label: 'Overclock Neural Tap',
        description: '💔 -6 HP · 🪙 +40 CR · ⚡ +25% Overdrive',
        hpCost: 6,
        rewardCredits: 40,
        rewardOverdrive: 25,
      },
      {
        id: 'ai_siphon',
        label: 'Siphon Emergency Bio-Cell',
        description: '💚 +8 HP · ⚡ +10% Overdrive',
        rewardHp: 8,
        rewardOverdrive: 10,
      },
      {
        id: 'ai_nanites',
        label: 'Extract Nanite Memory Core',
        description: '💎 +2 Nanites · 🪙 +10 CR',
        rewardNanites: 2,
        rewardCredits: 10,
      },
    ],
  },
  {
    id: 'black_market_smuggler',
    title: 'Black Market Smuggler',
    subtitle: 'Shadow Catwalk Arms Dealer',
    story: 'Shadow courier offering Lower-Canopy military hardware.',
    choices: [
      {
        id: 'smuggler_booster',
        label: 'Purchase Combat Booster',
        description: '🪙 -25 CR · ⚔ +20% DMG boost',
        costCredits: 25,
        rewardDamageBoostPct: 20,
      },
      {
        id: 'smuggler_sell',
        label: 'Sell Surplus Telemetry',
        description: '🪙 +30 CR for scrap telemetry',
        rewardCredits: 30,
      },
      {
        id: 'smuggler_bypass',
        label: 'Scavenge Dropped Components',
        description: '🪙 +8 CR scavenged safely',
        rewardCredits: 8,
      },
    ],
  },
  {
    id: 'derelict_combat_drone',
    title: 'Derelict Combat Drone',
    subtitle: 'Suspended Vanguard Plasma Chassis',
    story: 'Intact combat drone suspended above chasm.',
    choices: [
      {
        id: 'drone_hotwire',
        label: 'Hotwire Plasma Core',
        description: '⚡ Fill Overdrive to 100%',
        rewardOverdrive: 100,
      },
      {
        id: 'drone_repair',
        label: 'Salvage Nano-Armor Plates',
        description: '💚 +20 HP chassis integration',
        rewardHp: 20,
      },
      {
        id: 'drone_components',
        label: 'Strip Rare Core Components',
        description: '💎 +2 Nanites · 🪙 +15 CR',
        rewardNanites: 2,
        rewardCredits: 15,
      },
    ],
  },
  {
    id: 'tachyon_terminal',
    title: 'Quantum Anomaly Terminus',
    subtitle: 'Tachyon Grid Distortion',
    story: 'Warped tachyon sensors pulsing spatial energy.',
    choices: [
      {
        id: 'tachyon_extract',
        label: 'Deep System Extraction',
        description: '💔 -5 HP · 🪙 +45 CR · 💎 +1 Nanite',
        hpCost: 5,
        rewardCredits: 45,
        rewardNanites: 1,
      },
      {
        id: 'tachyon_recalibrate',
        label: 'Harmonic Field Calibration',
        description: '💚 +14 HP · 🪙 +15 CR',
        rewardHp: 14,
        rewardCredits: 15,
      },
      {
        id: 'tachyon_charge',
        label: 'Harness Warp Energy',
        description: '⚔ +10% DMG · ⚡ +30% Overdrive',
        rewardDamageBoostPct: 10,
        rewardOverdrive: 30,
      },
    ],
  },
];

interface CyberEventTextCopy {
  title: string;
  subtitle: string;
  story: string;
  choices: Record<string, { label: string; description: string }>;
}

const CYBER_EVENT_CS: Record<string, CyberEventTextCopy> = {
  rogue_ai_cache: {
    title: 'AI jádro pod klenbou',
    subtitle: 'Vyřazená sledovací subrutina',
    story: 'Opuštěný vojenský terminál stále pod napětím.',
    choices: {
      ai_overclock: {
        label: 'Přetaktovat neurální odběr',
        description: '💔 -6 HP · 🪙 +40 CR · ⚡ +25% Overdrive',
      },
      ai_siphon: {
        label: 'Odsát záložní bio-článek',
        description: '💚 +8 HP · ⚡ +10% Overdrive',
      },
      ai_nanites: {
        label: 'Vytěžit paměťové jádro',
        description: '💎 +2 Nanity · 🪙 +10 CR',
      },
    },
  },
  black_market_smuggler: {
    title: 'Pašerák z černého trhu',
    subtitle: 'Překupník ze stínové lávky',
    story: 'Kurýr ze stínů nabízí nelegální moduly.',
    choices: {
      smuggler_booster: {
        label: 'Koupit bojový zesilovač',
        description: '🪙 -25 CR · ⚔ +20% DMG',
      },
      smuggler_sell: {
        label: 'Prodat přebytečnou telemetrii',
        description: '🪙 +30 CR za nepotřebná data',
      },
      smuggler_bypass: {
        label: 'Posbírat volné součástky',
        description: '🪙 +8 CR bezpečný sběr',
      },
    },
  },
  derelict_combat_drone: {
    title: 'Vrak bojového dronu',
    subtitle: 'Havarovaný Vanguard pod mostem',
    story: 'Zachovalý bojový dron zavěšený nad propastí.',
    choices: {
      drone_hotwire: {
        label: 'Zkratovat plazmové jádro',
        description: '⚡ Nabije Overdrive na 100%',
      },
      drone_repair: {
        label: 'Vytěžit nano-pancíř',
        description: '💚 +20 HP oprava šasi',
      },
      drone_components: {
        label: 'Rozebrat vzácné jádro',
        description: '💎 +2 Nanity · 🪙 +15 CR',
      },
    },
  },
  tachyon_terminal: {
    title: 'Terminál kvantové anomálie',
    subtitle: 'Zkreslení tachyonové sítě',
    story: 'Tachyonové senzory pulzují prostorovou energií.',
    choices: {
      tachyon_extract: {
        label: 'Hloubková extrakce dat',
        description: '💔 -5 HP · 🪙 +45 CR · 💎 +1 Nanit',
      },
      tachyon_recalibrate: {
        label: 'Kalibrace harmonického pole',
        description: '💚 +14 HP · 🪙 +15 CR',
      },
      tachyon_charge: {
        label: 'Pohltit energii pole',
        description: '⚔ +10% DMG · ⚡ +30% Overdrive',
      },
    },
  },
  matchmakers_gala: {
    title: 'Galavečer dohazovačů',
    subtitle: 'Ples kybernetických rodových aliancí',
    story: 'Ples, kde rodové dynastie uzavírají spojenectví.',
    choices: {
      gala_solaris_marriage: {
        label: 'Aliance: Rod Solaris',
        description: '⚔ +25% DMG · 🪙 +45 CR věno',
      },
      gala_valkyr_marriage: {
        label: 'Aliance: Rod Valkyr',
        description: '💚 +18 HP · 🎛 Kyber-implantát zdarma',
      },
      gala_toast: {
        label: 'Přípitek příštím generacím',
        description: '⚡ +35% Overdrive · 🪙 +20 CR',
      },
    },
  },
  mutual_aid_coop: {
    title: 'Družstvo vzájemné pomoci',
    subtitle: 'Sousedská burza otevřeného hardwaru',
    story: 'Komunitní inženýři sdílejí hardware a rytmy.',
    choices: {
      coop_bandwidth_vow: {
        label: 'Závazek šířky pásma',
        description: '🎛 Kyber-implantát zdarma · závazek 2 boje',
      },
      coop_algo_rave: {
        label: 'Rytmus Algo-Rave DJ',
        description: '⚡ +2 Nabití (3 uzly) · 🪙 +15 CR',
      },
      coop_donate_scrap: {
        label: 'Sdílet otevřená schémata',
        description: '🪙 +30 CR · 💚 +10 HP',
      },
    },
  },
  ectogenesis_nursery_gala: {
    title: 'Slavnost čapí kliniky',
    subtitle: 'Neonatální biotechnologické centrum',
    story: 'Oslava nové generace a rodového dědictví.',
    choices: {
      nursery_bless_heirloom: {
        label: 'Posvětit rodové dědictví',
        description: '👑 +2 stupně Dědictví · 💚 +12 HP',
      },
      nursery_vitality_feast: {
        label: 'Rodová hostina vitality',
        description: '💚 +24 HP · ⚡ +30% Overdrive (2 boje)',
      },
      nursery_grant: {
        label: 'Přijmout rodový grant',
        description: '🪙 +40 CR · 💎 +2 Nanity',
      },
    },
  },
};

export const DYNASTY_EVENT_TEMPLATES: CyberEvent[] = [
  {
    id: 'matchmakers_gala',
    title: 'Matchmaker’s Gala',
    subtitle: 'Cyber-Clan Alliance Ball',
    story: 'Sky-ball where cyber-dynasties form marital alliances.',
    choices: [
      {
        id: 'gala_solaris_marriage',
        label: 'Alliance: House Solaris',
        description: '⚔ +25% DMG · 🪙 +45 CR Dowry',
        rewardCredits: 45,
        rewardDamageBoostPct: 25,
        rewardScionHouse: 'house_solaris',
      },
      {
        id: 'gala_valkyr_marriage',
        label: 'Alliance: House Valkyr',
        description: '💚 +18 HP · 🎛 Free Cyber Implant',
        rewardHp: 18,
        rewardScionHouse: 'house_valkyr',
        rewardFreeImplant: true,
      },
      {
        id: 'gala_toast',
        label: 'Toast Lineage Future',
        description: '⚡ +35% Overdrive · 🪙 +20 CR',
        rewardOverdrive: 35,
        rewardCredits: 20,
      },
    ],
  },
  {
    id: 'mutual_aid_coop',
    title: 'Mutual Aid Co-op',
    subtitle: 'Homestead Open-Hardware Exchange',
    story: 'Community hackers sharing hardware and rave beats.',
    choices: [
      {
        id: 'coop_bandwidth_vow',
        label: 'Bandwidth Vow Pledge',
        description: '🎛 Free Cyber Implant · 2-combat vow',
        rewardFreeImplant: true,
        applyTempoRule: 'bandwidth_vow',
      },
      {
        id: 'coop_algo_rave',
        label: 'Algo-Rave Beat Sync',
        description: '⚡ +2 UpCharge (3 nodes) · 🪙 +15 CR',
        rewardCredits: 15,
        applyTempoRule: 'algo_rave_surge',
      },
      {
        id: 'coop_donate_scrap',
        label: 'Share Open Schematics',
        description: '🪙 +30 CR · 💚 +10 HP',
        rewardCredits: 30,
        rewardHp: 10,
      },
    ],
  },
  {
    id: 'ectogenesis_nursery_gala',
    title: 'Stork Nursery Jubilee',
    subtitle: 'Neonatal Biotech Pavilion',
    story: 'Biotech pavilion celebrating newborn cyber-prodigies.',
    choices: [
      {
        id: 'nursery_bless_heirloom',
        label: 'Consecrate Heirloom',
        description: '👑 +2 Heirloom Stacks · 💚 +12 HP',
        rewardHp: 12,
        rewardHeirloomStacks: 2,
      },
      {
        id: 'nursery_vitality_feast',
        label: 'Dynasty Vitality Feast',
        description: '💚 +24 HP · ⚡ +30% Overdrive (2 combats)',
        rewardHp: 24,
        rewardOverdrive: 30,
        applyTempoRule: 'kids_vitality_boost',
      },
      {
        id: 'nursery_grant',
        label: 'Claim Homestead Grant',
        description: '🪙 +40 CR · 💎 +2 Nanites',
        rewardCredits: 40,
        rewardNanites: 2,
      },
    ],
  },
];

export function localizeCyberEvent(event: CyberEvent, lang: Language = 'en'): CyberEvent {
  if (lang !== 'cs') {
    return {
      ...event,
      choices: event.choices.map((c) => ({ ...c })),
    };
  }
  const cs = CYBER_EVENT_CS[event.id];
  if (!cs) {
    return {
      ...event,
      choices: event.choices.map((c) => ({ ...c })),
    };
  }
  return {
    ...event,
    title: cs.title,
    subtitle: cs.subtitle,
    story: cs.story,
    choices: event.choices.map((c) => {
      const choiceCs = cs.choices[c.id];
      return choiceCs
        ? { ...c, label: choiceCs.label, description: choiceCs.description }
        : { ...c };
    }),
  };
}

export function getCyberEventForNode(
  node: MapNode,
  seed: number,
  _heroine: HeroineState,
  lang: Language = 'en',
): CyberEvent {
  const hash = Math.abs(seed * 31 + node.layer * 13 + node.lane * 7);
  const template = CYBER_EVENT_TEMPLATES[hash % CYBER_EVENT_TEMPLATES.length];
  return localizeCyberEvent(template, lang);
}

export function getDynastyEvents(lang: Language = 'en'): CyberEvent[] {
  return DYNASTY_EVENT_TEMPLATES.map((tpl) => localizeCyberEvent(tpl, lang));
}
