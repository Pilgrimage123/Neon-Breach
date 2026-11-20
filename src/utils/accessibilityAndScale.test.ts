import test from 'node:test';
import assert from 'node:assert/strict';
import {
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
  const dealerNode = getNodeCornerPip('CHIP_DEALER');
  const medNode = getNodeCornerPip('MED_BAY');
  assert.equal(combatNode.symbol, '◆');
  assert.equal(clinicNode.symbol, '⬡');
  assert.equal(dealerNode.symbol, '◈');
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
