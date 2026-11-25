import type { CharacterId } from '../../engine/types';

export type GlossaryCategory = 'all' | 'defense' | 'offense' | 'board' | 'status';

export type GlossaryTermId =
  | 'armor'
  | 'shield'
  | 'aegis_pip'
  | 'phase_lock'
  | 'dmg_boost'
  | 'armor_pierce'
  | 'armor_shred'
  | 'cleave'
  | 'riposte'
  | 'tile_pool'
  | 'held_tiles'
  | 'stack_surge'
  | 'overdrive'
  | 'corrode'
  | 'jammed_tile'
  | 'spike_retaliate'
  | 'volatile_burst'
  | 'thermal_charge'
  | 'stagger'
  | 'tile_hex'
  | 'caustic_slag'
  | 'overwhelm';

export interface GlossaryEntryText {
  term: string;
  shortTag: string;
  summary: string;
  mechanics: string;
  tacticalTip: string;
  keywords: string[];
}

export interface HeroPowerDetail {
  name: string;
  badge: string;
  description: string;
}

export interface HeroCodexText {
  roleTag: string;
  playstyleLead: string;
  passivePowers: HeroPowerDetail[];
  overdriveRule: string;
  overdriveBreakdown: string[];
  synergies: string;
  tacticalLoop: string;
}

export interface CodexTranslationPack {
  codexButtonLabel: string;
  codexTitle: string;
  codexSubtitle: string;
  tabHeroes: string;
  tabGlossary: string;
  heroSelectorAria: string;
  vitalsHeader: string;
  baseStatsLabels: {
    hp: string;
    credits: string;
    capacity: string;
    startingPool: string;
  };
  passivePowersHeader: string;
  overdriveHeader: string;
  freeActionBadge: string;
  innateCoreHeader: string;
  innateCoreDesc: string;
  startingGearHeader: string;
  synergiesHeader: string;
  tacticalLoopHeader: string;
  inspectHeroDossierBtn: string;
  viewGlossaryBtn: string;
  openTermHint: string;
  searchPlaceholder: string;
  noSearchResults: string;
  clearSearch: string;
  categories: Record<GlossaryCategory, string>;
  mechanicsLabel: string;
  tacticalTipLabel: string;
  heroes: Record<CharacterId, HeroCodexText>;
  glossary: Record<GlossaryTermId, GlossaryEntryText>;
}
