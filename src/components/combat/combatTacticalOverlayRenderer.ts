import { getEffectiveEnemyIntentValue } from '../../engine/reinforcementDirector';
import type {
  CombatState,
  EnemyIntent,
  EnemyUnit,
  HeroState,
  HeroThreatPreview,
  TurnPreview,
} from '../../engine/types';
import { computeEnemyArmorPreview } from './combatEnemyUi';

const FALLBACK_INTENT: EnemyIntent = { kind: 'attack', value: 0 };

export function renderEnemySelectionAndUnderfootBar(params: {
  ctx: CanvasRenderingContext2D;
  enemy: EnemyUnit;
  idx: number;
  enemies: readonly EnemyUnit[];
  frontLivingIdx: number;
  ex: number;
  enemyGroundY: number;
  size: number;
  bottomRatio: number;
  farFootOffsetPx: number;
  isCrawler: boolean;
  isBrute: boolean;
  isDead: boolean;
  hoveredEnemyId: string | null;
  inspectedEnemyId: string | null;
  worldUiAlpha: number;
  activePreview: TurnPreview | null;
  hoveringSwap: boolean;
  w: number;
  h: number;
  elapsed: number;
}): void {
  const {
    ctx,
    enemy,
    idx,
    enemies,
    frontLivingIdx,
    ex,
    enemyGroundY,
    size,
    bottomRatio,
    farFootOffsetPx,
    isCrawler,
    isBrute,
    isDead,
    hoveredEnemyId,
    inspectedEnemyId,
    worldUiAlpha,
    activePreview,
    hoveringSwap,
    w,
    h,
    elapsed,
  } = params;

  const isHighlighted = !isDead && (hoveredEnemyId === enemy.id || inspectedEnemyId === enemy.id);
  if (isHighlighted) {
    const isInspected = inspectedEnemyId === enemy.id;
    const bracketW = Math.max(48, size * (isCrawler ? 0.78 : isBrute ? 0.92 : 0.74));
    const bracketH = Math.max(48, size * Math.min(0.95, bottomRatio));
    const bx0 = Math.max(4, ex - bracketW * 0.5);
    const bx1 = Math.min(w - 4, ex + bracketW * 0.5);
    const by0 = Math.max(12, enemyGroundY - bracketH - 2);
    const by1 = Math.min(h - 6, enemyGroundY + 3);
    const arm = Math.min(13, bracketW * 0.22);

    ctx.save();
    ctx.strokeStyle = isInspected
      ? 'rgba(0, 240, 255, 0.92)'
      : 'rgba(165, 243, 252, 0.72)';
    ctx.lineWidth = isInspected ? 2 : 1.5;
    ctx.beginPath();
    ctx.moveTo(bx0, by0 + arm);
    ctx.lineTo(bx0, by0);
    ctx.lineTo(bx0 + arm, by0);
    ctx.moveTo(bx1 - arm, by0);
    ctx.lineTo(bx1, by0);
    ctx.lineTo(bx1, by0 + arm);
    ctx.moveTo(bx0, by1 - arm);
    ctx.lineTo(bx0, by1);
    ctx.lineTo(bx0 + arm, by1);
    ctx.moveTo(bx1 - arm, by1);
    ctx.lineTo(bx1, by1);
    ctx.lineTo(bx1, by1 - arm);
    ctx.stroke();

    ctx.strokeStyle = isInspected
      ? 'rgba(0, 240, 255, 0.65)'
      : 'rgba(165, 243, 252, 0.4)';
    ctx.lineWidth = isInspected ? 2 : 1.25;
    ctx.beginPath();
    ctx.ellipse(ex, enemyGroundY - farFootOffsetPx * 0.3, isBrute ? size * 0.48 : size * 0.38, isBrute ? 12 : 10, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  if (!isDead && worldUiAlpha > 0.02) {
    ctx.save();
    ctx.globalAlpha *= worldUiAlpha;
    const armorPreview = computeEnemyArmorPreview(
      enemy,
      idx,
      frontLivingIdx,
      activePreview,
      enemies,
    );
    const {
      rawPreviewDmg,
      willCrackShieldPip,
      willBreakArmor,
      armorAbsorbed,
      remainingArmor,
      previewHpLoss,
      projectedHp,
      willTriggerPhaseGate,
      willDie,
      chainedBurstDmg,
    } = armorPreview;
    const hasArmor = enemy.armor > 0;
    const hasPips = (enemy.shieldPips ?? 0) > 0;

    if (willDie && enemy.passive === 'volatile_burst' && enemies.length > 1) {
      const burstPulse = 0.55 + 0.45 * Math.sin(elapsed * 9);
      ctx.save();
      ctx.strokeStyle = `rgba(163, 230, 53, ${0.55 + 0.35 * burstPulse})`;
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(ex, enemyGroundY - 2, size * 0.52, 14, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    const barW =
      w < 460
        ? enemy.archetype === 'boss'
          ? 70
          : enemy.archetype === 'brute'
            ? 64
            : 56
        : h < 220
          ? enemy.archetype === 'boss'
            ? 82
            : enemy.archetype === 'brute'
              ? 78
              : 66
          : enemy.archetype === 'boss'
            ? 96
            : enemy.archetype === 'brute'
              ? 88
              : 76;
    const barH = rawPreviewDmg > 0 ? 7 : 5;
    const barX = Math.max(hasArmor ? 18 : 4, Math.min(w - barW - 4, Math.round(ex - barW * 0.5)));
    const minTopOffset = hasArmor ? 14 : 6;
    const barY = Math.max(
      minTopOffset,
      Math.min(h - (rawPreviewDmg > 0 ? 19 : 9), Math.round(enemyGroundY + 7)),
    );
    const safeMaxHp = Math.max(1, enemy.maxHp);
    const curRatio = Math.max(0, Math.min(1, enemy.hp / safeMaxHp));
    const projRatio = Math.max(0, Math.min(1, projectedHp / safeMaxHp));
    const pulse = 0.55 + 0.45 * Math.sin(elapsed * 10);

    if (hasArmor) {
      const armorBarH = 4;
      const armorBarY = barY - armorBarH - 2;
      const armorFullRatio = Math.max(0.22, Math.min(1, enemy.armor / Math.max(enemy.armor, 10)));
      const armorRemRatio = willBreakArmor
        ? 0
        : armorFullRatio * (remainingArmor / Math.max(1, enemy.armor));

      ctx.fillStyle = 'rgba(2, 6, 23, 0.94)';
      ctx.fillRect(barX - 1, armorBarY - 1, barW + 2, armorBarH + 2);

      if (armorRemRatio > 0) {
        ctx.fillStyle = '#FFC700';
        ctx.fillRect(barX, armorBarY, barW * armorRemRatio, armorBarH);
      }

      if (rawPreviewDmg > 0 && armorFullRatio > armorRemRatio) {
        ctx.fillStyle = willBreakArmor
          ? `rgba(255, 46, 126, ${0.75 + 0.25 * pulse})`
          : `rgba(254, 240, 138, ${0.72 + 0.28 * pulse})`;
        ctx.fillRect(
          barX + barW * armorRemRatio,
          armorBarY,
          barW * (armorFullRatio - armorRemRatio),
          armorBarH,
        );
      }

      ctx.strokeStyle = willBreakArmor
        ? `rgba(255, 46, 126, ${0.8 + 0.2 * pulse})`
        : 'rgba(255, 199, 0, 0.85)';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX - 0.5, armorBarY - 0.5, barW + 1, armorBarH + 1);

      const crestX = barX - 10.5;
      const crestY = barY + 0.5;
      const crestR = 9.6;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(crestX, crestY - crestR);
      ctx.lineTo(crestX + crestR * 0.88, crestY - crestR * 0.42);
      ctx.lineTo(crestX + crestR * 0.88, crestY + crestR * 0.32);
      ctx.lineTo(crestX, crestY + crestR);
      ctx.lineTo(crestX - crestR * 0.88, crestY + crestR * 0.32);
      ctx.lineTo(crestX - crestR * 0.88, crestY - crestR * 0.42);
      ctx.closePath();
      ctx.fillStyle = willBreakArmor ? '#3B0A22' : '#1B1406';
      ctx.fill();
      ctx.strokeStyle = willBreakArmor ? '#FF2E7E' : '#FFC700';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      ctx.font = '700 11.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = willBreakArmor ? '#FF85B3' : armorAbsorbed > 0 ? '#FEF08A' : '#FFC700';
      const crestText = willBreakArmor
        ? '0'
        : String(armorAbsorbed > 0 ? remainingArmor : enemy.armor);
      ctx.fillText(crestText, crestX, crestY + 0.5);
      ctx.restore();
    }

    if (hasPips) {
      const pipX = Math.min(w - 7, barX + barW + 8);
      const pipY = barY + barH * 0.5;
      const pipR = 6.2;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(pipX, pipY - pipR);
      ctx.lineTo(pipX + pipR, pipY);
      ctx.lineTo(pipX, pipY + pipR);
      ctx.lineTo(pipX - pipR, pipY);
      ctx.closePath();
      ctx.fillStyle = willCrackShieldPip ? '#4C0519' : '#083344';
      ctx.fill();
      ctx.strokeStyle = willCrackShieldPip ? '#FF2E7E' : '#00F0FF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(pipX, pipY, 2, 0, Math.PI * 2);
      ctx.fillStyle = willCrackShieldPip ? '#FDA4AF' : '#E0F2FE';
      ctx.fill();
      ctx.restore();
    }

    ctx.fillStyle = 'rgba(2, 6, 23, 0.88)';
    ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

    if (projRatio > 0) {
      ctx.fillStyle = '#FF2E7E';
      ctx.fillRect(barX, barY, barW * projRatio, barH);
    }

    if (previewHpLoss > 0 && curRatio > projRatio) {
      ctx.fillStyle = willDie
        ? `rgba(255, 199, 0, ${0.75 + 0.25 * pulse})`
        : `rgba(253, 224, 71, ${0.7 + 0.3 * pulse})`;
      ctx.fillRect(
        barX + barW * projRatio,
        barY,
        barW * (curRatio - projRatio),
        barH,
      );
    }

    if (enemy.phaseGatePct && !enemy.phaseGateTriggered) {
      const gateX = barX + barW * (enemy.phaseGatePct / 100);
      ctx.fillStyle = '#00F0FF';
      ctx.fillRect(gateX - 1, barY - 1, 2, barH + 2);
    }

    ctx.strokeStyle = willDie
      ? `rgba(255, 46, 126, ${0.75 + 0.25 * pulse})`
      : willCrackShieldPip
        ? `rgba(0, 240, 255, ${0.8 + 0.2 * pulse})`
        : rawPreviewDmg > 0
          ? 'rgba(255, 199, 0, 0.85)'
          : 'rgba(226, 232, 240, 0.35)';
    ctx.lineWidth = willDie || willCrackShieldPip ? 1.5 : 1;
    ctx.strokeRect(barX - 0.5, barY - 0.5, barW + 1, barH + 1);

    if (rawPreviewDmg > 0) {
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      let label = `-${previewHpLoss}`;
      let labelColor = '#FDA4AF';
      if (willCrackShieldPip) {
        label = '◆ -1';
        labelColor = '#67E8F9';
      } else if (willDie) {
        label =
          enemy.passive === 'volatile_burst' && enemies.length > 1
            ? `☠ 💥-6`
            : `☠ -${previewHpLoss}`;
        labelColor = enemy.passive === 'volatile_burst' ? '#BEF264' : '#FFC700';
      } else if (willTriggerPhaseGate) {
        label = `50% -${previewHpLoss}`;
        labelColor = '#FDE047';
      } else if (chainedBurstDmg > 0) {
        label = `-${previewHpLoss} 💥`;
        labelColor = '#BEF264';
      } else if (willBreakArmor) {
        label = `🛡0 · -${previewHpLoss}`;
        labelColor = '#FFC700';
      } else if (armorAbsorbed > 0 && previewHpLoss === 0) {
        label = `🛡-${armorAbsorbed}`;
        labelColor = '#FFC700';
      } else if (armorAbsorbed > 0) {
        label = `-${previewHpLoss} (-${armorAbsorbed})`;
        labelColor = '#FDA4AF';
      }
      ctx.strokeStyle = 'rgba(2, 6, 23, 0.92)';
      ctx.lineWidth = 3;
      ctx.strokeText(label, ex, barY + barH + 11);
      ctx.fillStyle = labelColor;
      ctx.fillText(label, ex, barY + barH + 11);
    }

    const livingOrderIdx = enemies.slice(0, idx + 1).filter((e) => e.hp > 0).length - 1;
    const swapKillsThisUnit =
      hoveringSwap &&
      (livingOrderIdx === 0 || livingOrderIdx === 1) &&
      enemy.armor + enemy.hp <= 2;

    if (willDie || swapKillsThisUnit) {
      const skullY = Math.max(24, enemyGroundY - size * 0.72 + Math.sin(elapsed * 7) * 3);
      ctx.save();
      ctx.fillStyle = 'rgba(24, 26, 32, 0.94)';
      ctx.strokeStyle = '#FF2E7E';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(ex, skullY, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.font = '900 18px "Chakra Petch", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#F4F4F6';
      ctx.fillText('☠', ex, skullY + 1);
      ctx.restore();
    }
    ctx.restore();
  }
}

export function renderIntentVectorsAndSwapPass(params: {
  ctx: CanvasRenderingContext2D;
  combat: CombatState;
  hero: HeroState;
  enemies: readonly EnemyUnit[];
  slotCenters: readonly number[];
  enemyBaseX: number;
  enemyStepX: number;
  heroX: number;
  heroTargetHeight: number;
  groundY: number;
  baseScale: number;
  worldUiAlpha: number;
  tacticalViewActive: boolean;
  hoveringSwap: boolean;
  activePreview: TurnPreview | null;
  precomputedThreat?: HeroThreatPreview;
  elapsed: number;
}): void {
  const {
    ctx,
    combat,
    hero,
    enemies,
    slotCenters,
    enemyBaseX,
    enemyStepX,
    heroX,
    heroTargetHeight,
    groundY,
    baseScale,
    worldUiAlpha,
    tacticalViewActive,
    hoveringSwap,
    activePreview,
    precomputedThreat,
    elapsed,
  } = params;

  if (hero.hp > 0 && worldUiAlpha > 0.02) {
    const heroTargetX = heroX + 18 * baseScale;
    const heroTargetY = groundY - heroTargetHeight * 0.46;
    for (let idx = 0; idx < enemies.length; idx++) {
      const enemy = enemies[idx];
      if (
        enemy.hp <= 0 ||
        enemy.escaped ||
        enemy.propKind ||
        enemy.isLootRunner ||
        enemy.staggered ||
        (enemy.sleepCounter !== undefined && enemy.sleepCounter > 0)
      ) {
        continue;
      }
      const intent = enemy.intentCycle[enemy.currentIntentIndex];
      if (!intent) continue;
      const isOffensive =
        intent.kind === 'attack' ||
        intent.kind === 'heavy' ||
        intent.kind === 'acid' ||
        intent.kind === 'leech';
      if (!isOffensive) continue;

      const ex = enemyBaseX + (slotCenters[idx] ?? idx) * enemyStepX;
      const ey = groundY - (idx % 2 === 1 ? 6 : 0) - 68 * baseScale;
      const effectiveVal = getEffectiveEnemyIntentValue(enemy, intent, {
        shieldAfterPlayer: precomputedThreat?.shieldAfterPlayer ?? hero.shield,
        colorPlayed: activePreview?.tileCount ? activePreview.color : null,
        battlefieldRule: combat.battlefieldRule,
      });
      if (effectiveVal <= 0) continue;
      const isAcid = intent.kind === 'acid';
      const strokeRgb = isAcid ? '132, 204, 22' : '255, 46, 126';
      const pulse = 0.55 + 0.45 * Math.sin(elapsed * 4.5 + idx);
      const ctrlX = (ex + heroTargetX) * 0.5;
      const ctrlY = Math.min(ey, heroTargetY) - (26 + idx * 14);

      ctx.save();
      ctx.globalAlpha *= worldUiAlpha;
      ctx.strokeStyle = `rgba(${strokeRgb}, ${tacticalViewActive ? 0.85 : 0.42 + 0.25 * pulse})`;
      ctx.lineWidth = tacticalViewActive ? 2.6 : 2.0;
      ctx.setLineDash([7, 5]);
      ctx.beginPath();
      ctx.moveTo(ex - 16, ey);
      ctx.quadraticCurveTo(ctrlX, ctrlY, heroTargetX, heroTargetY);
      ctx.stroke();
      ctx.setLineDash([]);

      const angle = Math.atan2(heroTargetY - ctrlY, heroTargetX - ctrlX);
      ctx.fillStyle = isAcid ? '#84CC16' : '#FF2E7E';
      ctx.beginPath();
      ctx.moveTo(heroTargetX, heroTargetY);
      ctx.lineTo(
        heroTargetX - 10 * Math.cos(angle - Math.PI / 6),
        heroTargetY - 10 * Math.sin(angle - Math.PI / 6),
      );
      ctx.lineTo(
        heroTargetX - 10 * Math.cos(angle + Math.PI / 6),
        heroTargetY - 10 * Math.sin(angle + Math.PI / 6),
      );
      ctx.closePath();
      ctx.fill();

      const midX = 0.25 * (ex - 16) + 0.5 * ctrlX + 0.25 * heroTargetX;
      const midY = 0.25 * ey + 0.5 * ctrlY + 0.25 * heroTargetY;
      const multSuffix = intent.overwhelmMultiplier ? `×${intent.overwhelmMultiplier}` : '';
      const badgeIcon = isAcid ? '☣' : intent.pierceShield ? '🗡' : '⚔';
      const badgeLabel = `${badgeIcon} ${effectiveVal}${multSuffix}`;
      ctx.font = '900 13px "JetBrains Mono", monospace';
      const tw = ctx.measureText(badgeLabel).width;
      const pw = tw + 12;
      const ph = 20;
      ctx.fillStyle = '#181A20';
      ctx.strokeStyle = isAcid ? '#84CC16' : '#FF2E7E';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(midX - pw * 0.5, midY - ph * 0.5, pw, ph, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#F4F4F6';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeLabel, midX, midY + 0.5);
      ctx.restore();
    }
  }

  if (hoveringSwap) {
    const livingIndices: number[] = [];
    for (let i = 0; i < enemies.length; i++) {
      if (enemies[i].hp > 0) livingIndices.push(i);
    }
    if (livingIndices.length >= 2) {
      const idxA = livingIndices[0];
      const idxB = livingIndices[1];
      const xA = enemyBaseX + (slotCenters[idxA] ?? idxA) * enemyStepX;
      const xB = enemyBaseX + (slotCenters[idxB] ?? idxB) * enemyStepX;
      const yArc = groundY - 112 * baseScale;
      const midSwapX = (xA + xB) * 0.5;

      ctx.save();
      ctx.strokeStyle = '#FFC700';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(xA, yArc);
      ctx.quadraticCurveTo(midSwapX, yArc - 34, xB, yArc);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#FFC700';
      ctx.beginPath();
      ctx.moveTo(xB, yArc);
      ctx.lineTo(xB - 10, yArc - 7);
      ctx.lineTo(xB - 4, yArc - 12);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(xA, yArc);
      ctx.lineTo(xA + 10, yArc - 7);
      ctx.lineTo(xA + 4, yArc - 12);
      ctx.closePath();
      ctx.fill();

      const swapTag = '⇄ SWAP · 0 AP';
      ctx.font = '900 13px "JetBrains Mono", monospace';
      const sw = ctx.measureText(swapTag).width + 14;
      const sh = 22;
      ctx.fillStyle = '#181A20';
      ctx.strokeStyle = '#FFC700';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(midSwapX - sw * 0.5, yArc - 34 - sh * 0.5, sw, sh, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#F4F4F6';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(swapTag, midSwapX, yArc - 34 + 0.5);
      ctx.restore();
    }
  }
}

export function renderTacticalViewPlaquesPass(params: {
  ctx: CanvasRenderingContext2D;
  hero: HeroState;
  isProne: boolean;
  heroX: number;
  groundY: number;
  heroTargetHeight: number;
  enemies: readonly EnemyUnit[];
  slotCenters: readonly number[];
  enemyBaseX: number;
  enemyStepX: number;
  frontLivingIdx: number;
  w: number;
  h: number;
}): void {
  const {
    ctx,
    hero,
    isProne,
    heroX,
    groundY,
    heroTargetHeight,
    enemies,
    slotCenters,
    enemyBaseX,
    enemyStepX,
    frontLivingIdx,
    w,
    h,
  } = params;

  ctx.save();
  if (hero.hp > 0 && !isProne) {
    const hPlaqueW = 122;
    const hPlaqueH = 30;
    const hpx = Math.max(8, Math.round(heroX - hPlaqueW * 0.5));
    const hpy = Math.max(38, Math.round(groundY - heroTargetHeight - 18));
    ctx.fillStyle = '#020617';
    ctx.fillRect(hpx - 2, hpy - 2, hPlaqueW + 4, hPlaqueH + 4);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.strokeRect(hpx, hpy, hPlaqueW, hPlaqueH);
    ctx.font = '800 13px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    const shText = hero.shield > 0 ? ` ●${hero.shield}` : '';
    ctx.fillText(`★ ${hero.hp}/${hero.maxHp}${shText}`, hpx + hPlaqueW * 0.5, hpy + hPlaqueH * 0.5);
  }

  for (let idx = 0; idx < enemies.length; idx++) {
    const enemy = enemies[idx];
    if (enemy.hp <= 0) continue;
    const ex = enemyBaseX + (slotCenters[idx] ?? idx) * enemyStepX;
    const enemyGroundY = groundY - (idx % 2 === 1 ? 6 : 0);
    const baseEnemySize = Math.min(h * (h < 220 ? 0.51 : 0.53), w * 0.27, 206);
    const ePlaqueW = 136;
    const ePlaqueH = 44;
    const epx = Math.max(8, Math.min(w - ePlaqueW - 8, Math.round(ex - ePlaqueW * 0.5)));
    const epy = Math.max(42, Math.round(enemyGroundY - baseEnemySize * 0.94));

    const intent =
      enemy.intentCycle[enemy.currentIntentIndex] ??
      enemy.intentCycle[0] ??
      FALLBACK_INTENT;
    const pipSymbol =
      enemy.archetype === 'larva'
        ? '▲'
        : enemy.archetype === 'skitter'
          ? '●'
          : enemy.archetype === 'stinger'
            ? '★'
            : enemy.archetype === 'stalker'
              ? '◆'
              : enemy.archetype === 'spitter'
                ? '⬡'
                : enemy.archetype === 'brute'
                  ? '■'
                  : '◉';

    ctx.fillStyle = '#020617';
    ctx.fillRect(epx - 2, epy - 2, ePlaqueW + 4, ePlaqueH + 4);
    ctx.strokeStyle = idx === frontLivingIdx ? '#FFC700' : '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.strokeRect(epx, epy, ePlaqueW, ePlaqueH);

    ctx.font = '800 13px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    const armTxt = enemy.armor > 0 ? ` ■${enemy.armor}` : '';
    const pipTxt = enemy.shieldPips > 0 ? ` ◆${enemy.shieldPips}` : '';
    ctx.fillText(
      `${pipSymbol} ${enemy.hp}HP${armTxt}${pipTxt}`,
      epx + ePlaqueW * 0.5,
      epy + 13,
    );

    ctx.font = '800 12px "JetBrains Mono", monospace';
    ctx.fillStyle =
      intent.kind === 'attack' || intent.kind === 'heavy'
        ? '#FDA4AF'
        : intent.kind === 'acid'
          ? '#BEF264'
          : '#FDE047';
    const intentVal = intent.value + (enemy.enrageAtkBonus ?? 0);
    const corTag = intent.corrodeAmount ? ` +${intent.corrodeAmount}C` : '';
    const armTag = intent.armorOnHit ? ` +${intent.armorOnHit}A` : '';
    const intentTxt =
      intent.kind === 'charge'
        ? `★ CHG (${intent.secondaryValue ?? 1}T→${intentVal})`
        : intent.kind === 'armor' || intent.kind === 'bolster'
          ? intent.secondaryValue && intent.secondaryValue > 0
            ? `● +${intent.value}A +${intent.secondaryValue}HP`
            : `● +${intent.value} ARM`
          : `◆ ${intentVal} DMG${corTag}${armTag}`;
    ctx.fillText(intentTxt, epx + ePlaqueW * 0.5, epy + 31);
  }
  ctx.restore();
}
