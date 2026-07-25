import {
  DEFAULT_STUDY_PRESET,
  type StudyFlowModePreset,
} from "@/features/study/preferences/studyPreset";
import { readGlobalCache, readListOverrideCache } from "@/features/study/preferences/studyPreferenceCache";

/**
 * Runtime access to the "study flow mode" preference (mastery_rounds | continuous).
 *
 * The value is stored inside the existing StudyPreset object under the
 * `studyFlowMode` field, which is persisted through the usual preference
 * cache (global + list override). This module offers a lightweight event bus
 * so components that don't consume the full hook can react to changes.
 */

export const STUDY_FLOW_MODE_CHANGED_EVENT = "ape:studyFlowModeChanged";

export function isValidStudyFlowMode(value: unknown): value is StudyFlowModePreset {
  return value === "mastery_rounds" || value === "continuous";
}

export function emitStudyFlowModeChanged(mode: StudyFlowModePreset): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(STUDY_FLOW_MODE_CHANGED_EVENT, { detail: mode }));
}

function derivePrivateListId(pathname?: string): string | undefined {
  const path = pathname ?? (typeof window === "undefined" ? "" : window.location.pathname);
  const match = path.match(/^\/list\/([^/]+)(?:\/|$)/);
  if (!match?.[1]) return undefined;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/**
 * Read the effective study flow mode without subscribing to the full
 * useStudyPreferences hook. Resolution order matches the preset hierarchy:
 * list override > global cache > default.
 */
export function readStudyFlowMode(userScope = "anon"): StudyFlowModePreset {
  if (typeof window === "undefined") return DEFAULT_STUDY_PRESET.studyFlowMode;
  const listId = derivePrivateListId();
  const listOverride = listId ? readListOverrideCache(userScope, listId) : null;
  if (isValidStudyFlowMode(listOverride?.studyFlowMode)) {
    return listOverride.studyFlowMode;
  }
  const global = readGlobalCache(userScope);
  if (isValidStudyFlowMode(global?.studyFlowMode)) {
    return global.studyFlowMode;
  }
  return DEFAULT_STUDY_PRESET.studyFlowMode;
}
