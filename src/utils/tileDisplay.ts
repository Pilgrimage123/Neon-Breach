import type { Tile, TileSpec } from '../engine/types';
import { TRANSLATIONS, type Language } from '../i18n/translations';

export function formatTileShortLabel(
  tile: TileSpec & Partial<Pick<Tile, 'isBlight' | 'isDud' | 'upcharge'>>,
  lang: Language,
): string {
  const t = TRANSLATIONS[lang];
  if (tile.isBlight) {
    return lang === 'cs' ? 'STRUSKA 0' : 'SLAG 0';
  }
  const ucSuffix = (tile.upcharge ?? 0) > 0 ? ` · +${tile.upcharge} UC` : '';
  if (tile.isDud) {
    return `DUD 0${ucSuffix}`;
  }
  if (tile.type === 'attack') {
    return `${t.atkShort} ${tile.value}${ucSuffix}`;
  }
  if (tile.type === 'defense') {
    return `${t.defShort} ${tile.value}${ucSuffix}`;
  }
  const eff = tile.techEffect;
  if (eff?.kind === 'damage_boost') {
    return `+${eff.percent}% ${t.dmgBoostShort}${ucSuffix}`;
  }
  if (eff?.kind === 'heal') {
    return `+${eff.amount} ${t.hpLabel}${ucSuffix}`;
  }
  if (eff?.kind === 'armor_shred') {
    return `-${eff.shredAmount} ${t.armorShort} · ${eff.pierceDamage}${ucSuffix}`;
  }
  if (eff?.kind === 'overdrive_surge') {
    return `+${eff.bonusOverdrive}% ${t.odShort} · -${eff.cleanseCorrode}${ucSuffix}`;
  }
  if (eff?.kind === 'tactical_shield') {
    return `+${eff.shieldAmount} ${t.defShort} · +${eff.damageBoostPct}%${ucSuffix}`;
  }
  return `${t.techName}${ucSuffix}`;
}

export function formatTileDetailText(
  tile: TileSpec & Partial<Pick<Tile, 'isBlight' | 'isDud' | 'upcharge'>>,
  lang: Language,
): string {
  const t = TRANSLATIONS[lang];
  if (tile.isBlight) {
    return lang === 'cs'
      ? 'Žíravá struska: Spálí se přes TECH nebo Overdrive (-2 Zdraví za tah při držení)'
      : 'Caustic Slag: Play TECH or Overdrive to purge (-2 HP/round if kept)';
  }
  const ucText =
    (tile.upcharge ?? 0) > 0
      ? lang === 'cs'
        ? ` · +${tile.upcharge} UpCharge (+${tile.upcharge} dílek příští tah)`
        : ` · +${tile.upcharge} UpCharge (+${tile.upcharge} drawn next turn)`
      : '';
  if (tile.isDud) {
    return (
      (lang === 'cs'
        ? 'Prázdný dílek (Dud): Bez základního efektu, ale počítá se do barvy a Přetížení'
        : 'Dud Tile: No base effect, but still counts for color, Surge & Overdrive') + ucText
    );
  }
  if (tile.type === 'attack') {
    return `${t.attackName} ${tile.value}${ucText}`;
  }
  if (tile.type === 'defense') {
    return `${t.defenseName} ${tile.value}${ucText}`;
  }
  const eff = tile.techEffect;
  if (eff?.kind === 'damage_boost') {
    return (
      (lang === 'cs'
        ? `Damage booster +${eff.percent}% (-${eff.decayPerTurn}%/kolo)`
        : `Damage Booster +${eff.percent}% (-${eff.decayPerTurn}%/round)`) + ucText
    );
  }
  if (eff?.kind === 'heal') {
    return (lang === 'cs' ? `Vyleč ${eff.amount} zranění` : `Heal ${eff.amount} HP`) + ucText;
  }
  if (eff?.kind === 'armor_shred') {
    return (
      (lang === 'cs'
        ? `Strhni ${eff.shredAmount} Brnění všem + ${eff.pierceDamage} průrazné DMG vpředu`
        : `Shred ${eff.shredAmount} Armor All + ${eff.pierceDamage} Pierce DMG front`) + ucText
    );
  }
  if (eff?.kind === 'overdrive_surge') {
    return (
      (lang === 'cs'
        ? `+${eff.bonusOverdrive}% Overdrive navíc a očisti ${eff.cleanseCorrode} Koroze`
        : `+${eff.bonusOverdrive}% Bonus Overdrive & Cleanse ${eff.cleanseCorrode} Corrode`) + ucText
    );
  }
  if (eff?.kind === 'tactical_shield') {
    return (
      (lang === 'cs'
        ? `+${eff.shieldAmount} Štít a +${eff.damageBoostPct}% DMG Boost (-10%/kolo)`
        : `+${eff.shieldAmount} Shield & +${eff.damageBoostPct}% DMG Boost (-10%/round)`) + ucText
    );
  }
  return `${t.techName}${ucText}`;
}
