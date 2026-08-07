import {
  resolveWriteActivityGameMode,
  type WriteActivityPreference,
} from "@/features/study/lib/writeActivityMode";
import type { WriteCorrectionMode } from "@/features/study/lib/writeCorrectionMode";
import {
  patchWriteStudyRuntime,
  useWriteStudyRuntime,
} from "@/features/study/lib/writeStudyRuntime";

/**
 * Lightweight bridge consumed by the write card.
 *
 * It deliberately does not call `useStudyPreferences`: Study/MixedStudy own
 * hydration, restoration and persistence through `useStudySettingsController`.
 * The controller mirrors that exact effective snapshot into this runtime, so a
 * card/layer remount cannot reopen a competing preference source.
 */
export function useWriteStudyPreferences() {
  const runtime = useWriteStudyRuntime();
  const gameMode = resolveWriteActivityGameMode();

  const preference: WriteActivityPreference = {
    mode: runtime.writeActivityMode,
    rewriteSide: runtime.writeRewriteSide,
  };

  return {
    gameMode,
    preference,
    correctionMode: runtime.writeCorrectionMode as WriteCorrectionMode,
    studyFlowMode: runtime.studyFlowMode,
    updatePreference: (next: Partial<WriteActivityPreference>) => patchWriteStudyRuntime({
      ...(next.mode ? { writeActivityMode: next.mode } : {}),
      ...(next.rewriteSide ? { writeRewriteSide: next.rewriteSide } : {}),
    }),
    updateCorrectionMode: (next: WriteCorrectionMode) => patchWriteStudyRuntime({
      writeCorrectionMode: next,
    }),
  };
}
