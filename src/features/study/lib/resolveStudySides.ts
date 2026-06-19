/**
 * Centralized study-side resolution utility.
 *
 * Given two sides (A = term/front, B = translation/back) and a direction,
 * returns which side is the "prompt" (shown first / question) and which is
 * the "answer" (shown second / expected response).
 */

export type Direction = "a-b" | "b-a" | "any";
export type PrimarySide = "a" | "b";

export interface StudySide {
  text: string;
  lang: string;
  label: string;
  acceptedAnswers?: string[];
}

export interface ResolvedSides {
  promptSide: StudySide;
  answerSide: StudySide;
  isAFirst: boolean;
}

export function normalizeDirection(dir: string): Direction {
  if (dir === "en-pt" || dir === "a-b") return "a-b";
  if (dir === "pt-en" || dir === "b-a") return "b-a";
  return "any";
}

export function normalizePrimarySide(value: unknown): PrimarySide {
  return value === "b" ? "b" : "a";
}

export function primarySideToDirection(value: unknown): Direction {
  return normalizePrimarySide(value) === "b" ? "b-a" : "a-b";
}

export function isDirectionFollowingPrimary(
  direction: Direction | string,
  primarySide: unknown,
): boolean {
  const normalized = normalizeDirection(direction);
  return normalized !== "any" && normalized === primarySideToDirection(primarySide);
}

function hashToBool(seed: string): boolean {
  const hash = seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return hash % 2 === 0;
}

export function resolveStudySides(
  sideA: StudySide,
  sideB: StudySide,
  direction: Direction | string,
  cardSeed: string = "",
): ResolvedSides {
  const dir = normalizeDirection(direction);
  const isAFirst = dir === "a-b" ? true : dir === "b-a" ? false : hashToBool(cardSeed);

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
  primarySide: PrimarySide;
  isListOverride: boolean;
}

interface ListSettingsRow {
  study_type?: string | null;
  lang_a?: string | null;
  lang_b?: string | null;
  labels_a?: string | null;
  labels_b?: string | null;
  tts_enabled?: boolean | null;
  primary_side?: string | null;
}

interface FolderSettingsRow {
  study_type?: string | null;
  lang_a?: string | null;
  lang_b?: string | null;
  labels_a?: string | null;
  labels_b?: string | null;
  tts_enabled?: boolean | null;
}

export function resolveEffectiveListSettings(
  list: ListSettingsRow | null | undefined,
  folder?: FolderSettingsRow | null,
): EffectiveListSettings {
  const BARE_DEFAULTS = { lang_a: "en", lang_b: "pt" };

  const listLangA = list?.lang_a || null;
  const listLangB = list?.lang_b || null;
  const folderLangA = folder?.lang_a || null;
  const folderLangB = folder?.lang_b || null;

  const listHasExplicitOverride =
    listLangA !== null &&
    listLangB !== null &&
    !(
      listLangA === BARE_DEFAULTS.lang_a &&
      listLangB === BARE_DEFAULTS.lang_b &&
      folderLangA &&
      folderLangB
    );

  const folderHasConfig = !!(folderLangA && folderLangB);
  const listMatchesBareDefaults =
    (listLangA === BARE_DEFAULTS.lang_a || !listLangA) &&
    (listLangB === BARE_DEFAULTS.lang_b || !listLangB);

  const useFolderFallback =
    !listHasExplicitOverride || (listMatchesBareDefaults && folderHasConfig);

  const src: ListSettingsRow = useFolderFallback && folder
    ? {
        study_type: list?.study_type || folder.study_type,
        lang_a: folderLangA,
        lang_b: folderLangB,
        labels_a: folder.labels_a,
        labels_b: folder.labels_b,
        tts_enabled: list?.tts_enabled ?? folder.tts_enabled,
        primary_side: list?.primary_side,
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
    primarySide: normalizePrimarySide(list?.primary_side),
    isListOverride: listHasExplicitOverride && !useFolderFallback,
  };
}
