import { describe, expect, it } from "vitest";
import {
  STUDY_PREFERENCES_VERSION,
  normalizeStoredStudyPreferences,
} from "./useStudyPreferences";

describe("study preference defaults", () => {
  it("migrates legacy inherited directions to the global mixed default", () => {
    expect(normalizeStoredStudyPreferences({
      direction: "a-b",
      order: "sequential",
      favoritesOnly: true,
      mode: "write",
      fastMode: true,
    })).toEqual({
      direction: "any",
      order: "sequential",
      favoritesOnly: true,
      mode: "write",
      fastMode: true,
    });
  });

  it("preserves a fixed direction explicitly saved in the current version", () => {
    expect(normalizeStoredStudyPreferences({
      version: STUDY_PREFERENCES_VERSION,
      direction: "b-a",
      order: "random",
    }).direction).toBe("b-a");
  });

  it("defaults new and invalid preferences to random order and alternating sides", () => {
    expect(normalizeStoredStudyPreferences(null)).toMatchObject({
      direction: "any",
      order: "random",
    });
    expect(normalizeStoredStudyPreferences({
      version: STUDY_PREFERENCES_VERSION,
      direction: "invalid",
      order: "invalid",
    })).toMatchObject({
      direction: "any",
      order: "random",
    });
  });
});
