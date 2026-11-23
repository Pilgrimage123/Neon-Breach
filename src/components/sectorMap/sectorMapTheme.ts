import type { MapNode, MapNodeType } from '../../engine/types';
import type { TranslationSet } from '../../i18n/translations';

export const DISTRICT_BADGE_LABELS: Record<
  NonNullable<MapNode['districtBadge']>,
  { en: string; cs: string; colorClass: string }
> = {
  stork_nursery: {
    en: 'GUILD CRAFT',
    cs: 'CECHOVNÍ UČENÍ',
    colorClass: 'bg-pink-500/25 border-pink-300/60 text-pink-200',
  },
  pedigree_lab: {
    en: 'HERALDRY BENCH',
    cs: 'RODOVÝ ERB',
    colorClass: 'bg-cyan-500/25 border-cyan-300/60 text-cyan-200',
  },
  charter_academy: {
    en: 'CHARTER ACADEMY',
    cs: 'AKADEMIE DÍLKŮ',
    colorClass: 'bg-indigo-500/25 border-indigo-300/60 text-indigo-200',
  },
  open_fablab: {
    en: 'OPEN FABLAB',
    cs: 'OPEN FABLAB',
    colorClass: 'bg-teal-500/25 border-teal-300/60 text-teal-200',
  },
  upcycle_kiosk: {
    en: 'UPCYCLE KIOSK',
    cs: 'UPCYCLE KIOSEK',
    colorClass: 'bg-lime-500/25 border-lime-300/60 text-lime-200',
  },
  smart_hearth: {
    en: 'FAMILY HEARTH',
    cs: 'RODINNÝ KRB',
    colorClass: 'bg-orange-500/25 border-orange-300/65 text-orange-200',
  },
  rooftop_cafe: {
    en: 'SOLAR CAFÉ',
    cs: 'SLUNEČNÍ KAVÁRNA',
    colorClass: 'bg-amber-500/25 border-amber-300/60 text-amber-100',
  },
  suburban_dome: {
    en: 'SUNLIT DOME',
    cs: 'SLUNEČNÍ DÓM',
    colorClass: 'bg-emerald-500/30 border-emerald-300/65 text-emerald-100',
  },
  nanny_showroom: {
    en: 'NANNY-BOT SHOP',
    cs: 'CHŮVA-BOTI',
    colorClass: 'bg-amber-500/25 border-amber-300/60 text-amber-200',
  },
  beta_arcade: {
    en: 'BETA ARCADE',
    cs: 'BETA HERNA',
    colorClass: 'bg-violet-500/25 border-violet-300/60 text-violet-200',
  },
  heirloom_forge: {
    en: 'HEIRLOOM FORGE',
    cs: 'RODOVÁ KOVÁRNA',
    colorClass: 'bg-yellow-500/25 border-yellow-300/60 text-yellow-200',
  },
  matchmakers_gala: {
    en: 'HAPPY WIFE DAY',
    cs: 'DEN MANŽELKY',
    colorClass: 'bg-fuchsia-500/25 border-fuchsia-300/60 text-fuchsia-200',
  },
  mutual_aid_coop: {
    en: '3-DAY MAN SHIFT',
    cs: '3-DENNÍ SMĚNA',
    colorClass: 'bg-purple-500/25 border-purple-300/60 text-purple-200',
  },
  synth_rave: {
    en: 'SYNTH-RAVE',
    cs: 'ALGO-RAVE',
    colorClass: 'bg-fuchsia-500/30 border-fuchsia-300/65 text-fuchsia-100',
  },
  mesh_relay: {
    en: 'MESH-NET RELAY',
    cs: 'MESH-NET VĚŽ',
    colorClass: 'bg-sky-500/25 border-sky-300/60 text-sky-200',
  },
  ar_graffiti_wall: {
    en: 'AR GRAFFITI WALL',
    cs: 'AR HOLO-ZEĎ',
    colorClass: 'bg-pink-500/30 border-pink-300/65 text-pink-100',
  },
  vanguard_escort: {
    en: 'BORDER WATCH',
    cs: 'HRANIČNÍ STRÁŽ',
    colorClass: 'bg-amber-500/30 border-amber-300/70 text-amber-100',
  },
  data_liberation: {
    en: 'DATA LIBERATION',
    cs: 'OSVOBOZENÍ DAT',
    colorClass: 'bg-cyan-500/30 border-cyan-300/70 text-cyan-100',
  },
  maglev_hub: {
    en: 'MAG-LEV HUB',
    cs: 'MAG-LEV UZEL',
    colorClass: 'bg-sky-500/25 border-sky-300/60 text-sky-200',
  },
};

export const NODE_STYLE: Record<
  MapNodeType,
  { border: string; accent: string; bg: string; hex: string }
> = {
  COMBAT: {
    border: 'border-[#FF2E7E]/60',
    accent: 'text-rose-200',
    bg: 'bg-gradient-to-b from-[#33122C]/90 to-[#1B0A1A]/92',
    hex: '#FF2E7E',
  },
  ELITE: {
    border: 'border-[#FFC700]/75',
    accent: 'text-amber-200',
    bg: 'bg-gradient-to-b from-[#3A280E]/92 to-[#1F1507]/94',
    hex: '#FFC700',
  },
  CYBER_CLINIC: {
    border: 'border-[#00F0FF]/65',
    accent: 'text-cyan-200',
    bg: 'bg-gradient-to-b from-[#0E2D4C]/90 to-[#081A2E]/92',
    hex: '#00F0FF',
  },
  CHIP_DEALER: {
    border: 'border-amber-400/70',
    accent: 'text-amber-200',
    bg: 'bg-gradient-to-b from-[#3A220B]/90 to-[#1F1105]/92',
    hex: '#F59E0B',
  },
  MED_BAY: {
    border: 'border-orange-400/75',
    accent: 'text-orange-200',
    bg: 'bg-gradient-to-b from-[#3D2010]/92 to-[#211008]/94',
    hex: '#FB923C',
  },
  EVENT: {
    border: 'border-purple-400/70',
    accent: 'text-purple-200',
    bg: 'bg-gradient-to-b from-[#2B123D]/90 to-[#170921]/92',
    hex: '#C084FC',
  },
  BOSS: {
    border: 'border-lime-400/80',
    accent: 'text-lime-200',
    bg: 'bg-gradient-to-b from-[#1E3318]/94 to-[#101C0D]/96',
    hex: '#84CC16',
  },
};

export const ROW_INDICES = [0, 1, 2] as const;
export const LANE_TRACK_Y = [72, 216, 360] as const;

export function formatStageCode(layerIndex: number): string {
  return `S${String(layerIndex + 1).padStart(2, '0')}`;
}

export function getVisualRow(node: MapNode, maxLayer: number): number {
  return node.layer === 0 || node.layer === maxLayer ? 1 : node.lane;
}

export function getPortCoords(node: MapNode, totalCols: number) {
  const maxLayer = totalCols - 1;
  const colGap = totalCols > 5 ? 16 : 28;
  const colSpan = (1000 - (totalCols - 1) * colGap) / totalCols;
  const colLeft = node.layer * (colSpan + colGap);
  const colRight = colLeft + colSpan;
  const rowIndex = getVisualRow(node, maxLayer);
  const rowY = rowIndex === 0 ? 72 : rowIndex === 1 ? 216 : 360;
  return {
    leftX: colLeft + 2,
    rightX: colRight - 2,
    centerX: (colLeft + colRight) * 0.5,
    y: rowY,
  };
}

export function getNodeRewardLabel(type: MapNodeType, t: TranslationSet): string {
  switch (type) {
    case 'CYBER_CLINIC':
      return t.mapRewardImplant;
    case 'CHIP_DEALER':
      return t.clinicShopTitle;
    case 'ELITE':
      return t.mapRewardElite;
    case 'MED_BAY':
      return t.mapRewardMedbay;
    case 'EVENT':
      return t.nodes.EVENT;
    case 'BOSS':
      return t.mapRewardBoss;
    default:
      return t.mapRewardCombat;
  }
}
