import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeAutoFocusCameraTransform,
  computeLoupeAnchorPosition,
  cycleSemanticZoomLevel,
  detectPhysicalScreenProfile,
  getEnemyRolePip,
  getNodeCornerPip,
  getTileCornerPip,
  resolveSemanticZoomLoD,
} from './accessibilityAndScale';

test('detectPhysicalScreenProfile distinguishes 6-inch mobile phone from 27-inch desktop monitor', () => {
  const mobile = detectPhysicalScreenProfile(390, 844, 3, true);
  assert.equal(mobile.isPhysicallySmallScreen, true);
  assert.equal(mobile.defaultAutoFocusCamera, true);
  assert.equal(mobile.defaultHighContrastBorders, true);
  assert.ok(mobile.physicalScaleFactor > 1.05, 'mobile physical scale should boost small screen legibility');

  const desktop = detectPhysicalScreenProfile(1440, 900, 1, false);
  assert.equal(desktop.isPhysicallySmallScreen, false);
  assert.equal(desktop.defaultAutoFocusCamera, false);
  assert.equal(desktop.defaultHighContrastBorders, false);
  assert.equal(desktop.physicalScaleFactor, 1.0);
});

test('double-coded corner suit pips assign unique geometric shapes and symbols per tile & node type', () => {
  const atk = getTileCornerPip('attack');
  const def = getTileCornerPip('defense');
  const tech = getTileCornerPip('tech');

  assert.notEqual(atk.symbol, def.symbol);
  assert.notEqual(def.symbol, tech.symbol);
  assert.notEqual(atk.symbol, tech.symbol);
  assert.equal(atk.symbol, '◆');
  assert.equal(def.symbol, '●');
  assert.equal(tech.symbol, '▲');

  const combatNode = getNodeCornerPip('COMBAT');
  const clinicNode = getNodeCornerPip('CYBER_CLINIC');
  const medNode = getNodeCornerPip('MED_BAY');
  assert.equal(combatNode.symbol, '◆');
  assert.equal(clinicNode.symbol, '⬡');
  assert.equal(medNode.symbol, '✚');

  const bossPip = getEnemyRolePip('boss');
  assert.equal(bossPip.symbol, '◉');
});

test('resolveSemanticZoomLoD swaps prose for bold silhouettes in overview and enlarges details in closeup', () => {
  const overview = resolveSemanticZoomLoD('overview', false);
  assert.equal(overview.showSecondaryProse, false);
  assert.equal(overview.showMicroBadges, false);
  assert.equal(overview.showLargeSilhouettes, true);
  assert.equal(overview.mapNodeCompactMode, true);

  const closeup = resolveSemanticZoomLoD('closeup', false);
  assert.equal(closeup.showSecondaryProse, true);
  assert.equal(closeup.showMicroBadges, true);
  assert.ok(closeup.tileHeightScale > 1.1);

  assert.equal(cycleSemanticZoomLevel('standard'), 'overview');
  assert.equal(cycleSemanticZoomLevel('overview'), 'closeup');
  assert.equal(cycleSemanticZoomLevel('closeup'), 'standard');
});

test('computeAutoFocusCameraTransform zooms ~18% into active combat quadrant when enabled', () => {
  const idle = computeAutoFocusCameraTransform({
    enabled: true,
    stageW: 1200,
    stageH: 420,
    activeColor: null,
    inspectedTarget: null,
    heroX: 260,
    frontEnemyX: 780,
    inspectedEnemyX: null,
    groundY: 330,
  });
  assert.equal(idle.zoom, 1);
  assert.equal(idle.panX, 0);
  assert.equal(idle.activeQuadrant, 'idle');

  const attackFocus = computeAutoFocusCameraTransform({
    enabled: true,
    stageW: 1200,
    stageH: 420,
    activeColor: 'attack',
    inspectedTarget: null,
    heroX: 260,
    frontEnemyX: 820,
    inspectedEnemyX: null,
    groundY: 330,
  });
  assert.equal(attackFocus.zoom, 1.18);
  assert.equal(attackFocus.activeQuadrant, 'front_enemy');
  assert.notEqual(attackFocus.panX, 0);

  const disabledFocus = computeAutoFocusCameraTransform({
    enabled: false,
    stageW: 1200,
    stageH: 420,
    activeColor: 'attack',
    inspectedTarget: null,
    heroX: 260,
    frontEnemyX: 820,
    inspectedEnemyX: null,
    groundY: 330,
  });
  assert.equal(disabledFocus.zoom, 1);
});

test('computeLoupeAnchorPosition offsets Loupe readout well above finger so thumb never covers text', () => {
  // Touching near bottom dock (Y = 740 on 390x844 mobile viewport)
  const dockTouch = computeLoupeAnchorPosition(195, 740, 390, 844, 340, 132);
  assert.ok(dockTouch.topPx + 132 <= 740 - 80, 'Loupe bottom must sit at least 80px above finger Y');
  assert.ok(dockTouch.leftPx >= 12 && dockTouch.leftPx + 340 <= 390 - 12);

  // Touching near top HUD (Y = 80 on 390x844 mobile viewport) flips below finger cleanly
  const topTouch = computeLoupeAnchorPosition(195, 80, 390, 844, 340, 132);
  assert.ok(topTouch.topPx >= 80 + 50, 'When touching near top edge, Loupe must flip below finger');
});
