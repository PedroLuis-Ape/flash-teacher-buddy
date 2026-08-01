import { useLocation, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useStudyPreferences } from "@/hooks/useStudyPreferences";
import { normalizeStudyMode } from "@/features/study/lib/studyMode";
import type { StudyModePreset } from "@/features/study/preferences/studyPreset";
import type { WriteActivityPreference } from "@/features/study/lib/writeActivityMode";
import type { WriteCorrectionMode } from "@/features/study/lib/writeCorrectionMode";

/**
 * Shared runtime bridge for write settings. Legacy localStorage helpers remain
 * available for migration/tests, but gameplay reads and writes the same
 * user/list/mode-scoped preset as the settings modal.
 */
export function useWriteStudyPreferences() {
  const location = useLocation();
  const { id } = useParams<{ id?: string }>();
  const { userId } = useAuth();
  const requestedMode = new URLSearchParams(location.search).get("mode");
  const gameMode = normalizeStudyMode(requestedMode ?? "write") as StudyModePreset;
  const isPrivateList = location.pathname.includes("/list/") && !location.pathname.startsWith("/portal/");
  const { effectivePreset, updateForCurrentScope } = useStudyPreferences(userId, {
    listId: isPrivateList ? id : undefined,
    gameMode,
    persistScope: isPrivateList ? "list" : "global",
    canPersistList: isPrivateList,
  });

  const preference: WriteActivityPreference = {
    mode: effectivePreset.writeActivityMode,
    rewriteSide: effectivePreset.writeRewriteSide,
  };

  return {
    gameMode,
    preference,
    correctionMode: effectivePreset.writeCorrectionMode as WriteCorrectionMode,
    studyFlowMode: effectivePreset.studyFlowMode,
    updatePreference: (next: Partial<WriteActivityPreference>) => updateForCurrentScope({
      ...(next.mode ? { writeActivityMode: next.mode } : {}),
      ...(next.rewriteSide ? { writeRewriteSide: next.rewriteSide } : {}),
    }),
    updateCorrectionMode: (next: WriteCorrectionMode) => updateForCurrentScope({ writeCorrectionMode: next }),
  };
}
