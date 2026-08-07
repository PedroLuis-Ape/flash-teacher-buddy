import { useSyncExternalStore } from "react";
import type {
  StudyFlowModePreset,
  StudyWriteActivityModePreset,
  StudyWriteCorrectionModePreset,
  StudyWriteRewriteSidePreset,
} from "@/features/study/preferences/studyPreset";

export interface WriteStudyRuntimeSnapshot {
  writeActivityMode: StudyWriteActivityModePreset;
  writeRewriteSide: StudyWriteRewriteSidePreset;
  writeCorrectionMode: StudyWriteCorrectionModePreset;
  studyFlowMode: StudyFlowModePreset;
}

let snapshot: WriteStudyRuntimeSnapshot = {
  writeActivityMode: "translate",
  writeRewriteSide: "alternating",
  writeCorrectionMode: "flexible",
  studyFlowMode: "continuous",
};

const listeners = new Set<() => void>();

function sameSnapshot(left: WriteStudyRuntimeSnapshot, right: WriteStudyRuntimeSnapshot): boolean {
  return left.writeActivityMode === right.writeActivityMode
    && left.writeRewriteSide === right.writeRewriteSide
    && left.writeCorrectionMode === right.writeCorrectionMode
    && left.studyFlowMode === right.studyFlowMode;
}

export function setWriteStudyRuntime(next: WriteStudyRuntimeSnapshot): void {
  if (sameSnapshot(snapshot, next)) return;
  snapshot = { ...next };
  listeners.forEach((listener) => listener());
}

export function patchWriteStudyRuntime(patch: Partial<WriteStudyRuntimeSnapshot>): void {
  setWriteStudyRuntime({ ...snapshot, ...patch });
}

export function getWriteStudyRuntime(): WriteStudyRuntimeSnapshot {
  return snapshot;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Runtime espelhado pelo controlador único da sessão. Componentes de escrita
 * podem remontar entre cards/camadas sem abrir outra hidratação de preferências.
 */
export function useWriteStudyRuntime(): WriteStudyRuntimeSnapshot {
  return useSyncExternalStore(subscribe, getWriteStudyRuntime, getWriteStudyRuntime);
}
