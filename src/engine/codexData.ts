import {
  CODEX_TRANSLATIONS,
  type GlossaryCategory,
  type GlossaryTermId,
} from '../i18n/codexTranslations';
import type { Language } from '../i18n/translations';
import {
  HERO_SPECS,
  type HeroSpec,
  SKILL_CHIPS_BY_ID,
  getInnateTilesForCharacter,
} from './data';
import { createStartingSkillChips } from './poolBuilder';
import type {
  CharacterId,
  EnemyPassiveKind,
  SkillChipDefinition,
  TileSpec,
  TileType,
} from './types';

export interface GlossaryTermMeta {
  id: GlossaryTermId;
  category: Exclude<GlossaryCategory, 'all'>;
  accent: 'gold' | 'cyan' | 'rose' | 'lime';
  relatedTerms: GlossaryTermId[];
}

export const GLOSSARY_TERMS: readonly GlossaryTermMeta[] = [
  {
    id: 'armor',
    category: 'defense',
    accent: 'gold',
    relatedTerms: ['armor_pierce', 'armor_shred', 'stack_surge'],
  },
  {
    id: 'shield',
    category: 'defense',
    accent: 'cyan',
    relatedTerms: ['corrode', 'riposte', 'jammed_tile'],
  },
  {
    id: 'aegis_pip',
    category: 'defense',
    accent: 'cyan',
    relatedTerms: ['phase_lock', 'volatile_burst', 'cleave'],
  },
  {
    id: 'phase_lock',
    category: 'defense',
    accent: 'lime',
    relatedTerms: ['aegis_pip', 'armor'],
  },
  {
    id: 'dmg_boost',
    category: 'offense',
    accent: 'gold',
    relatedTerms: ['stack_surge', 'overdrive'],
  },
  {
    id: 'armor_pierce',
    category: 'offense',
    accent: 'rose',
    relatedTerms: ['armor', 'armor_shred', 'overdrive'],
  },
  {
    id: 'armor_shred',
    category: 'offense',
    accent: 'gold',
    relatedTerms: ['armor', 'armor_pierce'],
  },
  {
    id: 'cleave',
    category: 'offense',
    accent: 'rose',
    relatedTerms: ['stack_surge', 'aegis_pip'],
  },
  {
    id: 'riposte',
    category: 'offense',
    accent: 'cyan',
    relatedTerms: ['shield', 'spike_retaliate', 'stack_surge'],
  },
  {
    id: 'tile_pool',
    category: 'board',
    accent: 'cyan',
    relatedTerms: ['held_tiles', 'stack_surge'],
  },
  {
    id: 'held_tiles',
    category: 'board',
    accent: 'gold',
    relatedTerms: ['tile_pool', 'stack_surge'],
  },
  {
    id: 'stack_surge',
    category: 'board',
    accent: 'gold',
    relatedTerms: ['armor', 'cleave', 'spike_retaliate'],
  },
  {
    id: 'overdrive',
    category: 'board',
    accent: 'gold',
    relatedTerms: ['armor_pierce', 'dmg_boost', 'corrode'],
  },
  {
    id: 'corrode',
    category: 'status',
    accent: 'lime',
    relatedTerms: ['shield', 'jammed_tile', 'overdrive'],
  },
  {
    id: 'jammed_tile',
    category: 'status',
    accent: 'lime',
    relatedTerms: ['corrode', 'shield', 'stack_surge'],
  },
  {
    id: 'spike_retaliate',
    category: 'status',
    accent: 'rose',
    relatedTerms: ['stack_surge', 'riposte'],
  },
  {
    id: 'volatile_burst',
    category: 'status',
    accent: 'lime',
    relatedTerms: ['armor_pierce', 'aegis_pip'],
  },
  {
    id: 'thermal_charge',
    category: 'status',
    accent: 'gold',
    relatedTerms: ['shield', 'stagger'],
  },
  {
    id: 'stagger',
    category: 'status',
    accent: 'cyan',
    relatedTerms: ['thermal_charge', 'armor'],
  },
  {
    id: 'tile_hex',
    category: 'status',
    accent: 'rose',
    relatedTerms: ['overdrive', 'armor'],
  },
  {
    id: 'caustic_slag',
    category: 'status',
    accent: 'lime',
    relatedTerms: ['jammed_tile', 'overdrive'],
  },
];

export const PASSIVE_TO_GLOSSARY_TERM: Record<EnemyPassiveKind, GlossaryTermId> = {
  none: 'aegis_pip',
  volatile_burst: 'volatile_burst',
  anchor_aegis: 'aegis_pip',
  time_bomb: 'thermal_charge',
  spike_retaliate: 'spike_retaliate',
  acid_jam: 'jammed_tile',
  threshold_pip: 'aegis_pip',
  phase_gate: 'phase_lock',
};

export function getGlossaryTermMeta(id: GlossaryTermId): GlossaryTermMeta | undefined {
  return GLOSSARY_TERMS.find((item) => item.id === id);
}

export function filterGlossaryTerms(
  query: string,
  category: GlossaryCategory,
  lang: Language,
): GlossaryTermMeta[] {
  const normalized = query.trim().toLowerCase();
  const textPack = CODEX_TRANSLATIONS[lang].glossary;

  return GLOSSARY_TERMS.filter((meta) => {
    if (category !== 'all' && meta.category !== category) {
      return false;
    }
    if (!normalized) {
      return true;
    }
    const entry = textPack[meta.id];
    if (!entry) return false;
    const haystack = [
      entry.term,
      entry.shortTag,
      entry.summary,
      entry.mechanics,
      entry.tacticalTip,
      ...entry.keywords,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(normalized);
  });
}

export interface HeroCodexProfile {
  spec: HeroSpec;
  innateTiles: readonly TileSpec[];
  startingChips: SkillChipDefinition[];
  startingMemory: number;
  startingPoolCounts: Record<TileType, number>;
  totalStartingTiles: number;
}

export function getHeroCodexProfile(characterId: CharacterId): HeroCodexProfile {
  const spec = HERO_SPECS[characterId] ?? HERO_SPECS.kira;
  const innateTiles = getInnateTilesForCharacter(characterId);
  const { ownedChips } = createStartingSkillChips(characterId);
  const startingChips: SkillChipDefinition[] = [];
  let startingMemory = 0;

  const startingPoolCounts: Record<TileType, number> = {
    attack: 0,
    defense: 0,
    tech: 0,
  };

  for (const tile of innateTiles) {
    startingPoolCounts[tile.type] += 1;
  }

  for (const owned of ownedChips) {
    const def = SKILL_CHIPS_BY_ID[owned.defId];
    if (!def) continue;
    startingChips.push(def);
    startingMemory += def.memoryCost;
    for (const tile of def.tiles) {
      startingPoolCounts[tile.type] += 1;
    }
  }

  const totalStartingTiles =
    startingPoolCounts.attack + startingPoolCounts.defense + startingPoolCounts.tech;

  return {
    spec,
    innateTiles,
    startingChips,
    startingMemory,
    startingPoolCounts,
    totalStartingTiles,
  };
}
