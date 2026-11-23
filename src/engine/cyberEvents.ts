import type { Language } from '../i18n/translations';
import type { CyberEvent, HeroState, MapNode } from './types';

export const CYBER_EVENT_TEMPLATES: CyberEvent[] = [
  {
    id: 'rogue_ai_cache',
    title: 'Dr. Lindqvist’s Broadcast Tower',
    subtitle: 'Over-the-Top Eco-Propaganda Beacon',
    story: 'Holo-tower blares Lindqvist’s speech about saving sacred ferns.',
    choices: [
      {
        id: 'ai_overclock',
        label: 'Smash & Scrap Chrome Amp',
        description: '💔 -6 HP · 🪙 +40 CR · ⚡ +25% Overdrive',
        hpCost: 6,
        rewardCredits: 40,
        rewardOverdrive: 25,
      },
      {
        id: 'ai_siphon',
        label: 'Siphon Solar Backup Cell',
        description: '💚 +8 HP · ⚡ +10% Overdrive',
        rewardHp: 8,
        rewardOverdrive: 10,
      },
      {
        id: 'ai_nanites',
        label: 'Pull Nanite Relay Core',
        description: '💎 +2 Nanites · 🪙 +10 CR',
        rewardNanites: 2,
        rewardCredits: 10,
      },
    ],
  },
  {
    id: 'black_market_smuggler',
    title: 'Uncle’s Rooftop Gadget Cart',
    subtitle: 'Sunlit Family Tinkerer & Snack Stand',
    story: 'Clan tinkerer wheels a sunlit cart of upgrades.',
    choices: [
      {
        id: 'smuggler_booster',
        label: 'Buy Turbo-Spicy Booster',
        description: '🪙 -25 CR · ⚔ +20% DMG boost',
        costCredits: 25,
        rewardDamageBoostPct: 20,
      },
      {
        id: 'smuggler_sell',
        label: 'Trade Mutant Telemetry',
        description: '🪙 +30 CR for workshop data',
        rewardCredits: 30,
      },
      {
        id: 'smuggler_bypass',
        label: 'Pocket Free Workshop Bolts',
        description: '🪙 +8 CR shared freely',
        rewardCredits: 8,
      },
    ],
  },
  {
    id: 'derelict_combat_drone',
    title: 'Grandpa’s Parked Mech-Walker',
    subtitle: 'Armored Family Helper Chassis',
    story: 'Grandpa’s chrome walker sits with a thermos strapped.',
    choices: [
      {
        id: 'drone_hotwire',
        label: 'Hotwire Solar Capacitor',
        description: '⚡ Fill Overdrive to 100%',
        rewardOverdrive: 100,
      },
      {
        id: 'drone_repair',
        label: 'Weld Spare Armor Plates',
        description: '💚 +20 HP chassis reinforcement',
        rewardHp: 20,
      },
      {
        id: 'drone_components',
        label: 'Strip Workshop Nanite Cells',
        description: '💎 +2 Nanites · 🪙 +15 CR',
        rewardNanites: 2,
        rewardCredits: 15,
      },
    ],
  },
  {
    id: 'tachyon_terminal',
    title: 'Sun-Prism Greenhouse Relay',
    subtitle: 'Dawn-Light Conduit in Overgrown Vines',
    story: 'Solar prism shines through Lindqvist’s glowing vines.',
    choices: [
      {
        id: 'tachyon_extract',
        label: 'Brave Thorns for Haul',
        description: '💔 -5 HP · 🪙 +45 CR · 💎 +1 Nanite',
        hpCost: 5,
        rewardCredits: 45,
        rewardNanites: 1,
      },
      {
        id: 'tachyon_recalibrate',
        label: 'Prune & Bask in Dawn',
        description: '💚 +14 HP · 🪙 +15 CR',
        rewardHp: 14,
        rewardCredits: 15,
      },
      {
        id: 'tachyon_charge',
        label: 'Focus Sun-Beam Into Gear',
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
    title: 'Vysílací věž Dr. Lindqvista',
    subtitle: 'Přehnaný eko-propagandistický maják',
    story: 'Holo-věž hlásá Lindqvistův proslov o záchraně kapradin.',
    choices: {
      ai_overclock: {
        label: 'Rozbít chromový zesilovač',
        description: '💔 -6 HP · 🪙 +40 CR · ⚡ +25% Overdrive',
      },
      ai_siphon: {
        label: 'Odsát solární článek',
        description: '💚 +8 HP · ⚡ +10% Overdrive',
      },
      ai_nanites: {
        label: 'Vytáhnout nanitové relé',
        description: '💎 +2 Nanity · 🪙 +10 CR',
      },
    },
  },
  black_market_smuggler: {
    title: 'Strejčkův vozík s udělátky',
    subtitle: 'Slunečný rodinný kutil a bufet',
    story: 'Veselý kutil přivezl solární vozík plný vychytávek.',
    choices: {
      smuggler_booster: {
        label: 'Koupit turbo-pikantní posilovač',
        description: '🪙 -25 CR · ⚔ +20% DMG',
      },
      smuggler_sell: {
        label: 'Vyměnit data o mutantech',
        description: '🪙 +30 CR za dílenskou telemetrii',
      },
      smuggler_bypass: {
        label: 'Nabrat dílenské šroubky',
        description: '🪙 +8 CR přátelská výpomoc',
      },
    },
  },
  derelict_combat_drone: {
    title: 'Dědečkovo mech-chodítko',
    subtitle: 'Obrněný rodinný pomocník',
    story: 'Dědečkův robot stojí na mostě s termoskou.',
    choices: {
      drone_hotwire: {
        label: 'Zkratovat solární kondenzátor',
        description: '⚡ Nabije Overdrive na 100%',
      },
      drone_repair: {
        label: 'Přivařit náhradní pláty',
        description: '💚 +20 HP posílení šasi',
      },
      drone_components: {
        label: 'Vybrat dílenské nanity',
        description: '💎 +2 Nanity · 🪙 +15 CR',
      },
    },
  },
  tachyon_terminal: {
    title: 'Sluneční skleníkový uzel',
    subtitle: 'Hranol úsvitu v bujných liánách',
    story: 'Solární hranol prosvítá skrz Lindqvistovy svítící liány.',
    choices: {
      tachyon_extract: {
        label: 'Prodírat se trním pro úlovek',
        description: '💔 -5 HP · 🪙 +45 CR · 💎 +1 Nanit',
      },
      tachyon_recalibrate: {
        label: 'Prostříhat liány a vydechnout',
        description: '💚 +14 HP · 🪙 +15 CR',
      },
      tachyon_charge: {
        label: 'Zaměřit paprsek do výzbroje',
        description: '⚔ +10% DMG · ⚡ +30% Overdrive',
      },
    },
  },
  matchmakers_gala: {
    title: 'Den šťastné manželky',
    subtitle: 'Farní slavnost rodin a manželství',
    story: 'Farní zvony zní mezi květy a hostinami.',
    choices: {
      gala_solaris_marriage: {
        label: 'Požehnání rodu Solaris',
        description: '⚔ +25% DMG · 🪙 +45 CR dar',
      },
      gala_valkyr_marriage: {
        label: 'Požehnání rodu Valkyr',
        description: '💚 +18 HP · 🎛 Taktický modul zdarma',
      },
      gala_toast: {
        label: 'Přípitek rodinnému stolu',
        description: '⚡ +35% Overdrive · 🪙 +20 CR',
      },
    },
  },
  mutual_aid_coop: {
    title: 'Třídenní den mužů',
    subtitle: 'Rotující cechovní směny a turnaje',
    story: 'Tři směny drží síť i pekárny v chodu.',
    choices: {
      coop_bandwidth_vow: {
        label: 'Cechovní závazek směny',
        description: '🎛 Taktický modul zdarma · 2 boje',
      },
      coop_algo_rave: {
        label: 'Rytmus dílenské směny',
        description: '⚡ +2 Nabití (3 uzly) · 🪙 +15 CR',
      },
      coop_donate_scrap: {
        label: 'Podělit se o nářadí',
        description: '🪙 +30 CR · 💚 +10 HP',
      },
    },
  },
  ectogenesis_nursery_gala: {
    title: 'Jaderný den a návrat domů',
    subtitle: 'Slavnost jádra, rodiny a obnovy',
    story: 'Čisté reaktory živí rodiny a obnovené usedlosti.',
    choices: {
      nursery_bless_heirloom: {
        label: 'Posvětit rodinnou památku',
        description: '👑 +2 stupně Dědictví · 💚 +12 HP',
      },
      nursery_vitality_feast: {
        label: 'Hostina návratu domů',
        description: '💚 +24 HP · ⚡ +30% Overdrive (2 boje)',
      },
      nursery_grant: {
        label: 'Podpora obnovy usedlosti',
        description: '🪙 +40 CR · 💎 +2 Nanity',
      },
    },
  },
};

export const DYNASTY_EVENT_TEMPLATES: CyberEvent[] = [
  {
    id: 'matchmakers_gala',
    title: 'Happy Wife Day Square',
    subtitle: 'Parish Feast of Matrimony & Home',
    story: 'Parish bells ring with flowers and family feasts.',
    choices: [
      {
        id: 'gala_solaris_marriage',
        label: 'Blessing: House Solaris',
        description: '⚔ +25% DMG · 🪙 +45 CR Gift',
        rewardCredits: 45,
        rewardDamageBoostPct: 25,
        rewardScionHouse: 'house_solaris',
      },
      {
        id: 'gala_valkyr_marriage',
        label: 'Blessing: House Valkyr',
        description: '💚 +18 HP · 🎛 Free Tactical Module',
        rewardHp: 18,
        rewardScionHouse: 'house_valkyr',
        rewardFreeImplant: true,
      },
      {
        id: 'gala_toast',
        label: 'Toast the Family Table',
        description: '⚡ +35% Overdrive · 🪙 +20 CR',
        rewardOverdrive: 35,
        rewardCredits: 20,
      },
    ],
  },
  {
    id: 'mutual_aid_coop',
    title: 'Three-Day Man Day Shift',
    subtitle: 'Rotating Guild Shifts & Tournaments',
    story: 'Three rotating shifts keep grid and bakeries humming.',
    choices: [
      {
        id: 'coop_bandwidth_vow',
        label: 'Guild Shift Pledge',
        description: '🎛 Free Tactical Module · 2-combat vow',
        rewardFreeImplant: true,
        applyTempoRule: 'bandwidth_vow',
      },
      {
        id: 'coop_algo_rave',
        label: 'Workshop Shift Cadence',
        description: '⚡ +2 UpCharge (3 nodes) · 🪙 +15 CR',
        rewardCredits: 15,
        applyTempoRule: 'algo_rave_surge',
      },
      {
        id: 'coop_donate_scrap',
        label: 'Share Guild Tools',
        description: '🪙 +30 CR · 💚 +10 HP',
        rewardCredits: 30,
        rewardHp: 10,
      },
    ],
  },
  {
    id: 'ectogenesis_nursery_gala',
    title: 'Nuclear & Homecoming Day',
    subtitle: 'Clean Reactors, Family & Remigration',
    story: 'Clean modular reactors power returning families and homesteads.',
    choices: [
      {
        id: 'nursery_bless_heirloom',
        label: 'Bless Family Heirloom',
        description: '👑 +2 Heirloom Stacks · 💚 +12 HP',
        rewardHp: 12,
        rewardHeirloomStacks: 2,
      },
      {
        id: 'nursery_vitality_feast',
        label: 'Homecoming Table Feast',
        description: '💚 +24 HP · ⚡ +30% Overdrive (2 combats)',
        rewardHp: 24,
        rewardOverdrive: 30,
        applyTempoRule: 'kids_vitality_boost',
      },
      {
        id: 'nursery_grant',
        label: 'Homestead Renewal Grant',
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

const ALL_EVENT_TEMPLATES: readonly CyberEvent[] = [
  ...CYBER_EVENT_TEMPLATES,
  ...DYNASTY_EVENT_TEMPLATES,
];

export function getCyberEventForNode(
  node: MapNode,
  seed: number,
  _hero: HeroState,
  lang: Language = 'en',
): CyberEvent {
  const badgeTemplate = node.districtBadge
    ? DYNASTY_EVENT_TEMPLATES.find((tpl) => tpl.id === node.districtBadge)
    : undefined;
  const hash = Math.abs(seed * 31 + node.layer * 13 + node.lane * 7);
  const template = badgeTemplate ?? ALL_EVENT_TEMPLATES[hash % ALL_EVENT_TEMPLATES.length];
  return localizeCyberEvent(template, lang);
}
