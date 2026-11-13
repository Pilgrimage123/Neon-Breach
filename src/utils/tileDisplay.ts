import type { TileSpec } from '../engine/types';
import { TRANSLATIONS, type Language } from '../i18n/translations';

export function formatTileShortLabel(tile: TileSpec, lang: Language): string {
  const t = TRANSLATIONS[lang];
  if (tile.type === 'attack') {
    return `${t.atkShort} ${tile.value}`;
  }
  if (tile.type === 'defense') {
    return `${t.defShort} ${tile.value}`;
  }
  if (tile.techEffect?.kind === 'damage_boost') {
    return `+${tile.techEffect.percent}% ${t.dmgBoostShort}`;
  }
  if (tile.techEffect?.kind === 'heal') {
    return `+${tile.techEffect.amount} ${t.hpLabel}`;
  }
  return t.techName;
}

export function formatTileDetailText(tile: TileSpec, lang: Language): string {
  const t = TRANSLATIONS[lang];
  if (tile.type === 'attack') {
    return `${t.attackName} ${tile.value}`;
  }
  if (tile.type === 'defense') {
    return `${t.defenseName} ${tile.value}`;
  }
  if (tile.techEffect?.kind === 'damage_boost') {
    return lang === 'cs'
      ? `Damage booster +${tile.techEffect.percent}% (-${tile.techEffect.decayPerTurn}%/kolo)`
      : `Damage Booster +${tile.techEffect.percent}% (-${tile.techEffect.decayPerTurn}%/round)`;
  }
  if (tile.techEffect?.kind === 'heal') {
    return lang === 'cs'
      ? `Vyleč ${tile.techEffect.amount} zranění`
      : `Heal ${tile.techEffect.amount} HP`;
  }
  return t.techName;
}
