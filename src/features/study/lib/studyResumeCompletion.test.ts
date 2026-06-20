import { describe, expect, it } from "vitest";
import type { StudyPreferences } from "@/hooks/useStudyPreferences";
import type { StudyResumeSnapshot } from "./studyResume";
import {
  isResumeSupersededByCompletion,
  studyCompletionKeyFromResume,
} from "./studyResumeCompletion";

const prefs: StudyPreferences = {
  favoritesOnly: true,
  order: "random",
  direction: "a-b",
  mode: "multiple",
  fastMode: false,
};

const snapshot: StudyResumeSnapshot = {
  version: 1,
  path: "/list/list-1/study?mode=multiple&dir=b-a",
  institutionId: "institution-1",
  updatedAt: 1_000,
};

function storageWith(entries: Record<string, string>) {
  return {
    getItem: (key: string) => entries[key] ?? null,
  };
}

describe("studyResumeCompletion", () => {
  it("reconstructs the same scoped key used by Study", () => {
    expect(studyCompletionKeyFromResume("user-1", snapshot, prefs)).toBe(
      "study-completed:user-1:list-1:multiple-choice:b-a:true",
    );
  });

  it("invalidates a resume only when the matching completion is newer", () => {
    const key = "study-completed:user-1:list-1:multiple-choice:b-a:true";

    expect(
      isResumeSupersededByCompletion(
        "user-1",
        snapshot,
        prefs,
        storageWith({ [key]: "1001" }),
      ),
    ).toBe(true);

    expect(
      isResumeSupersededByCompletion(
        "user-1",
        snapshot,
        prefs,
        storageWith({ [key]: "999" }),
      ),
    ).toBe(false);
  });

  it("does not let another account or study scope invalidate the resume", () => {
    const otherKey = "study-completed:user-2:list-1:multiple-choice:b-a:true";

    expect(
      isResumeSupersededByCompletion(
        "user-1",
        snapshot,
        prefs,
        storageWith({ [otherKey]: "2000" }),
      ),
    ).toBe(false);
  });

  it("rejects unrelated and external paths", () => {
    expect(
      studyCompletionKeyFromResume(
        "user-1",
        { ...snapshot, path: "/dashboard" },
        prefs,
      ),
    ).toBeNull();

    expect(
      studyCompletionKeyFromResume(
        "user-1",
        { ...snapshot, path: "https://example.com/list/list-1/study" },
        prefs,
      ),
    ).toBeNull();
  });
});
