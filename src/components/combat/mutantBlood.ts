import { ENEMY_TEMPLATES } from '../../engine/data';
import type {
  AnimationCue,
  CharacterId,
  EnemyArchetype,
  EnemyUnit,
  HeroineState,
} from '../../engine/types';

export type BloodBiologyId =
  | 'hemocyanin'
  | 'chlorocruorin'
  | 'sulfur_amber'
  | 'sulfur_violet'
  | 'chitinous_ichor_magenta'
  | 'chitinous_ichor_orange'
  | 'chitinous_ichor_apex'
  | 'hero_blood'
  | 'hero_corrode';

export type BloodOwnerKind = EnemyArchetype | 'hero_blood' | 'hero_corrode';

export type WeaponDecalKind = 'kinetic' | 'plasma' | 'melee';

export type BloodShapeKind =
  | 'puddle'
  | 'cone_droplet'
  | 'scorch_ring'
  | 'melee_arc'
  | 'trail_drop';

export interface BloodBiologyProfile {
  id: BloodBiologyId;
  biochemistryLabel: string;
  // Turn 0 (freshly oxygenated / active)
  freshBody: string;
  freshCore: string;
  freshHighlight: string;
  freshEmissive: string;
  // Turn 3+ (oxidized / dried / crusted / crystallized)
  driedBody: string;
  driedCore: string;
  driedHighlight: string;
  driedCrust: string;
  // Materiality & shader flags
  viscosity: number; // 0..1 (higher = thicker, slower creep, taller meniscus)
  emissiveStrength: number; // 0..1 subsurface cellular energy
  iridescence: number; // 0..1 Fresnel oil-slick edge shimmer
  iridescenceA: string;
  iridescenceB: string;
  hasSuspendedVeins: boolean;
  veinPrimary: string;
  veinSecondary: string;
  dropletPalette: readonly string[];
}

export interface BloodWeatheringState {
  turnAge: number;
  dryness: number; // 0 (Turn 0 fresh) -> 1 (Turn 3+ dried)
  glossiness: number; // 0.92 fresh -> 0.10 matte dried
  emissiveIntensity: number; // 1.0 fresh -> 0 after ~2.5 turns
  iridescenceIntensity: number; // 1.0 fresh -> 0 after ~2.2 turns
  crustAmount: number; // 0 fresh -> 1 Turn 3+
  viscositySpreadFactor: number; // 1 fresh -> 0.08 dried
}

export interface SampledBloodColors {
  body: string;
  core: string;
  highlight: string;
  rimShadow: string;
  emissive: string;
  crust: string;
  veinPrimary: string;
  veinSecondary: string;
  iridescenceA: string;
  iridescenceB: string;
}

export const BLOOD_BIOLOGY_PROFILES: Record<BloodBiologyId, BloodBiologyProfile> = {
  // Copper-Based (Hemocyanin): deep cobalt blue / cyan oxygenated -> dull grey-violet dried
  hemocyanin: {
    id: 'hemocyanin',
    biochemistryLabel: 'Copper-Based (Hemocyanin)',
    freshBody: '#0284C7',
    freshCore: '#1D4ED8',
    freshHighlight: '#67E8F9',
    freshEmissive: '#00E5FF',
    driedBody: '#6B5B7B',
    driedCore: '#474059',
    driedHighlight: '#9488A3',
    driedCrust: '#857796',
    viscosity: 0.62,
    emissiveStrength: 0.52,
    iridescence: 0.08,
    iridescenceA: '#38BDF8',
    iridescenceB: '#A78BFA',
    hasSuspendedVeins: false,
    veinPrimary: '#00E5FF',
    veinSecondary: '#38BDF8',
    dropletPalette: ['#0284C7', '#1D4ED8', '#00E5FF', '#38BDF8', '#0369A1', '#67E8F9'],
  },

  // Vanadium / Chlorocruorin-Based: acidic chartreuse shifted toward yellow-teal + emissive pulse
  chlorocruorin: {
    id: 'chlorocruorin',
    biochemistryLabel: 'Vanadium / Chlorocruorin',
    freshBody: '#84CC16',
    freshCore: '#0F766E',
    freshHighlight: '#D9F99D',
    freshEmissive: '#A3E635',
    driedBody: '#3F6212',
    driedCore: '#134E4A',
    driedHighlight: '#65A30D',
    driedCrust: '#4D7C0F',
    viscosity: 0.72,
    emissiveStrength: 0.9,
    iridescence: 0.14,
    iridescenceA: '#2DD4BF',
    iridescenceB: '#BEF264',
    hasSuspendedVeins: false,
    veinPrimary: '#BEF264',
    veinSecondary: '#2DD4BF',
    dropletPalette: ['#A3E635', '#84CC16', '#2DD4BF', '#10B981', '#BEF264', '#0D9488'],
  },

  // Sulfur / Cobalt-Based (Amber-Gold): thick molten amber-gold with oil-slick Fresnel iridescence
  sulfur_amber: {
    id: 'sulfur_amber',
    biochemistryLabel: 'Sulfur / Cobalt (Amber-Gold)',
    freshBody: '#D97706',
    freshCore: '#92400E',
    freshHighlight: '#FEF08A',
    freshEmissive: '#FBBF24',
    driedBody: '#78350F',
    driedCore: '#451A03',
    driedHighlight: '#B45309',
    driedCrust: '#A16207',
    viscosity: 0.84,
    emissiveStrength: 0.72,
    iridescence: 0.88,
    iridescenceA: '#22D3EE',
    iridescenceB: '#E879F9',
    hasSuspendedVeins: false,
    veinPrimary: '#FDE047',
    veinSecondary: '#FB923C',
    dropletPalette: ['#F59E0B', '#D97706', '#FBBF24', '#FDE047', '#B45309', '#FB923C'],
  },

  // Sulfur / Cobalt-Based (Iridescent Violet-Magenta): unstable mutagen violet-magenta + Fresnel slick
  sulfur_violet: {
    id: 'sulfur_violet',
    biochemistryLabel: 'Sulfur / Cobalt (Violet-Magenta)',
    freshBody: '#C026D3',
    freshCore: '#581C87',
    freshHighlight: '#F5D0FE',
    freshEmissive: '#E879F9',
    driedBody: '#4C1D95',
    driedCore: '#2E1065',
    driedHighlight: '#7E22CE',
    driedCrust: '#6B21A8',
    viscosity: 0.82,
    emissiveStrength: 0.78,
    iridescence: 0.95,
    iridescenceA: '#00F0FF',
    iridescenceB: '#FACC15',
    hasSuspendedVeins: false,
    veinPrimary: '#F472B6',
    veinSecondary: '#C084FC',
    dropletPalette: ['#C026D3', '#9333EA', '#E879F9', '#F472B6', '#7E22CE', '#A855F7'],
  },

  // Chitinous / Ichorous (Stalker): pitch-black tar with glowing magenta veins
  chitinous_ichor_magenta: {
    id: 'chitinous_ichor_magenta',
    biochemistryLabel: 'Chitinous / Ichorous (Magenta Veins)',
    freshBody: '#0A0B10',
    freshCore: '#030407',
    freshHighlight: '#CBD5E1',
    freshEmissive: '#FF2E7E',
    driedBody: '#18181B',
    driedCore: '#09090B',
    driedHighlight: '#52525B',
    driedCrust: '#7F1D1D',
    viscosity: 0.94,
    emissiveStrength: 0.82,
    iridescence: 0.28,
    iridescenceA: '#FF2E7E',
    iridescenceB: '#38BDF8',
    hasSuspendedVeins: true,
    veinPrimary: '#FF2E7E',
    veinSecondary: '#FB7185',
    dropletPalette: ['#18181B', '#09090B', '#FF2E7E', '#F43F5E', '#27272A', '#FB7185'],
  },

  // Chitinous / Ichorous (Brute): pitch-black tar with glowing amber-orange veins
  chitinous_ichor_orange: {
    id: 'chitinous_ichor_orange',
    biochemistryLabel: 'Chitinous / Ichorous (Amber Veins)',
    freshBody: '#0B0B10',
    freshCore: '#030306',
    freshHighlight: '#CBD5E1',
    freshEmissive: '#FB923C',
    driedBody: '#1C1917',
    driedCore: '#0C0A09',
    driedHighlight: '#57534E',
    driedCrust: '#7C2D12',
    viscosity: 0.96,
    emissiveStrength: 0.8,
    iridescence: 0.24,
    iridescenceA: '#FB923C',
    iridescenceB: '#FACC15',
    hasSuspendedVeins: true,
    veinPrimary: '#FB923C',
    veinSecondary: '#F59E0B',
    dropletPalette: ['#1C1917', '#09090B', '#FB923C', '#F59E0B', '#292524', '#FDBA74'],
  },

  // Chitinous / Ichorous (Boss Matriarch): pitch-black tar with dual glowing magenta + orange veins
  chitinous_ichor_apex: {
    id: 'chitinous_ichor_apex',
    biochemistryLabel: 'Chitinous / Ichorous (Apex Hive)',
    freshBody: '#06060B',
    freshCore: '#020205',
    freshHighlight: '#E2E8F0',
    freshEmissive: '#FF2E7E',
    driedBody: '#14121B',
    driedCore: '#09080E',
    driedHighlight: '#64748B',
    driedCrust: '#831843',
    viscosity: 0.96,
    emissiveStrength: 0.92,
    iridescence: 0.56,
    iridescenceA: '#FF2E7E',
    iridescenceB: '#00F0FF',
    hasSuspendedVeins: true,
    veinPrimary: '#FF2E7E',
    veinSecondary: '#FB923C',
    dropletPalette: ['#09090B', '#18181B', '#FF2E7E', '#FB923C', '#C026D3', '#F59E0B'],
  },

  hero_blood: {
    id: 'hero_blood',
    biochemistryLabel: 'Operative Nanite-Hemoglobin',
    freshBody: '#E11D48',
    freshCore: '#881337',
    freshHighlight: '#FDA4AF',
    freshEmissive: '#FB7185',
    driedBody: '#4C0519',
    driedCore: '#2A0410',
    driedHighlight: '#9F1239',
    driedCrust: '#6B1D2F',
    viscosity: 0.45,
    emissiveStrength: 0.25,
    iridescence: 0,
    iridescenceA: '#FB7185',
    iridescenceB: '#38BDF8',
    hasSuspendedVeins: false,
    veinPrimary: '#FB7185',
    veinSecondary: '#FDA4AF',
    dropletPalette: ['#E11D48', '#FB7185', '#BE123C', '#FDA4AF'],
  },

  hero_corrode: {
    id: 'hero_corrode',
    biochemistryLabel: 'Caustic Slag Residue',
    freshBody: '#84CC16',
    freshCore: '#115E59',
    freshHighlight: '#BEF264',
    freshEmissive: '#A3E635',
    driedBody: '#365314',
    driedCore: '#134E4A',
    driedHighlight: '#4D7C0F',
    driedCrust: '#3F6212',
    viscosity: 0.68,
    emissiveStrength: 0.72,
    iridescence: 0.2,
    iridescenceA: '#A3E635',
    iridescenceB: '#2DD4BF',
    hasSuspendedVeins: false,
    veinPrimary: '#A3E635',
    veinSecondary: '#2DD4BF',
    dropletPalette: ['#84CC16', '#2DD4BF', '#A3E635', '#14B8A6'],
  },
};

export const ARCHETYPE_BIOLOGY_MAP: Record<EnemyArchetype, BloodBiologyId> = {
  skitter: 'hemocyanin',
  larva: 'chlorocruorin',
  stinger: 'sulfur_amber',
  spitter: 'sulfur_violet',
  stalker: 'chitinous_ichor_magenta',
  brute: 'chitinous_ichor_orange',
  boss: 'chitinous_ichor_apex',
};

export function getBloodBiologyProfile(owner: BloodOwnerKind): BloodBiologyProfile {
  if (owner === 'hero_blood') return BLOOD_BIOLOGY_PROFILES.hero_blood;
  if (owner === 'hero_corrode') return BLOOD_BIOLOGY_PROFILES.hero_corrode;
  const bioId = ARCHETYPE_BIOLOGY_MAP[owner] ?? 'chlorocruorin';
  return BLOOD_BIOLOGY_PROFILES[bioId];
}

function parseHexRgb(hex: string): [number, number, number] {
  const clean = hex.charCodeAt(0) === 35 ? hex.slice(1) : hex;
  const n = parseInt(clean, 16);
  if (Number.isNaN(n)) return [132, 204, 22];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function lerpHexColor(hexA: string, hexB: string, t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  if (clamped <= 0.001) return hexA;
  if (clamped >= 0.999) return hexB;
  const [r1, g1, b1] = parseHexRgb(hexA);
  const [r2, g2, b2] = parseHexRgb(hexB);
  const r = Math.round(r1 + (r2 - r1) * clamped);
  const g = Math.round(g1 + (g2 - g1) * clamped);
  const b = Math.round(b1 + (b2 - b1) * clamped);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
}

export function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = parseHexRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
}

export function computeBloodWeatheringState(turnAge: number): BloodWeatheringState {
  const age = Math.max(0, turnAge);
  const dryness = Math.min(1, age / 3);
  const glossiness = 0.92 - (0.92 - 0.1) * Math.pow(dryness, 0.82);
  const emissiveIntensity = Math.max(0, Math.min(1, 1 - age / 2.5));
  const iridescenceIntensity = Math.max(0, Math.min(1, 1 - age / 2.2));
  const crustAmount = Math.max(0, Math.min(1, (age - 0.75) / 2.0));
  const viscositySpreadFactor = Math.max(0.08, Math.min(1, 1 - age * 0.72));
  return {
    turnAge: age,
    dryness,
    glossiness,
    emissiveIntensity,
    iridescenceIntensity,
    crustAmount,
    viscositySpreadFactor,
  };
}

export function sampleWeatheredBloodColors(
  profile: BloodBiologyProfile,
  turnAge: number,
): SampledBloodColors {
  const w = computeBloodWeatheringState(turnAge);
  const body = lerpHexColor(profile.freshBody, profile.driedBody, w.dryness);
  const core = lerpHexColor(profile.freshCore, profile.driedCore, w.dryness);
  const highlight = lerpHexColor(profile.freshHighlight, profile.driedHighlight, w.dryness);
  const rimShadow = lerpHexColor(core, '#020617', 0.58);
  const emissive = lerpHexColor(profile.freshEmissive, profile.driedCrust, w.dryness * 0.75);
  const crust = profile.driedCrust;
  const veinPrimary = lerpHexColor(profile.veinPrimary, profile.driedCrust, w.dryness * 0.82);
  const veinSecondary = lerpHexColor(profile.veinSecondary, profile.driedCore, w.dryness * 0.85);
  return {
    body,
    core,
    highlight,
    rimShadow,
    emissive,
    crust,
    veinPrimary,
    veinSecondary,
    iridescenceA: profile.iridescenceA,
    iridescenceB: profile.iridescenceB,
  };
}

const KINETIC_WEAPONS = new Set([
  'pistole_aretta',
  'dvojita_brokovnice',
  'tezka_brokovnice',
  'karabin_vx',
]);

const MELEE_GEAR = new Set(['nano_ostri']);
const PLASMA_GEAR = new Set([
  'utocny_dron_sokol',
  'pulzni_kuse',
  'energeticky_konvertor',
]);

export function getEquippedDefIds(heroine: Pick<HeroineState, 'ownedEquipment' | 'equippedInstanceIds'>): string[] {
  const byInst = new Map(heroine.ownedEquipment.map((e) => [e.instanceId, e.defId]));
  const defs: string[] = [];
  for (const id of heroine.equippedInstanceIds) {
    const defId = byInst.get(id);
    if (defId) defs.push(defId);
  }
  return defs;
}

export function resolveWeaponDecalKind(options: {
  attackMode?: 'dash_kick' | 'shoot' | null;
  characterId?: CharacterId;
  equippedDefIds?: readonly string[];
  cueId?: string;
  cueKind?: AnimationCue['kind'];
  isSurge?: boolean;
}): WeaponDecalKind {
  const {
    attackMode,
    characterId = 'kira',
    equippedDefIds = [],
    cueId = '',
    cueKind,
    isSurge = false,
  } = options;

  if (
    cueKind === 'hero_overdrive' ||
    cueKind === 'enemy_acid' ||
    cueId.endsWith('_def_pulse') ||
    cueId.includes('tech_pierce')
  ) {
    return 'plasma';
  }

  if (attackMode === 'dash_kick') {
    return 'melee';
  }

  if (characterId === 'zuri') {
    return 'plasma';
  }

  const hasKinetic = equippedDefIds.some((d) => KINETIC_WEAPONS.has(d));
  const hasMelee = equippedDefIds.some((d) => MELEE_GEAR.has(d));
  const hasPlasma = equippedDefIds.some((d) => PLASMA_GEAR.has(d));

  if (attackMode === 'shoot') {
    if (characterId === 'aurelia' || hasKinetic) {
      return isSurge && hasPlasma ? 'plasma' : 'kinetic';
    }
    if (hasPlasma || isSurge) return 'plasma';
    if (hasMelee) return 'melee';
    return 'kinetic';
  }

  if (hasMelee && !hasKinetic) return 'melee';
  if (hasPlasma && !hasKinetic) return 'plasma';
  return 'kinetic';
}

export interface EnemyStatusVisualFlags {
  isBleeding: boolean;
  isSeverelyBleeding: boolean;
  isShredded: boolean;
}

export function getEnemyStatusVisualFlags(
  enemy: Pick<EnemyUnit, 'archetype' | 'hp' | 'maxHp' | 'armor' | 'shieldPips' | 'maxShieldPips' | 'staggered' | 'turnDamageTaken'>,
  observedMaxArmor?: number,
): EnemyStatusVisualFlags {
  if (enemy.hp <= 0) {
    return { isBleeding: false, isSeverelyBleeding: false, isShredded: false };
  }
  const baseArmor = Math.max(
    observedMaxArmor ?? 0,
    ENEMY_TEMPLATES[enemy.archetype]?.startingArmor ?? 0,
  );
  const isBleeding = enemy.hp < enemy.maxHp;
  const isSeverelyBleeding = enemy.hp <= enemy.maxHp * 0.55 || (enemy.turnDamageTaken ?? 0) > 0;
  const isShredded =
    (baseArmor > 0 && enemy.armor < baseArmor) ||
    (enemy.maxShieldPips > 0 && enemy.shieldPips < enemy.maxShieldPips) ||
    Boolean(enemy.staggered);
  return { isBleeding, isSeverelyBleeding, isShredded };
}
