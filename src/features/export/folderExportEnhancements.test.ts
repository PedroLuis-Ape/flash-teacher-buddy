import { afterEach, describe, expect, it, vi } from "vitest";
import { SMART_IMPORT_LIMITS, smartNormalCardSchema } from "@/features/smart-import/schema";
import {
  clearFolderExportHistory,
  readFolderExportHistory,
  recordFolderExport,
} from "./folderExportHistory";

function installLocalStorage() {
  const values = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("large folder exports", () => {
  it("accepts card sides that exceed the former 8,000 character limit", () => {
    const result = smartNormalCardSchema.safeParse({
      type: "normal",
      front: "A".repeat(12_000),
      back: "B".repeat(12_000),
    });

    expect(result.success).toBe(true);
    expect(SMART_IMPORT_LIMITS.maxTextLength).toBe(250_000);
    expect(SMART_IMPORT_LIMITS.maxFileBytes).toBe(50 * 1024 * 1024);
  });

  it("keeps a high technical ceiling instead of an unlimited browser payload", () => {
    const result = smartNormalCardSchema.safeParse({
      type: "normal",
      front: "A".repeat(SMART_IMPORT_LIMITS.maxTextLength + 1),
      back: "ok",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toContain("250.000");
  });
});

describe("folder export history", () => {
  it("records folder names, totals, format and date", () => {
    installLocalStorage();

    recordFolderExport({
      format: "json",
      fileName: "verbos.json",
      sources: [{ id: "folder-1", title: "Verbos" }],
      summary: { folders: 1, lists: 3, cards: 120, layeredGroups: 0, emptyLists: 0 },
    });

    const history = readFolderExportHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      format: "json",
      fileName: "verbos.json",
      folders: [{ id: "folder-1", title: "Verbos" }],
      summary: { folders: 1, lists: 3, cards: 120 },
    });
    expect(Number.isNaN(Date.parse(history[0].exportedAt))).toBe(false);
  });

  it("clears the recent export history", () => {
    installLocalStorage();
    recordFolderExport({
      format: "txt",
      fileName: "teste.txt",
      sources: [{ id: "folder-1", title: "Teste" }],
      summary: { folders: 1, lists: 1, cards: 1, layeredGroups: 0, emptyLists: 0 },
    });

    clearFolderExportHistory();
    expect(readFolderExportHistory()).toEqual([]);
  });
});
