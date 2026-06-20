import { normalizeStudyMode } from "@/features/study/lib/studyMode";
import type { StudyPreferences } from "@/hooks/useStudyPreferences";
import type { StudyResumeSnapshot } from "@/features/study/lib/studyResume";

const APP_ORIGIN = "https://www.apeeducation.org";
const PRIVATE_STUDY_PATH = /^\/(list|collection)\/([A-Za-z0-9_-]+)\/study$/;

export function studyCompletionKeyFromResume(
  userId: string,
  snapshot: StudyResumeSnapshot,
  prefs: StudyPreferences,
): string | null {
  if (!userId) return null;

  try {
    const url = new URL(snapshot.path, APP_ORIGIN);
    if (url.origin !== APP_ORIGIN) return null;

    const match = url.pathname.match(PRIVATE_STUDY_PATH);
    if (!match) return null;

    const rawDirection = url.searchParams.get("dir") || url.searchParams.get("direction");
    const direction =
      rawDirection === "a-b" || rawDirection === "b-a" || rawDirection === "any"
        ? rawDirection
        : prefs.direction;
    const mode = normalizeStudyMode(url.searchParams.get("mode") || prefs.mode);

    return `study-completed:${userId}:${match[2]}:${mode}:${direction}:${prefs.favoritesOnly}`;
  } catch {
    return null;
  }
}

export function isResumeSupersededByCompletion(
  userId: string,
  snapshot: StudyResumeSnapshot,
  prefs: StudyPreferences,
  storage: Pick<Storage, "getItem"> = localStorage,
): boolean {
  const key = studyCompletionKeyFromResume(userId, snapshot, prefs);
  if (!key) return false;

  try {
    const completedAt = Number(storage.getItem(key));
    return Number.isFinite(completedAt) && completedAt >= snapshot.updatedAt;
  } catch {
    return false;
  }
}
