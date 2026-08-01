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
  stagePendingPreferenceWrites,
  writeGlobalCache,
  writeListOverrideCache,
} from "./studyPreferenceCache";

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, String(value)); },
  };
}

Object.defineProperty(globalThis, "localStorage", {
  value: createMemoryStorage(),
  configurable: true,
});

describe("studyPreferenceCache", () => {
  beforeEach(() => localStorage.clear());

  it("migrates legacy v2 only into its original game mode", () => {
    localStorage.setItem("studyPreferences:user-1", JSON.stringify({
      version: 2,
      mode: "mixed",
      direction: "a-b",
      order: "sequential",
      favoritesOnly: true,
      fastMode: true,
    }));

    const expected = {
      mode: "mixed" as const,
      direction: "a-b" as const,
      order: "sequential" as const,
      scope: "favorites" as const,
      fastMode: true,
      playMode: "both" as const,
      playSide: "a" as const,
      studyFlowMode: "mastery_rounds" as const,
      writeActivityMode: "translate" as const,
      writeRewriteSide: "alternating" as const,
      writeCorrectionMode: "flexible" as const,
    };

    expect(migrateLegacyStudyPreferences("user-1", "mixed")).toEqual(expected);
    expect(readGlobalCache("user-1", "mixed")).toEqual(expected);
    expect(readGlobalCache("user-1", "write")).toBeNull();
  });

  it("isolates global and list caches by user and game mode", () => {
    writeGlobalCache("user-1", "flip", {
      ...DEFAULT_STUDY_PRESET,
      mode: "flip",
      direction: "a-b",
    });
    writeGlobalCache("user-1", "write", {
      ...DEFAULT_STUDY_PRESET,
      mode: "write",
      direction: "b-a",
    });
    writeListOverrideCache("user-1", "write", "list-1", { order: "sequential" });

    expect(readGlobalCache("user-2", "flip")).toBeNull();
    expect(readGlobalCache("user-1", "flip")?.direction).toBe("a-b");
    expect(readGlobalCache("user-1", "write")?.direction).toBe("b-a");
    expect(readListOverrideCache("user-2", "write", "list-1")).toBeNull();
    expect(readListOverrideCache("user-1", "flip", "list-1")).toBeNull();
    expect(readListOverrideCache("user-1", "write", "list-1")).toEqual({ order: "sequential" });
  });

  it("removes only the selected mode list override", () => {
    writeListOverrideCache("user-1", "flip", "list-1", { order: "random" });
    writeListOverrideCache("user-1", "write", "list-1", { order: "sequential" });
    removeListOverrideCache("user-1", "write", "list-1");

    expect(readListOverrideCache("user-1", "write", "list-1")).toBeNull();
    expect(readListOverrideCache("user-1", "flip", "list-1")).toEqual({ order: "random" });
  });

  it("keeps pending writes ordered and replaceable", () => {
    enqueuePendingPreferenceWrite("user-1", {
      kind: "global-upsert",
      gameMode: "flip",
      preset: DEFAULT_STUDY_PRESET,
      updatedAt: 1,
    });
    enqueuePendingPreferenceWrite("user-1", {
      kind: "list-delete",
      gameMode: "flip",
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

  it("deduplicates pending writes per target without mixing game modes", () => {
    stagePendingPreferenceWrites("user-1", [
      {
        kind: "global-upsert",
        gameMode: "flip",
        preset: DEFAULT_STUDY_PRESET,
        updatedAt: 1,
      },
      {
        kind: "global-upsert",
        gameMode: "mixed",
        preset: { ...DEFAULT_STUDY_PRESET, mode: "mixed" },
        updatedAt: 2,
      },
      {
        kind: "global-upsert",
        gameMode: "flip",
        preset: { ...DEFAULT_STUDY_PRESET, direction: "a-b" },
        updatedAt: 3,
      },
      {
        kind: "list-upsert",
        gameMode: "mixed",
        listId: "list-1",
        override: { order: "sequential" },
        updatedAt: 4,
      },
    ]);

    expect(readPendingPreferenceWrites("user-1")).toEqual([
      {
        kind: "global-upsert",
        gameMode: "mixed",
        preset: { ...DEFAULT_STUDY_PRESET, mode: "mixed" },
        updatedAt: 2,
      },
      {
        kind: "global-upsert",
        gameMode: "flip",
        preset: { ...DEFAULT_STUDY_PRESET, direction: "a-b" },
        updatedAt: 3,
      },
      {
        kind: "list-upsert",
        gameMode: "mixed",
        listId: "list-1",
        override: { order: "sequential" },
        updatedAt: 4,
      },
    ]);
  });
});
