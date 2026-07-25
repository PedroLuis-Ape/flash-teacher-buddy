import type { StudyFlowModePreset } from "@/features/study/preferences/studyPreset";

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
