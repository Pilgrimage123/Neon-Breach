import type { EnemyArchetype, MapNodeType, TileType } from '../engine/types';

export type SemanticZoomLevel = 'overview' | 'standard' | 'closeup';

export type HapticPatternKind = 'select' | 'surge' | 'invalid' | 'commit';

export interface PhysicalScreenProfile {
  widthPx: number;
  heightPx: number;
  dpr: number;
  isCoarsePointer: boolean;
  diagonalInchesEst: number;
  isPhysicallySmallScreen: boolean;
  physicalScaleFactor: number;
  defaultAutoFocusCamera: boolean;
  defaultHighContrastBorders: boolean;
}

export interface AccessibilityPrefs {
  tacticalView: boolean;
  semanticZoom: SemanticZoomLevel;
  autoFocusCamera: boolean;
  twoStepConfirm: boolean;
  colorblindPips: boolean;
  highContrastBorders: boolean;
  hapticsEnabled: boolean;
}

export interface CornerPipSpec {
  symbol: string;
  shapeId: 'diamond' | 'circle' | 'triangle' | 'hex' | 'cross' | 'star' | 'ring';
  shortCode: string;
  labelEn: string;
  labelCs: string;
  accentHex: string;
}

export interface SemanticZoomLoD {
  level: SemanticZoomLevel;
  showSecondaryProse: boolean;
  showMicroBadges: boolean;
  showLargeSilhouettes: boolean;
  tileHeightScale: number;
  fontScale: number;
  mapNodeCompactMode: boolean;
}

export interface AutoFocusCameraTransform {
  zoom: number;
  panX: number;
  panY: number;
  activeQuadrant: 'idle' | 'hero_defense' | 'hero_tech' | 'front_enemy' | 'inspect_unit';
}

export interface LoupeAnchorCoords {
  leftPx: number;
  topPx: number;
  dockedAtTop: boolean;
}

const ACCESSIBILITY_PREFS_KEY = 'neon_breach_a11y_prefs_v1';

/**
 * Estimates physical screen diagonal in inches and computes a readable
 * physical millimeter UI scale factor so high-DPI small phones (e.g. 6-inch)
 * never render microscopic text compared to a 27-inch desktop monitor.
 */
export function detectPhysicalScreenProfile(
  widthPx: number,
  heightPx: number,
  dpr = 1,
  isCoarsePointer = false,
): PhysicalScreenProfile {
  const safeW = Math.max(240, widthPx);
  const safeH = Math.max(240, heightPx);
  const safeDpr = Math.max(1, Math.min(4, dpr || 1));

  // CSS reference pixel density is 96 CSS px/inch on desktop monitors,
  // whereas handheld touch screens are held closer but have smaller physical CSS viewports (~110-135 effective CSS ppi).
  const effectiveCssPpi = isCoarsePointer || Math.min(safeW, safeH) < 540 ? 122 : 96;
  const widthInches = safeW / effectiveCssPpi;
  const heightInches = safeH / effectiveCssPpi;
  const diagonalInchesEst = Number(Math.hypot(widthInches, heightInches).toFixed(2));

  const isPhysicallySmallScreen = diagonalInchesEst < 9.5 || Math.min(safeW, safeH) < 500;

  // Compute physical UI scale factor (boosts typography & icon legibility on physically small high-DPI screens)
  let physicalScaleFactor = 1.0;
  if (diagonalInchesEst <= 6.8) {
    physicalScaleFactor = 1.16;
  } else if (diagonalInchesEst <= 9.5) {
    physicalScaleFactor = 1.08;
  } else if (safeW >= 1920 && safeDpr >= 1.5) {
    physicalScaleFactor = 1.06;
  }

  return {
    widthPx: safeW,
    heightPx: safeH,
    dpr: safeDpr,
    isCoarsePointer,
    diagonalInchesEst,
    isPhysicallySmallScreen,
    physicalScaleFactor,
    defaultAutoFocusCamera: isPhysicallySmallScreen || isCoarsePointer,
    defaultHighContrastBorders: isPhysicallySmallScreen || isCoarsePointer,
  };
}

/**
 * Double-coding geometric corner suit pips for board tiles and action triggers.
 * Ensures 100% color-independent identification under sunlight glare, Night Shift, or colorblindness.
 */
export function getTileCornerPip(type: TileType): CornerPipSpec {
  switch (type) {
    case 'attack':
      return {
        symbol: '◆',
        shapeId: 'diamond',
        shortCode: 'ATK',
        labelEn: 'Attack Suit (Diamond ◆)',
        labelCs: 'Útok (Démant ◆)',
        accentHex: '#FF2E7E',
      };
    case 'defense':
      return {
        symbol: '●',
        shapeId: 'circle',
        shortCode: 'DEF',
        labelEn: 'Defense Suit (Shield Circle ●)',
        labelCs: 'Obrana (Kruh štítu ●)',
        accentHex: '#00F0FF',
      };
    case 'tech':
    default:
      return {
        symbol: '▲',
        shapeId: 'triangle',
        shortCode: 'TECH',
        labelEn: 'TECH Suit (Delta ▲)',
        labelCs: 'TECH (Delta ▲)',
        accentHex: '#FFC700',
      };
  }
}

export function getNodeCornerPip(type: MapNodeType): CornerPipSpec {
  switch (type) {
    case 'COMBAT':
      return {
        symbol: '◆',
        shapeId: 'diamond',
        shortCode: 'CMB',
        labelEn: 'Combat Skirmish (◆)',
        labelCs: 'Bojová hlídka (◆)',
        accentHex: '#FF2E7E',
      };
    case 'ELITE':
      return {
        symbol: '★',
        shapeId: 'star',
        shortCode: 'ELT',
        labelEn: 'Elite Threat (★)',
        labelCs: 'Elitní hrozba (★)',
        accentHex: '#FFC700',
      };
    case 'CYBER_CLINIC':
      return {
        symbol: '⬡',
        shapeId: 'hex',
        shortCode: 'CLN',
        labelEn: 'Cyber-Clinic (⬡)',
        labelCs: 'Kyber-klinika (⬡)',
        accentHex: '#00F0FF',
      };
    case 'CHIP_DEALER':
      return {
        symbol: '◈',
        shapeId: 'diamond',
        shortCode: 'CHP',
        labelEn: 'Chip Dealer (◈)',
        labelCs: 'Prodejce čipů (◈)',
        accentHex: '#F59E0B',
      };
    case 'MED_BAY':
      return {
        symbol: '✚',
        shapeId: 'cross',
        shortCode: 'MED',
        labelEn: 'Bio-Med Bay (✚)',
        labelCs: 'Bio-ošetřovna (✚)',
        accentHex: '#10F5A0',
      };
    case 'EVENT':
      return {
        symbol: '▲',
        shapeId: 'triangle',
        shortCode: 'EVT',
        labelEn: 'Anomaly Event (▲)',
        labelCs: 'Anomálie (▲)',
        accentHex: '#C084FC',
      };
    case 'BOSS':
    default:
      return {
        symbol: '◉',
        shapeId: 'ring',
        shortCode: 'BOSS',
        labelEn: 'Sector Boss (◉)',
        labelCs: 'Královna sektoru (◉)',
        accentHex: '#84CC16',
      };
  }
}

export function getEnemyRolePip(archetype: EnemyArchetype): CornerPipSpec {
  switch (archetype) {
    case 'larva':
      return {
        symbol: '▲',
        shapeId: 'triangle',
        shortCode: 'VOL',
        labelEn: 'Volatile Fodder (▲)',
        labelCs: 'Výbušný pěšák (▲)',
        accentHex: '#84CC16',
      };
    case 'skitter':
      return {
        symbol: '●',
        shapeId: 'circle',
        shortCode: 'AEG',
        labelEn: 'Aegis Anchor (●)',
        labelCs: 'Aegis podpora (●)',
        accentHex: '#00F0FF',
      };
    case 'stinger':
      return {
        symbol: '★',
        shapeId: 'star',
        shortCode: 'BOMB',
        labelEn: 'Thermal Time-Bomb (★)',
        labelCs: 'Časovaná bomba (★)',
        accentHex: '#FB923C',
      };
    case 'stalker':
      return {
        symbol: '◆',
        shapeId: 'diamond',
        shortCode: 'SPK',
        labelEn: 'Spike Punisher (◆)',
        labelCs: 'Odveta trnů (◆)',
        accentHex: '#FF2E7E',
      };
    case 'spitter':
      return {
        symbol: '⬡',
        shapeId: 'hex',
        shortCode: 'JAM',
        labelEn: 'Acid Disrupter (⬡)',
        labelCs: 'Žíravý rušič (⬡)',
        accentHex: '#C084FC',
      };
    case 'brute':
      return {
        symbol: '■',
        shapeId: 'hex',
        shortCode: 'TANK',
        labelEn: 'Armored Juggernaut (■)',
        labelCs: 'Obrněný kolos (■)',
        accentHex: '#FFC700',
      };
    case 'boss':
    default:
      return {
        symbol: '◉',
        shapeId: 'ring',
        shortCode: 'APEX',
        labelEn: 'Apex Sovereign (◉)',
        labelCs: 'Vládce úlu (◉)',
        accentHex: '#84CC16',
      };
  }
}

/**
 * Resolves Dynamic Level of Detail (Semantic Zoom) rules so zoomed-out views
 * swap tiny prose for bold silhouettes and primary numbers, while close-up views
 * smoothly reveal detailed breakdowns.
 */
export function resolveSemanticZoomLoD(
  level: SemanticZoomLevel,
  tacticalViewActive = false,
): SemanticZoomLoD {
  if (level === 'overview') {
    return {
      level: 'overview',
      showSecondaryProse: false,
      showMicroBadges: false,
      showLargeSilhouettes: true,
      tileHeightScale: 0.92,
      fontScale: 1.15,
      mapNodeCompactMode: true,
    };
  }
  if (level === 'closeup') {
    return {
      level: 'closeup',
      showSecondaryProse: true,
      showMicroBadges: true,
      showLargeSilhouettes: true,
      tileHeightScale: 1.16,
      fontScale: 1.18,
      mapNodeCompactMode: false,
    };
  }
  return {
    level: 'standard',
    showSecondaryProse: !tacticalViewActive,
    showMicroBadges: true,
    showLargeSilhouettes: tacticalViewActive,
    tileHeightScale: 1.0,
    fontScale: tacticalViewActive ? 1.1 : 1.0,
    mapNodeCompactMode: false,
  };
}

export function cycleSemanticZoomLevel(current: SemanticZoomLevel): SemanticZoomLevel {
  if (current === 'standard') return 'overview';
  if (current === 'overview') return 'closeup';
  return 'standard';
}

/**
 * Computes the Auto-Framing Camera transform (~18-20% zoom + focal quadrant pan)
 * when an interaction or preview happens on the combat stage.
 */
export function computeAutoFocusCameraTransform(params: {
  enabled: boolean;
  stageW: number;
  stageH: number;
  activeColor: TileType | null;
  inspectedTarget: 'hero' | string | null;
  heroX: number;
  frontEnemyX: number;
  inspectedEnemyX: number | null;
  groundY: number;
}): AutoFocusCameraTransform {
  const {
    enabled,
    stageW,
    stageH,
    activeColor,
    inspectedTarget,
    heroX,
    frontEnemyX,
    inspectedEnemyX,
    groundY,
  } = params;

  if (!enabled || stageW <= 0 || stageH <= 0) {
    return { zoom: 1, panX: 0, panY: 0, activeQuadrant: 'idle' };
  }

  const centerX = stageW * 0.5;
  const centerY = stageH * 0.5;
  const focusY = Math.max(stageH * 0.35, Math.min(stageH * 0.72, groundY - stageH * 0.22));

  if (inspectedTarget === 'hero') {
    const zoom = 1.2;
    return {
      zoom,
      panX: Math.round((centerX - heroX) * 0.38),
      panY: Math.round((centerY - focusY) * 0.32),
      activeQuadrant: 'hero_defense',
    };
  }

  if (inspectedTarget && inspectedEnemyX !== null) {
    const zoom = 1.2;
    return {
      zoom,
      panX: Math.round((centerX - inspectedEnemyX) * 0.38),
      panY: Math.round((centerY - focusY) * 0.32),
      activeQuadrant: 'inspect_unit',
    };
  }

  if (activeColor === 'attack') {
    const zoom = 1.18;
    const midActionX = heroX * 0.32 + frontEnemyX * 0.68;
    return {
      zoom,
      panX: Math.round((centerX - midActionX) * 0.35),
      panY: Math.round((centerY - focusY) * 0.28),
      activeQuadrant: 'front_enemy',
    };
  }

  if (activeColor === 'defense') {
    const zoom = 1.16;
    return {
      zoom,
      panX: Math.round((centerX - (heroX + 24)) * 0.34),
      panY: Math.round((centerY - focusY) * 0.26),
      activeQuadrant: 'hero_defense',
    };
  }

  if (activeColor === 'tech') {
    const zoom = 1.16;
    return {
      zoom,
      panX: Math.round((centerX - heroX) * 0.32),
      panY: Math.round((centerY - focusY) * 0.26),
      activeQuadrant: 'hero_tech',
    };
  }

  return { zoom: 1, panX: 0, panY: 0, activeQuadrant: 'idle' };
}

/**
 * Computes thumb-safe coordinates for the Press-and-Hold Loupe Magnifier card.
 * Offsets the readout >= 96px above the pointer Y (or docks cleanly at the top safe margin)
 * so the player's finger or thumb never covers the text.
 */
export function computeLoupeAnchorPosition(
  pointerX: number,
  pointerY: number,
  viewportW: number,
  viewportH: number,
  cardWidth = 340,
  cardHeight = 132,
): LoupeAnchorCoords {
  const safeMargin = 12;
  const thumbOffsetAboveFinger = 98;
  const clampedW = Math.min(cardWidth, Math.max(240, viewportW - safeMargin * 2));

  const rawLeft = Math.round(pointerX - clampedW * 0.5);
  const leftPx = Math.max(safeMargin, Math.min(viewportW - clampedW - safeMargin, rawLeft));

  const candidateTop = Math.round(pointerY - cardHeight - thumbOffsetAboveFinger);
  if (candidateTop < 48) {
    // If finger is near the top half of a compact screen, dock at top safe strip or flip well clear of finger
    const topSafe = 46;
    return {
      leftPx,
      topPx: pointerY < topSafe + cardHeight + 36 ? Math.min(viewportH - cardHeight - safeMargin, pointerY + 64) : topSafe,
      dockedAtTop: true,
    };
  }

  return {
    leftPx,
    topPx: candidateTop,
    dockedAtTop: false,
  };
}

function createDefaultAccessibilityPrefs(profile: PhysicalScreenProfile): AccessibilityPrefs {
  return {
    tacticalView: false,
    semanticZoom: 'standard',
    autoFocusCamera: profile.defaultAutoFocusCamera,
    twoStepConfirm: profile.isCoarsePointer || profile.isPhysicallySmallScreen,
    colorblindPips: true,
    highContrastBorders: profile.defaultHighContrastBorders,
    hapticsEnabled: true,
  };
}

export function loadAccessibilityPrefs(profile: PhysicalScreenProfile): AccessibilityPrefs {
  const defaults = createDefaultAccessibilityPrefs(profile);
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(ACCESSIBILITY_PREFS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<AccessibilityPrefs>;
    return {
      tacticalView: typeof parsed.tacticalView === 'boolean' ? parsed.tacticalView : defaults.tacticalView,
      semanticZoom:
        parsed.semanticZoom === 'overview' ||
        parsed.semanticZoom === 'standard' ||
        parsed.semanticZoom === 'closeup'
          ? parsed.semanticZoom
          : defaults.semanticZoom,
      autoFocusCamera:
        typeof parsed.autoFocusCamera === 'boolean' ? parsed.autoFocusCamera : defaults.autoFocusCamera,
      twoStepConfirm:
        typeof parsed.twoStepConfirm === 'boolean' ? parsed.twoStepConfirm : defaults.twoStepConfirm,
      colorblindPips:
        typeof parsed.colorblindPips === 'boolean' ? parsed.colorblindPips : defaults.colorblindPips,
      highContrastBorders:
        typeof parsed.highContrastBorders === 'boolean'
          ? parsed.highContrastBorders
          : defaults.highContrastBorders,
      hapticsEnabled:
        typeof parsed.hapticsEnabled === 'boolean' ? parsed.hapticsEnabled : defaults.hapticsEnabled,
    };
  } catch {
    return defaults;
  }
}

export function saveAccessibilityPrefs(prefs: AccessibilityPrefs): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACCESSIBILITY_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage quota errors
  }
}
