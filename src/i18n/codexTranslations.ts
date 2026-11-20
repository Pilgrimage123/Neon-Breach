import { CS_CODEX_TRANSLATIONS } from './codex/cs';
import { EN_CODEX_TRANSLATIONS } from './codex/en';
import type { CodexTranslationPack } from './codex/types';

export type {
  CodexTranslationPack,
  GlossaryCategory,
  GlossaryEntryText,
  GlossaryTermId,
  HeroCodexText,
  HeroPowerDetail,
} from './codex/types';

export const CODEX_TRANSLATIONS: Record<'en' | 'cs', CodexTranslationPack> = {
  en: EN_CODEX_TRANSLATIONS,
  cs: CS_CODEX_TRANSLATIONS,
};
