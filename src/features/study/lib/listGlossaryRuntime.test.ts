import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const rpcRange = vi.fn();
  const rpc = vi.fn((functionName: string) => ({
    range: (from: number, to: number) => rpcRange(functionName, from, to),
  }));
  const from = vi.fn();
  const listMaybeSingle = vi.fn();
  const folderRange = vi.fn();

  const listBuilder = {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({ maybeSingle: listMaybeSingle })),
    })),
  };

  const folderBuilder: Record<string, any> = {};
  folderBuilder.select = vi.fn(() => folderBuilder);
  folderBuilder.eq = vi.fn(() => folderBuilder);
  folderBuilder.order = vi.fn(() => folderBuilder);
  folderBuilder.range = folderRange;

  from.mockImplementation((table: string) => table === "lists" ? listBuilder : folderBuilder);

  return {
    rpc,
    rpcRange,
    from,
    listMaybeSingle,
    folderRange,
    listBuilder,
    folderBuilder,
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: mocks.rpc,
    from: mocks.from,
  },
}));

import { loadListGlossaryRuntime } from "./listGlossaryRuntime";

function makeRpcEntry(index: number, originalText = `term-${String(index).padStart(4, "0")}`) {
  return {
    id: `entry-${index}`,
    owner_id: "owner-1",
    original_text: originalText,
    translated_text: `tradução-${index}`,
    note: null,
    side: "A" as const,
    is_active: true,
    created_at: "2026-07-13T00:00:00.000Z",
    updated_at: "2026-07-13T00:00:00.000Z",
  };
}

const rpcEntry = {
  ...makeRpcEntry(1, "history"),
  translated_text: "história",
};

const directEntry = {
  id: "entry-direct",
  owner_id: "owner-1",
  original_text: "enslaved",
  primary_translation: "escravizado",
  alternative_translations: ["subjugado"],
  note: "particípio",
  side: "A",
  is_active: true,
  created_at: "2026-07-13T00:00:00.000Z",
  updated_at: "2026-07-13T00:00:00.000Z",
};

beforeEach(() => {
  mocks.rpc.mockClear();
  mocks.rpcRange.mockReset();
  mocks.from.mockClear();
  mocks.listMaybeSingle.mockReset();
  mocks.folderRange.mockReset();
  mocks.listMaybeSingle.mockResolvedValue({ data: { folder_id: "folder-1" }, error: null });
  mocks.folderRange.mockResolvedValue({ data: [], error: null });
});

describe("list glossary runtime", () => {
  it("uses the canonical v2 RPC when it succeeds", async () => {
    mocks.rpcRange.mockResolvedValue({ data: [rpcEntry], error: null });

    const result = await loadListGlossaryRuntime("list-1");

    expect(result).toMatchObject({
      folderId: "folder-1",
      source: "rpc-v2",
      glossary: [rpcEntry],
    });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpcRange).toHaveBeenCalledWith("get_folder_glossary_for_list_v2", 0, 999);
    expect(mocks.folderRange).not.toHaveBeenCalled();
  });

  it("loads entries beyond the first 1,000-row API page", async () => {
    const firstPage = Array.from({ length: 1_000 }, (_, index) => makeRpcEntry(index));
    const laterEntry = {
      ...makeRpcEntry(1_000, "millions"),
      translated_text: "milhões",
    };

    mocks.rpcRange.mockImplementation((functionName: string, from: number) => {
      if (functionName !== "get_folder_glossary_for_list_v2") {
        return Promise.resolve({ data: [], error: null });
      }
      if (from === 0) return Promise.resolve({ data: firstPage, error: null });
      if (from === 1_000) return Promise.resolve({ data: [laterEntry], error: null });
      return Promise.resolve({ data: [], error: null });
    });

    const result = await loadListGlossaryRuntime("list-1");

    expect(result.source).toBe("rpc-v2");
    expect(result.glossary).toHaveLength(1_001);
    expect(result.glossary.at(-1)).toEqual(laterEntry);
    expect(mocks.rpcRange).toHaveBeenCalledWith("get_folder_glossary_for_list_v2", 1_000, 1_999);
  });

  it("recovers through the compatible v1 RPC instead of returning an empty glossary", async () => {
    mocks.rpcRange.mockImplementation((functionName: string) => {
      if (functionName === "get_folder_glossary_for_list_v2") {
        return Promise.resolve({
          data: null,
          error: { code: "57014", message: "statement timeout" },
        });
      }
      return Promise.resolve({ data: [rpcEntry], error: null });
    });

    const result = await loadListGlossaryRuntime("list-1");

    expect(result.source).toBe("rpc-v1");
    expect(result.glossary).toEqual([rpcEntry]);
    expect(result.recoveredFrom?.[0]).toMatch(/RPC v2.*57014/iu);
  });

  it("does not trust false-empty RPC responses when the folder still has entries", async () => {
    mocks.rpcRange.mockResolvedValue({ data: [], error: null });
    mocks.folderRange.mockResolvedValueOnce({ data: [directEntry], error: null });

    const result = await loadListGlossaryRuntime("list-1");

    expect(result.source).toBe("direct");
    expect(result.glossary).toEqual([
      expect.objectContaining({
        original_text: "enslaved",
        translated_text: "escravizado, subjugado",
      }),
    ]);
    expect(result.recoveredFrom).toEqual([
      expect.stringMatching(/RPC v2.*0 entradas/iu),
      expect.stringMatching(/RPC v1.*0 entradas/iu),
    ]);
  });

  it("falls back to a paginated direct read and preserves grouped translations", async () => {
    mocks.rpcRange.mockResolvedValue({
      data: null,
      error: { code: "PGRST202", message: "function missing" },
    });
    mocks.folderRange.mockResolvedValueOnce({
      data: [directEntry],
      error: null,
    });

    const result = await loadListGlossaryRuntime("list-1");

    expect(result.source).toBe("direct");
    expect(result.glossary).toEqual([
      expect.objectContaining({
        original_text: "enslaved",
        translated_text: "escravizado, subjugado",
        side: "A",
      }),
    ]);
    expect(mocks.folderRange).toHaveBeenCalledWith(0, 999);
  });

  it("does not disguise permission failures as an empty glossary", async () => {
    const denied = { code: "42501", message: "permission denied" };
    mocks.rpcRange.mockResolvedValueOnce({ data: null, error: denied });

    await expect(loadListGlossaryRuntime("list-1")).rejects.toBe(denied);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.folderRange).not.toHaveBeenCalled();
  });

  it("returns a diagnostic error without deleting or replacing data", async () => {
    mocks.rpcRange.mockResolvedValue({
      data: null,
      error: { code: "57014", message: "statement timeout" },
    });
    mocks.folderRange.mockResolvedValueOnce({
      data: null,
      error: { code: "08006", message: "connection failure" },
    });

    await expect(loadListGlossaryRuntime("list-1")).rejects.toThrow(
      /não pôde ser carregado.*Nenhum dado foi apagado.*RPC v2.*RPC v1.*leitura direta/iu,
    );
  });
});
