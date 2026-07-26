import { describe, expect, it } from "vitest";
import {
  STUDY_PREFERENCES_VERSION,
  buildStudyPreferenceContextKey,
  normalizeStoredStudyPreferences,
  selectStudyPreferenceContextValue,
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

describe("study preference hydration context", () => {
  it("isolates the saved preset by mode and list", () => {
    const base = buildStudyPreferenceContextKey({
      scope: "user-1",
      gameMode: "write",
      listId: "list-1",
      sessionOverrides: { direction: "a-b", order: "random" },
    });

    expect(buildStudyPreferenceContextKey({
      scope: "user-1",
      gameMode: "mixed",
      listId: "list-1",
      sessionOverrides: { direction: "a-b", order: "random" },
    })).not.toBe(base);

    expect(buildStudyPreferenceContextKey({
      scope: "user-1",
      gameMode: "write",
      listId: "list-2",
      sessionOverrides: { direction: "a-b", order: "random" },
    })).not.toBe(base);
  });

  it("builds a stable key regardless of override property order", () => {
    expect(buildStudyPreferenceContextKey({
      scope: "user-1",
      gameMode: "write",
      sessionOverrides: { direction: "b-a", order: "sequential" },
    })).toBe(buildStudyPreferenceContextKey({
      scope: "user-1",
      gameMode: "write",
      sessionOverrides: { order: "sequential", direction: "b-a" },
    }));
  });

  it("renders the current context cache instead of stale state from another mode", () => {
    expect(selectStudyPreferenceContextValue({
      stateContextKey: "write",
      currentContextKey: "mixed",
      stateValue: "old-write",
      cachedValue: "saved-mixed",
    })).toBe("saved-mixed");
  });

  it("keeps hydrated state when the context matches", () => {
    expect(selectStudyPreferenceContextValue({
      stateContextKey: "write",
      currentContextKey: "write",
      stateValue: "hydrated-write",
      cachedValue: "cached-write",
    })).toBe("hydrated-write");
  });
});
