import type { Language } from '../i18n/translations';
import { ENEMY_TEMPLATES } from './data';
import { computeSmartScaledEnemyHp, getDifficultyProfile } from './difficulty';
import type {
  DifficultyTier,
  EnemyArchetype,
  EnemyIntent,
  EnemyPassiveKind,
  HeroState,
  MapNode,
  NodeEconomyMetrics,
} from './types';

export interface NodeEncounterIntel {
  sectorCode: string;
  enemies: Array<{ archetype: EnemyArchetype; hp: number; armor: number }>;
  totalEnemyHp: number;
  totalEnemyArmor: number;
  enemyPassives?: EnemyPassiveKind[];
  threatTraits?: string[];
}

export type ReconNodePreview =
  | { kind: 'event'; eventTitle: string; choices: string[] }
  | { kind: 'clinic'; isFlashSale: boolean; openSockets: number }
  | { kind: 'chip_dealer'; isFlashSale: boolean; freeMemory: number }
  | { kind: 'medbay'; healTotal: number; isFunded: boolean }
  | {
      kind: 'combat';
      enemies: Array<{
        archetype: EnemyArchetype;
        hp: number;
        armor: number;
        firstIntent: EnemyIntent;
      }>;
    };

export type RouteAdviceReason =
  | 'low_hp_medbay'
  | 'elite_power_spike'
  | 'clinic_socket'
  | 'boss_engage'
  | 'combat_momentum';

export interface TacticalRouteAdvice {
  recommendedNodeId: string | null;
  reasonKey: RouteAdviceReason;
}

export interface BossTelegraphGimmick {
  id: string;
  title: string;
  description: string;
  badge: string;
}

export interface BossTelegraphIntel {
  name: string;
  classification: string;
  hp: number;
  gimmicks: BossTelegraphGimmick[];
  recommendedPrep: string;
}

export const STAGE_BOSS_TELEGRAPH: BossTelegraphIntel = {
  name: 'Xenomorph Matriarch',
  classification: 'Xenomorph Matriarch · Stage 12 Finale',
  hp: ENEMY_TEMPLATES.boss.maxHp,
  gimmicks: [
    {
      id: 'phase_lock',
      title: '50% Phase Gate',
      description: 'Locks HP once at 50% to deploy +10 Armor & +1 Aegis Pip',
      badge: 'PHASE GATE',
    },
    {
      id: 'acid_jam',
      title: 'Corrosive Tile Jam & Slag',
      description: 'Unblocked acid jams a Tile and injects Caustic Slag',
      badge: 'TILE JAM',
    },
    {
      id: 'swarm_call',
      title: 'Bio-Husk Resurrection & Swarm',
      description: 'Reanimates fallen allies as Bio-Husks while summoning waves',
      badge: 'SWARM CALL',
    },
  ],
  recommendedPrep: 'Prep: TECH Pierce, Armor Shred & Shields',
};

export function getBossTelegraphIntel(
  lang: Language = 'en',
  difficultyTier: DifficultyTier = 3,
): BossTelegraphIntel {
  const bossHp = computeSmartScaledEnemyHp(
    'boss',
    ENEMY_TEMPLATES.boss.maxHp,
    0,
    difficultyTier,
  );
  if (lang !== 'cs') {
    if (difficultyTier === 3) return STAGE_BOSS_TELEGRAPH;
    return {
      ...STAGE_BOSS_TELEGRAPH,
      hp: bossHp,
    };
  }
  return {
    name: 'Xenomorfní Matriarcha',
    classification: 'Xenomorfní Matriarcha · Finále úseku 12',
    hp: bossHp,
    gimmicks: [
      {
        id: 'phase_lock',
        title: '50% Fázová brána',
        description: 'Při poklesu pod 50 % uzamkne HP a přidá +10 Brnění a +1 Aegis Pip',
        badge: 'FÁZOVÁ BRÁNA',
      },
      {
        id: 'acid_jam',
        title: 'Korozivní blokace a struska',
        description: 'Kyselina při zásahu do HP zablokuje dílek a přidá Žíravou strusku',
        badge: 'BLOKACE',
      },
      {
        id: 'swarm_call',
        title: 'Bio-schránky a posily roje',
        description: 'Křísí padlé Mutantky z Bio-schránek a přivolává další vlny',
        badge: 'POSILY ROJE',
      },
    ],
    recommendedPrep: 'Příprava: TECH průraz, drcení brnění a silný Štít',
  };
}

export function getNodeEconomyMetrics(
  node: MapNode,
  hero?: HeroState,
  lang: Language = 'en',
  difficultyTier: DifficultyTier = 3,
): NodeEconomyMetrics {
  const maxHp = hero?.maxHp ?? 58;
  const diff = getDifficultyProfile(difficultyTier);
  let tensionHpPct = 0;
  let runYieldCredits = 0;
  let runYieldPowerRating: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' = 'LOW';
  let metaYieldNanites = 0;
  let opportunityCost = '';
  const isCs = lang === 'cs';

  const applyCreditModifiers = (baseCredits: number): number => {
    let val = baseCredits;
    if (node.modifier === 'golden_bounty') val = Math.round(val * 1.5);
    else if (node.modifier === 'double_credits') val *= 2;
    return Math.max(10, Math.round(val * diff.creditYieldMultiplier));
  };

  switch (node.type) {
    case 'COMBAT': {
      const isOvercharged = node.modifier === 'overcharged_hazard';
      tensionHpPct = isOvercharged ? 18 : 12;
      runYieldCredits = applyCreditModifiers(35);
      runYieldPowerRating = isOvercharged ? 'HIGH' : 'MODERATE';
      metaYieldNanites =
        (isOvercharged ? 1 : 0) + (node.modifier === 'nanite_cache' ? 2 : 0);
      opportunityCost = isOvercharged
        ? isCs
          ? 'Mini-elita: 💔 +18 % riziko · 💎 +1 Nanit'
          : 'Mini-Elite: 💔 +18% Tension · 💎 +1 Nanite'
        : isCs
          ? `🪙 +${runYieldCredits} CR · 💔 ~12 % riziko · šetří ošetřovnu`
          : `🪙 +${runYieldCredits} CR · 💔 ~12% Tension · preserves Med-Bay`;
      break;
    }
    case 'ELITE': {
      const isOvercharged = node.modifier === 'overcharged_hazard';
      tensionHpPct = isOvercharged ? 46 : 38;
      runYieldCredits = applyCreditModifiers(60);
      runYieldPowerRating = isOvercharged ? 'CRITICAL' : 'HIGH';
      metaYieldNanites =
        2 + (isOvercharged ? 1 : 0) + (node.modifier === 'nanite_cache' ? 2 : 0);
      opportunityCost = isCs
        ? `👑 Elita: 💎 +${metaYieldNanites} Nanity · 🪙 +${runYieldCredits} CR · AI čip`
        : `👑 Elite: 💎 +${metaYieldNanites} Nanites · 🪙 +${runYieldCredits} CR · AI Chip`;
      break;
    }
    case 'CYBER_CLINIC':
      tensionHpPct = 0;
      runYieldCredits = 0;
      runYieldPowerRating = 'HIGH';
      metaYieldNanites = 0;
      opportunityCost = isCs
        ? '🎛 Výběr implantátu · Čapí jesle · FabLab sloučení'
        : '🎛 Implant Draft · Stork Nursery · FabLab Splice';
      break;
    case 'CHIP_DEALER':
      tensionHpPct = 0;
      runYieldCredits = 0;
      runYieldPowerRating = node.modifier === 'flash_sale' ? 'CRITICAL' : 'HIGH';
      metaYieldNanites = 0;
      opportunityCost =
        node.modifier === 'flash_sale'
          ? isCs
            ? '🏷 Výprodej (-35 % cen): AI čipy a Chůva-boti'
            : '🏷 Flash Sale (-35% price): AI Skill Chips & Bots'
          : isCs
            ? '🤖 AI čipy · Chůva-boti · Rodová kovárna'
            : '🤖 AI Skill Chips · Nanny-Bots · Heirloom Forge';
      break;
    case 'MED_BAY':
      tensionHpPct = -35;
      runYieldCredits = 0;
      runYieldPowerRating = 'MODERATE';
      metaYieldNanites = 0;
      opportunityCost =
        node.modifier === 'funded_clinic'
          ? isCs
            ? '💚 Dotovaný krb: +12 HP bonus ke všem volbám'
            : '💚 Funded Hearth: 💚 +12 HP bonus on all'
          : isCs
            ? '💚 Oprava HP · Přetaktování dílků · Rodové bonusy'
            : '💚 Hull Repair · Tile Overclock · Family Buffs';
      break;
    case 'EVENT':
      tensionHpPct = 0;
      runYieldCredits = 20;
      runYieldPowerRating = 'MODERATE';
      metaYieldNanites = 1;
      opportunityCost = isCs
        ? '❓ Aliance rodů · Vzájemná pomoc · Rave tempo'
        : '❓ Gala Alliances · Mutual-Aid Co-op · Rave Tempo';
      break;
    case 'BOSS':
      tensionHpPct = 65;
      runYieldCredits = applyCreditModifiers(100);
      runYieldPowerRating = 'CRITICAL';
      metaYieldNanites = 5;
      opportunityCost = isCs
        ? `☠ Boss úseku: 💎 +5 Nanitů · 🪙 +${runYieldCredits} CR`
        : `☠ Stage Boss: 💎 +5 Nanites · 🪙 +${runYieldCredits} CR`;
      break;
  }

  const tensionHpEst = Math.round((Math.abs(tensionHpPct) / 100) * maxHp);

  return {
    tensionHpPct,
    tensionHpEst,
    runYieldCredits,
    runYieldPowerRating,
    metaYieldNanites,
    opportunityCost,
  };
}
