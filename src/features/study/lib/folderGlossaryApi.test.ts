import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FolderGlossaryInput } from "./folderGlossaryTypes";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: mocks.rpc,
    from: vi.fn(),
  },
}));

import { importFolderGlossary } from "./folderGlossaryApi";

function entries(count: number): FolderGlossaryInput[] {
  return Array.from({ length: count }, (_, index) => ({
    term: `term-${index}`,
    translation: `tradução-${index}`,
    side: "A",
    active: true,
  }));
}

function resultFor(args: Record<string, unknown>) {
  const chunk = args._entries as FolderGlossaryInput[];
  return {
    folder_id: args._folder_id,
    mode: args._mode,
    dry_run: args._dry_run,
    inserted: chunk.length,
    updated: 0,
    skipped: 0,
    removed: args._mode === "replace" ? 7 : 0,
  };
}

describe("large folder glossary imports", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
  });

  it("splits a large replacement into sequential RPC batches", async () => {
    mocks.rpc.mockImplementation(async (_name: string, args: Record<string, unknown>) => ({
      data: resultFor(args),
      error: null,
    }));
    const progress = vi.fn();

    const result = await importFolderGlossary(
      "folder-1",
      entries(400),
      "replace",
      false,
      { chunkSize: 180, onProgress: progress },
    );

    expect(mocks.rpc).toHaveBeenCalledTimes(3);
    expect(mocks.rpc.mock.calls.map(([, args]) => (args as Record<string, unknown>)._mode))
      .toEqual(["replace", "merge", "merge"]);
    expect(mocks.rpc.mock.calls.map(([, args]) => ((args as Record<string, unknown>)._entries as unknown[]).length))
      .toEqual([180, 180, 40]);
    expect(result).toMatchObject({ inserted: 400, removed: 7, mode: "replace" });
    expect(progress).toHaveBeenLastCalledWith({ processed: 400, total: 400 });
  });

  it("halves a slow batch and preserves replace only for the first successful piece", async () => {
    mocks.rpc.mockImplementation(async (_name: string, args: Record<string, unknown>) => {
      const chunk = args._entries as FolderGlossaryInput[];
      if (chunk.length > 100) {
        return {
          data: null,
          error: { code: "57014", message: "canceling statement due to statement timeout" },
        };
      }
      return { data: resultFor(args), error: null };
    });

    const result = await importFolderGlossary(
      "folder-1",
      entries(220),
      "replace",
      false,
      { chunkSize: 180 },
    );

    expect(mocks.rpc.mock.calls.map(([, args]) => ((args as Record<string, unknown>)._entries as unknown[]).length))
      .toEqual([180, 90, 90, 40]);
    expect(mocks.rpc.mock.calls.map(([, args]) => (args as Record<string, unknown>)._mode))
      .toEqual(["replace", "replace", "merge", "merge"]);
    expect(result).toMatchObject({ inserted: 220, removed: 7, mode: "replace" });
  });

  it("keeps adaptive retries for a medium import below the default chunk size", async () => {
    mocks.rpc.mockImplementation(async (_name: string, args: Record<string, unknown>) => {
      const chunk = args._entries as FolderGlossaryInput[];
      if (chunk.length > 100) {
        return {
          data: null,
          error: { code: "57014", message: "canceling statement due to statement timeout" },
        };
      }
      return { data: resultFor(args), error: null };
    });

    const result = await importFolderGlossary(
      "folder-1",
      entries(400),
      "merge",
    );

    expect(mocks.rpc.mock.calls.map(([, args]) => ((args as Record<string, unknown>)._entries as unknown[]).length))
      .toEqual([400, 200, 100, 100, 200, 100, 100]);
    expect(result).toMatchObject({ inserted: 400, updated: 0, mode: "merge" });
  });

  it("returns a clear error when even the minimum batch times out", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "57014", message: "canceling statement due to statement timeout" },
    });

    await expect(importFolderGlossary(
      "folder-1",
      entries(40),
      "merge",
      false,
      { chunkSize: 20 },
    )).rejects.toThrow(/lote de 20 entradas/iu);
  });
});
