/**
 * Centralized study-side resolution utility.
 *
 * Given two sides (A = term/front, B = translation/back) and a direction,
 * returns which side is the "prompt" (shown first / question) and which is
 * the "answer" (shown second / expected response).
 *
 * Convention:
 *   sideA  = front = term      = lang_a  (e.g. English)
 *   sideB  = back  = translation = lang_b  (e.g. Portuguese)
 *
 * Direction semantics (v2 – canonical tokens):
 *   "a-b"  → show A first, answer with B
 *   "b-a"  → show B first, answer with A
 *   "any"  → deterministic pseudo-random per card
 *
 * Legacy compat:
 *   "en-pt" is normalized to "a-b"
 *   "pt-en" is normalized to "b-a"
 */

export type Direction = "a-b" | "b-a" | "any";

export interface StudySide {
  text: string;
  lang: string;
  label: string;
  /** Only used by WriteStudyView */
  acceptedAnswers?: string[];
}

export interface ResolvedSides {
  promptSide: StudySide;
  answerSide: StudySide;
  /** true when sideA is the prompt (i.e. "a-b" direction) */
  isAFirst: boolean;
}

/**
 * Normalizes legacy direction tokens to canonical ones.
 */
export function normalizeDirection(dir: string): Direction {
  if (dir === "en-pt" || dir === "a-b") return "a-b";
  if (dir === "pt-en" || dir === "b-a") return "b-a";
  return "any";
}

/**
 * Deterministic hash-based boolean for "any" direction.
 * Returns true (= sideA first) or false (= sideB first).
 */
function hashToBool(seed: string): boolean {
  const hash = seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return hash % 2 === 0;
}

/**
 * Main resolver – single source of truth for all study components.
 *
 * @param sideA  - Object built from `front` / `langA` / `labelA`
 * @param sideB  - Object built from `back`  / `langB` / `labelB`
 * @param direction - "a-b" | "b-a" | "any" (also accepts legacy "en-pt" | "pt-en")
 * @param cardSeed  - A stable per-card string (e.g. flashcardId or front text)
 *                    used only when direction === "any"
 */
export function resolveStudySides(
  sideA: StudySide,
  sideB: StudySide,
  direction: Direction | string,
  cardSeed: string = ""
): ResolvedSides {
  const dir = normalizeDirection(direction as string);
  let isAFirst: boolean;

  if (dir === "a-b") {
    isAFirst = true;
  } else if (dir === "b-a") {
    isAFirst = false;
  } else {
    isAFirst = hashToBool(cardSeed);
  }

  return {
    promptSide: isAFirst ? sideA : sideB,
    answerSide: isAFirst ? sideB : sideA,
    isAFirst,
  };
}

/**
 * BCP-47 mapping and language labels are now centralised in
 * `./languages.ts`. We re-export the helpers here for backwards-compat
 * with the many call sites that still import from this module.
 */
import { toBCP47, getLangLabel } from "./languages";
export { toBCP47, getLangLabel };

// ─── Effective List Settings Resolution ────────────────────────────
// Single source of truth for resolving a list's language config with folder fallback.

export interface EffectiveListSettings {
  studyType: string;
  langA: string;
  langB: string;
  labelsA: string;
  labelsB: string;
  ttsEnabled: boolean;
  /** True when the list has its own explicit settings (not just defaults) */
  isListOverride: boolean;
}

interface ListSettingsRow {
  study_type?: string | null;
  lang_a?: string | null;
  lang_b?: string | null;
  labels_a?: string | null;
  labels_b?: string | null;
  tts_enabled?: boolean | null;
}

interface FolderSettingsRow {
  study_type?: string | null;
  lang_a?: string | null;
  lang_b?: string | null;
  labels_a?: string | null;
  labels_b?: string | null;
  tts_enabled?: boolean | null;
}

/**
 * Resolves the effective language settings for a list, falling back to the
 * parent folder when the list has no explicit override.
 *
 * A list is considered to have an explicit override when its `lang_a` or
 * `lang_b` differ from the "bare defaults" (en/pt) AND from the folder
 * values.  When it matches the bare defaults and the folder has a real
 * config, the folder wins — this is the inheritance behaviour.
 *
 * @param list  - The list row (may have null fields)
 * @param folder - The parent folder row (may be null for orphan lists)
 */
export function resolveEffectiveListSettings(
  list: ListSettingsRow | null | undefined,
  folder?: FolderSettingsRow | null
): EffectiveListSettings {
  const BARE_DEFAULTS = { lang_a: "en", lang_b: "pt" };

  // Determine if the list explicitly configured its own languages
  const listLangA = list?.lang_a || null;
  const listLangB = list?.lang_b || null;
  const folderLangA = folder?.lang_a || null;
  const folderLangB = folder?.lang_b || null;

  // A list overrides the folder if it has non-null lang values that
  // differ from both bare defaults AND from the folder values.
  const listHasExplicitOverride =
    listLangA !== null &&
    listLangB !== null &&
    !(listLangA === BARE_DEFAULTS.lang_a && listLangB === BARE_DEFAULTS.lang_b && folderLangA && folderLangB);

  // If the list matches bare defaults but the folder has a real config,
  // the folder wins (inheritance).
  const folderHasConfig = !!(folderLangA && folderLangB);
  const listMatchesBareDefaults =
    (listLangA === BARE_DEFAULTS.lang_a || !listLangA) &&
    (listLangB === BARE_DEFAULTS.lang_b || !listLangB);

  const useFolderFallback = !listHasExplicitOverride || (listMatchesBareDefaults && folderHasConfig);

  // Pick source
  const src: ListSettingsRow = useFolderFallback && folder
    ? {
        study_type: list?.study_type || folder.study_type,
        lang_a: folderLangA,
        lang_b: folderLangB,
        labels_a: folder.labels_a,
        labels_b: folder.labels_b,
        tts_enabled: list?.tts_enabled ?? folder.tts_enabled,
      }
    : (list || {});

  const studyType = src.study_type || "language";
  const langA = src.lang_a || "en";
  const langB = src.lang_b || "pt";
  const defaultLabelA = studyType === "general" ? "Frente" : getLangLabel(langA);
  const defaultLabelB = studyType === "general" ? "Verso" : getLangLabel(langB);

  return {
    studyType,
    langA,
    langB,
    labelsA: src.labels_a || defaultLabelA,
    labelsB: src.labels_b || defaultLabelB,
    ttsEnabled: src.tts_enabled ?? (studyType === "language"),
    isListOverride: listHasExplicitOverride && !useFolderFallback,
  };
}
