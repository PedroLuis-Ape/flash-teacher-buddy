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

/**
 * Canonical source-of-truth contract for list study/language metadata.
 *
 * explicit  → the list owns its A/B language settings.
 * inherited → the parent folder owns the settings.
 * legacy    → preserve the historical heuristic so old decks do not change
 *             behavior merely because this contract was introduced.
 */
export type LanguageSettingsMode = "explicit" | "inherited" | "legacy";

export interface EffectiveListSettings {
  studyType: string;
  langA: string;
  langB: string;
  labelsA: string;
  labelsB: string;
  ttsEnabled: boolean;
  languageSettingsMode: LanguageSettingsMode;
  /** True when the list itself is the authority for the effective settings. */
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
  language_settings_mode?: string | null;
}

interface FolderSettingsRow {
  study_type?: string | null;
  lang_a?: string | null;
  lang_b?: string | null;
  labels_a?: string | null;
  labels_b?: string | null;
  tts_enabled?: boolean | null;
}

function canonicalLanguageSettingsMode(
  value: unknown,
  isSystemCollection: boolean,
): LanguageSettingsMode {
  // Materialized system collections own their metadata by definition; letting
  // them inherit from a user folder can invert labels/TTS for the visible text.
  if (isSystemCollection) return "explicit";
  if (value === "explicit" || value === "inherited" || value === "legacy") return value;
  return "legacy";
}

/**
 * Resolves the effective language settings for a list.
 *
 * New rows can explicitly declare whether list or folder metadata is the
 * authority. Rows created before that contract stay in `legacy`, which keeps
 * the previous en/pt-default heuristic unchanged for backwards compatibility.
 *
 * System collections (notably Reforço/Pontos de atenção) always use their own
 * materialized metadata and never inherit a contradictory folder setup.
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
  const languageSettingsMode = canonicalLanguageSettingsMode(
    list?.language_settings_mode,
    isSystemCollection,
  );

  let src: ListSettingsRow;
  let isListOverride: boolean;

  if (languageSettingsMode === "explicit") {
    // Explicit means explicit even for the historical bare-default pair en/pt.
    // This is the key distinction the legacy schema could not represent.
    src = list || {};
    isListOverride = true;
  } else if (languageSettingsMode === "inherited") {
    // Inherited is deliberate, not inferred. Prefer every configured folder
    // value and only fall back to the list when a legacy/partial folder row is
    // missing that individual field.
    src = {
      study_type: folder?.study_type ?? list?.study_type,
      lang_a: folderLangA ?? listLangA,
      lang_b: folderLangB ?? listLangB,
      labels_a: folder?.labels_a ?? list?.labels_a,
      labels_b: folder?.labels_b ?? list?.labels_b,
      tts_enabled: folder?.tts_enabled ?? list?.tts_enabled,
    };
    isListOverride = false;
  } else {
    // Legacy mode preserves the exact pre-contract behavior. Old flashcards and
    // old lists therefore do not change semantics merely because the new column
    // exists in the database.
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

    src = useFolderFallback && folder
      ? {
          study_type: list?.study_type || folder.study_type,
          lang_a: folderLangA,
          lang_b: folderLangB,
          labels_a: folder.labels_a,
          labels_b: folder.labels_b,
          tts_enabled: list?.tts_enabled ?? folder.tts_enabled,
        }
      : (list || {});
    isListOverride = isSystemCollection || (listHasExplicitOverride && !useFolderFallback);
  }

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
    languageSettingsMode,
    isListOverride,
  };
}
