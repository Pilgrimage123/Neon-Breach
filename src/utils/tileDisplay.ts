import type { Tile, TileSpec } from '../engine/types';
import { TRANSLATIONS, type Language } from '../i18n/translations';

export function formatTileShortLabel(tile: TileSpec & Partial<Pick<Tile, 'isBlight'>>, lang: Language): string {
  const t = TRANSLATIONS[lang];
  if (tile.isBlight) {
    return lang === 'cs' ? 'STRUSKA 0' : 'SLAG 0';
  }
  if (tile.type === 'attack') {
    return `${t.atkShort} ${tile.value}`;
  }
  if (tile.type === 'defense') {
    return `${t.defShort} ${tile.value}`;
  }
  const eff = tile.techEffect;
  if (eff?.kind === 'damage_boost') {
    return `+${eff.percent}% ${t.dmgBoostShort}`;
  }
  if (eff?.kind === 'heal') {
    return `+${eff.amount} ${t.hpLabel}`;
  }
  if (eff?.kind === 'armor_shred') {
    return `-${eff.shredAmount} ${t.armorShort} · ${eff.pierceDamage}`;
  }
  if (eff?.kind === 'overdrive_surge') {
    return `+${eff.bonusOverdrive}% ${t.odShort} · -${eff.cleanseCorrode}`;
  }
  if (eff?.kind === 'tactical_shield') {
    return `+${eff.shieldAmount} ${t.defShort} · +${eff.damageBoostPct}%`;
  }
  return t.techName;
}

export function formatTileDetailText(tile: TileSpec & Partial<Pick<Tile, 'isBlight'>>, lang: Language): string {
  const t = TRANSLATIONS[lang];
  if (tile.isBlight) {
    return lang === 'cs'
      ? 'Žíravá struska: Spálí se přes TECH nebo Overdrive (-2 Zdraví za tah při držení)'
      : 'Caustic Slag: Play TECH or Overdrive to purge (-2 HP/round if kept)';
  }
  if (tile.type === 'attack') {
    return `${t.attackName} ${tile.value}`;
  }
  if (tile.type === 'defense') {
    return `${t.defenseName} ${tile.value}`;
  }
  const eff = tile.techEffect;
  if (eff?.kind === 'damage_boost') {
    return lang === 'cs'
      ? `Damage booster +${eff.percent}% (-${eff.decayPerTurn}%/kolo)`
      : `Damage Booster +${eff.percent}% (-${eff.decayPerTurn}%/round)`;
  }
  if (eff?.kind === 'heal') {
    return lang === 'cs'
      ? `Vyleč ${eff.amount} zranění`
      : `Heal ${eff.amount} HP`;
  }
  if (eff?.kind === 'armor_shred') {
    return lang === 'cs'
      ? `Strhni ${eff.shredAmount} Brnění všem + ${eff.pierceDamage} průrazné DMG vpředu`
      : `Shred ${eff.shredAmount} Armor All + ${eff.pierceDamage} Pierce DMG front`;
  }
  if (eff?.kind === 'overdrive_surge') {
    return lang === 'cs'
      ? `+${eff.bonusOverdrive}% Overdrive navíc a očisti ${eff.cleanseCorrode} Koroze`
      : `+${eff.bonusOverdrive}% Bonus Overdrive & Cleanse ${eff.cleanseCorrode} Corrode`;
  }
  if (eff?.kind === 'tactical_shield') {
    return lang === 'cs'
      ? `+${eff.shieldAmount} Štít a +${eff.damageBoostPct}% DMG Boost (-10%/kolo)`
      : `+${eff.shieldAmount} Shield & +${eff.damageBoostPct}% DMG Boost (-10%/round)`;
  }
  return t.techName;
}
