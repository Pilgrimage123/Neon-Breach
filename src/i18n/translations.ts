import { CS_TRANSLATIONS } from './locales/cs';
import { EN_TRANSLATIONS } from './locales/en';
import type { Language, TranslationPack } from './types';

export type {
  CharacterTranslation,
  EnemyArchetypeTranslation,
  EnemyPassiveTranslation,
  HowToPlayTranslations,
  Language,
  MapNodeSetTranslation,
  NamedDescriptionTranslation,
  TranslationPack,
  TranslationSet,
} from './types';

export const TRANSLATIONS: Record<Language, TranslationPack> = {
  en: EN_TRANSLATIONS,
  cs: CS_TRANSLATIONS,
};
