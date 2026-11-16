import type { Language } from '../i18n/translations';
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
        label: 'Siphon Emergency Bio-Cell',
        description: 'Reroute emergency bio-cells to restore +8 HP and gain +10% Overdrive.',
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

interface CyberEventTextCopy {
  title: string;
  subtitle: string;
  story: string;
  choices: Record<string, { label: string; description: string }>;
}

const CYBER_EVENT_CS: Record<string, CyberEventTextCopy> = {
  rogue_ai_cache: {
    title: 'AI Jádro pod Klenbou',
    subtitle: 'Vyřazená sledovací subrutina',
    story:
      'Za prasklou přepážkou hučí blikající vojenský terminál. Jeho kvantová paměť ukrývá nešifrovanou firemní telemetrii a živé napájecí okruhy.',
    choices: {
      ai_overclock: {
        label: 'Přetaktovat neurální odběr',
        description: 'Obětuj 6 HP bio-popálením a získej datové kredity a bojový náboj.',
      },
      ai_siphon: {
        label: 'Odsát nouzový bio-článek',
        description: 'Přesměruj záložní bio-články pro obnovu +8 HP a zisk +10% Overdrive.',
      },
      ai_nanites: {
        label: 'Extrahovat nanitové paměťové jádro',
        description: 'Opatrně extrahuj +2 nanitová jádra pro trvalý postup.',
      },
    },
  },
  black_market_smuggler: {
    title: 'Pašerák z černého trhu',
    subtitle: 'Obchodník se zbraněmi ze stínové lávky',
    story:
      'Z parních průduchů vystupuje zahalený kurýr s upravenými bojovými stimulanty a prototypovým vybavením zachráněným z dolní klenby.',
    choices: {
      smuggler_booster: {
        label: 'Koupit experimentální posilovač (-25 CR)',
        description: 'Zaplať 25 kreditů za trvalé vyladění zbraní (+20% k poškození).',
      },
      smuggler_sell: {
        label: 'Prodat přebytečný šrot a munici',
        description: 'Vyměň nadbytečnou munici a telemetrii za +30 kreditů.',
      },
      smuggler_bypass: {
        label: 'Odmítnout a prohledat okolí',
        description: 'Zdvořile projdi kolem a posbírej spadlé součástky (+8 kreditů).',
      },
    },
  },
  derelict_combat_drone: {
    title: 'Vrak bojového drona',
    subtitle: 'Havarovaná jednotka Aegis Vanguard',
    story:
      'Neponičený bojový dron visí na přetržených magnetických kabelech nad propastí mostu a jeho plazmové jádro stále pulzuje zbytkovou energií.',
    choices: {
      drone_hotwire: {
        label: 'Zkratovat plazmové jádro',
        description: 'Okamžitě nabij svůj plazmový Overdrive na plných 100% kapacity.',
      },
      drone_repair: {
        label: 'Vytěžit nano-pancíř',
        description: 'Integruj nepoškozené pláty šasi drona a obnov si +20 HP.',
      },
      drone_components: {
        label: 'Rozebrat vzácné jádro',
        description: 'Extrahuj specializovaná nanitová jádra (+2 nanity) a +15 kreditů.',
      },
    },
  },
  tachyon_terminal: {
    title: 'Terminál kvantové anomálie',
    subtitle: 'Zkreslení tachyonové sítě',
    story:
      'Lokální kvantová porucha pokřivila senzorová pole mostu. Napojení na jádro umožňuje manipulovat s energií reality.',
    choices: {
      tachyon_extract: {
        label: 'Hloubková extrakce dat',
        description: 'Snášej 5 HP bio-traumatu a vytěž cenná data (+45 kreditů, +1 nanit).',
      },
      tachyon_recalibrate: {
        label: 'Kalibrace harmonického pulzu',
        description: 'Stabilizuj lokální pole pro opravu +14 HP a zisk +15 kreditů.',
      },
      tachyon_charge: {
        label: 'Pohltit energii pole',
        description: 'Usmerni záření do +10% bonusu k poškození a +30% Overdrive.',
      },
    },
  },
};

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
