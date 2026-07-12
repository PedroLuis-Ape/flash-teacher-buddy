import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_STUDY_PRESET } from "./studyPreset";
import {
  enqueuePendingPreferenceWrite,
  migrateLegacyStudyPreferences,
  readGlobalCache,
  readListOverrideCache,
  readPendingPreferenceWrites,
  removeListOverrideCache,
  replacePendingPreferenceWrites,
  writeGlobalCache,
  writeListOverrideCache,
} from "./studyPreferenceCache";

describe("studyPreferenceCache", () => {
  beforeEach(() => localStorage.clear());

  it("migrates legacy v2 favoritesOnly into scope", () => {
    localStorage.setItem("studyPreferences:user-1", JSON.stringify({
      version: 2,
      mode: "mixed",
      direction: "a-b",
      order: "sequential",
      favoritesOnly: true,
      fastMode: true,
    }));

    expect(migrateLegacyStudyPreferences("user-1")).toEqual({
      mode: "mixed",
      direction: "a-b",
      order: "sequential",
      scope: "favorites",
      fastMode: true,
    });
    expect(readGlobalCache("user-1")).toEqual({
      mode: "mixed",
      direction: "a-b",
      order: "sequential",
      scope: "favorites",
      fastMode: true,
    });
  });

  it("isolates global and list caches by user", () => {
    writeGlobalCache("user-1", DEFAULT_STUDY_PRESET);
    writeListOverrideCache("user-1", "list-1", { mode: "write" });

    expect(readGlobalCache("user-2")).toBeNull();
    expect(readListOverrideCache("user-2", "list-1")).toBeNull();
    expect(readListOverrideCache("user-1", "list-1")).toEqual({ mode: "write" });
  });

  it("removes empty list overrides", () => {
    writeListOverrideCache("user-1", "list-1", { mode: "write" });
    removeListOverrideCache("user-1", "list-1");
    expect(readListOverrideCache("user-1", "list-1")).toBeNull();
  });

  it("keeps pending writes ordered and replaceable", () => {
    enqueuePendingPreferenceWrite("user-1", {
      kind: "global-upsert",
      preset: DEFAULT_STUDY_PRESET,
      updatedAt: 1,
    });
    enqueuePendingPreferenceWrite("user-1", {
      kind: "list-delete",
      listId: "list-1",
      updatedAt: 2,
    });

    expect(readPendingPreferenceWrites("user-1").map((item) => item.kind)).toEqual([
      "global-upsert",
      "list-delete",
    ]);

    replacePendingPreferenceWrites("user-1", []);
    expect(readPendingPreferenceWrites("user-1")).toEqual([]);
  });
});
