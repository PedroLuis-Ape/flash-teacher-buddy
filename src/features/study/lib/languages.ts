/**
 * Centralized language registry — single source of truth for language
 * codes, BCP-47 conversion, labels and flags across the study system.
 *
 * All previously-duplicated maps (in `resolveStudySides.ts`, `gameCore.ts`,
 * `useTTS.ts`, `ListStudyTypeSelector.tsx`) should delegate here.
 */

export interface LanguageEntry {
  /** Short ISO code stored in the DB (e.g. "en", "pt", "es"). */
  code: string;
  /** Canonical BCP-47 locale tag for this short code (e.g. "en-US"). */
  bcp47: string;
  /** Native display name (e.g. "English", "Português"). */
  label: string;
  /** Emoji flag for UI affordances. */
  flag: string;
}

export const SUPPORTED_LANGUAGES: LanguageEntry[] = [
  { code: "en", bcp47: "en-US", label: "English",   flag: "🇺🇸" },
  { code: "pt", bcp47: "pt-BR", label: "Português", flag: "🇧🇷" },
  { code: "es", bcp47: "es-ES", label: "Español",   flag: "🇪🇸" },
  { code: "fr", bcp47: "fr-FR", label: "Français",  flag: "🇫🇷" },
  { code: "de", bcp47: "de-DE", label: "Deutsch",   flag: "🇩🇪" },
  { code: "it", bcp47: "it-IT", label: "Italiano",  flag: "🇮🇹" },
  { code: "ja", bcp47: "ja-JP", label: "日本語",    flag: "🇯🇵" },
  { code: "zh", bcp47: "zh-CN", label: "中文",      flag: "🇨🇳" },
  { code: "ko", bcp47: "ko-KR", label: "한국어",    flag: "🇰🇷" },
  { code: "ru", bcp47: "ru-RU", label: "Русский",   flag: "🇷🇺" },
  { code: "ar", bcp47: "ar-SA", label: "العربية",   flag: "🇸🇦" },
  { code: "hi", bcp47: "hi-IN", label: "हिन्दी",       flag: "🇮🇳" },
];

const BY_SHORT: Record<string, LanguageEntry> = Object.fromEntries(
  SUPPORTED_LANGUAGES.map((l) => [l.code, l])
);

const BY_BCP47: Record<string, LanguageEntry> = Object.fromEntries(
  SUPPORTED_LANGUAGES.map((l) => [l.bcp47.toLowerCase(), l])
);

/** Loose BCP-47 detector: "xx" or "xx-YY" or "xx-YYY" (case-insensitive). */
const BCP47_RE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,4})?$/i;

/**
 * Normalizes a user-supplied language code.
 * - Trims whitespace.
 * - Recognises short codes ("en", "pt") and returns them as-is.
 * - Recognises regional BCP-47 tags ("en-GB", "pt-PT", "es-MX") and
 *   preserves them (with canonical casing: lower-language + UPPER-region).
 * - Falls back to a safe lowercased version of the input.
 */
export function normalizeLangCode(code: string | null | undefined): string {
  if (!code) return "en";
  const raw = String(code).trim();
  if (!raw) return "en";

  // Already a known short code
  if (BY_SHORT[raw.toLowerCase()]) return raw.toLowerCase();

  if (BCP47_RE.test(raw)) {
    const [lang, region] = raw.split("-");
    return region ? `${lang.toLowerCase()}-${region.toUpperCase()}` : lang.toLowerCase();
  }

  // Unknown free-text — safe fallback
  return raw.toLowerCase();
}

/**
 * Returns true when the code is a known short language or a syntactically
 * valid BCP-47 tag.
 */
export function isSupportedLanguage(code: string | null | undefined): boolean {
  if (!code) return false;
  const norm = normalizeLangCode(code);
  if (BY_SHORT[norm]) return true;
  return BCP47_RE.test(norm);
}

/**
 * Converts any supported code to a BCP-47 locale tag.
 *
 * - "en" → "en-US"
 * - "pt" → "pt-BR"
 * - "en-GB" → "en-GB" (preserved)
 * - "es-MX" → "es-MX" (preserved)
 * - unknown free text → returned lowercased (best-effort, never throws)
 */
export function toBCP47(code: string | null | undefined): string {
  const norm = normalizeLangCode(code);
  const short = BY_SHORT[norm];
  if (short) return short.bcp47;
  // Already regional or unknown — return as-is (preserves en-GB, pt-PT, ...)
  return norm;
}

/**
 * Returns a display label for the language. Recognises regional variants
 * by falling back to the base language label (e.g. "en-GB" → "English").
 */
export function getLangLabel(code: string | null | undefined): string {
  if (!code) return "";
  const norm = normalizeLangCode(code);
  if (BY_SHORT[norm]) return BY_SHORT[norm].label;
  const lower = norm.toLowerCase();
  if (BY_BCP47[lower]) return BY_BCP47[lower].label;
  const base = lower.split("-")[0];
  if (BY_SHORT[base]) return BY_SHORT[base].label;
  return norm.toUpperCase();
}

/**
 * Returns an emoji flag for the language. Falls back to a globe.
 */
export function getLanguageFlag(code: string | null | undefined): string {
  if (!code) return "🌍";
  const norm = normalizeLangCode(code);
  if (BY_SHORT[norm]) return BY_SHORT[norm].flag;
  const lower = norm.toLowerCase();
  if (BY_BCP47[lower]) return BY_BCP47[lower].flag;
  const base = lower.split("-")[0];
  if (BY_SHORT[base]) return BY_SHORT[base].flag;
  return "🌍";
}

export function getDefaultLangA(): string {
  return "en";
}

export function getDefaultLangB(): string {
  return "pt";
}