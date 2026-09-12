/**
 * Centralized study-side resolution utility.
 *
 * Given two sides (A = term/front, B = translation/back) and a direction,
 * returns which side is the "prompt" (shown first / question) and which is
 * the "answer" (shown second / expected response).
 *
 * Convention:
 *   sideA  = front = term      = lang_a  (e.g. English)
 *   sideB  = back  = translation = lang_b (e.g. Portuguese)
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

import { toBCP47, getLangLabel } from "./languages";
export { toBCP47, getLangLabel };

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
  system_kind?: string | null;
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
 * System collections (notably Reforço) are materialized lists whose language
 * metadata belongs to the materialized list itself. They must never inherit a
 * different folder language configuration, otherwise the visible card text can
 * be correct while the ENGLISH/PORTUGUÊS headers are inverted.
 */
export function resolveEffectiveListSettings(
  list: ListSettingsRow | null | undefined,
  folder?: FolderSettingsRow | null
): EffectiveListSettings {
  const BARE_DEFAULTS = { lang_a: "en", lang_b: "pt" };

  const listLangA = list?.lang_a || null;
  const listLangB = list?.lang_b || null;
  const folderLangA = folder?.lang_a || null;
  const folderLangB = folder?.lang_b || null;
  const isSystemCollection = list?.system_kind === "reinforcement" || list?.system_kind === "attention_points";

  const listHasExplicitOverride = isSystemCollection || (
    listLangA !== null &&
    listLangB !== null &&
    !(listLangA === BARE_DEFAULTS.lang_a && listLangB === BARE_DEFAULTS.lang_b && folderLangA && folderLangB)
  );

  const folderHasConfig = !!(folderLangA && folderLangB);
  const listMatchesBareDefaults =
    (listLangA === BARE_DEFAULTS.lang_a || !listLangA) &&
    (listLangB === BARE_DEFAULTS.lang_b || !listLangB);

  const useFolderFallback = !isSystemCollection
    && (!listHasExplicitOverride || (listMatchesBareDefaults && folderHasConfig));

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
    isListOverride: isSystemCollection || (listHasExplicitOverride && !useFolderFallback),
  };
}
