/**
 * Superficie publica do motor linguistico de analise de texto do MCP.
 *
 * Uso tipico (tool analyze_text_against_library):
 *   const db = createUserScopedDb(ctx);
 *   const source = createSupabaseVocabularySource(db, scope);
 *   const result = await analyzeTextAgainstLibrary({ text, source, filters });
 */

export * from "./types";
export {
  INVENTORY_PAGE_SIZE,
  MAX_INVENTORY_PAGES,
  MAX_INVENTORY_CARDS,
  INVENTORY_CACHE_TTL_MS,
  INVENTORY_CACHE_MAX_ENTRIES,
  buildVocabularyInventory,
  buildVocabularyIndex,
  invalidateVocabularyInventory,
  fingerprintEntries,
  toVocabularyEntry,
  fnv1a,
  vocabularyInventoryCacheSize,
  type BuildInventoryOptions,
  type InventoryResult,
} from "./inventory";
export {
  analyzeTextAgainstLibrary,
  MAX_TEXT_CHARS,
  MAX_TEXT_TOKENS,
  MAX_EXPRESSION_TOKENS,
  MAX_CANDIDATES,
  MAX_FILTER_IDS,
  type AnalyzeTextOptions,
} from "./analyze";
export { createSupabaseVocabularySource, INVENTORY_CARD_SELECT } from "./supabaseSource";
export {
  tokenizeText,
  normalizeSurface,
  normalizeTerm,
  stripAccents,
  casefold,
  phraseVariants,
  tokenVariants,
  editDistanceAtMost,
  sentenceAround,
  type TextToken,
} from "./normalize";
export { lemmaKeys, phraseLemmaKeys } from "./lemmas";
export {
  BASIC_FUNCTION_WORDS,
  COMMON_PHRASAL,
  PHRASAL_PARTICLES,
  STRONG_PARTICLES,
  detectLanguage,
  isBasicFunctionWord,
  isBasicMwe,
} from "./language";
