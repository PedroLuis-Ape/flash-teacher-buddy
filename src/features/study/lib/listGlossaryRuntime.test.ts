import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const rpc = vi.fn();
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

const rpcEntry = {
  id: "entry-1",
  owner_id: "owner-1",
  original_text: "history",
  translated_text: "história",
  note: null,
  side: "A" as const,
  is_active: true,
  created_at: "2026-07-13T00:00:00.000Z",
  updated_at: "2026-07-13T00:00:00.000Z",
};

beforeEach(() => {
  mocks.rpc.mockReset();
  mocks.from.mockClear();
  mocks.listMaybeSingle.mockReset();
  mocks.folderRange.mockReset();
  mocks.listMaybeSingle.mockResolvedValue({ data: { folder_id: "folder-1" }, error: null });
  mocks.folderRange.mockResolvedValue({ data: [], error: null });
});

describe("list glossary runtime", () => {
  it("uses the canonical v2 RPC when it succeeds", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: [rpcEntry], error: null });

    const result = await loadListGlossaryRuntime("list-1");

    expect(result).toMatchObject({
      folderId: "folder-1",
      source: "rpc-v2",
      glossary: [rpcEntry],
    });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.folderRange).not.toHaveBeenCalled();
  });

  it("recovers through the compatible v1 RPC instead of returning an empty glossary", async () => {
    mocks.rpc
      .mockResolvedValueOnce({
        data: null,
        error: { code: "57014", message: "statement timeout" },
      })
      .mockResolvedValueOnce({ data: [rpcEntry], error: null });

    const result = await loadListGlossaryRuntime("list-1");

    expect(result.source).toBe("rpc-v1");
    expect(result.glossary).toEqual([rpcEntry]);
    expect(result.recoveredFrom?.[0]).toMatch(/RPC v2.*57014/iu);
  });

  it("falls back to a paginated direct read and preserves grouped translations", async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: null, error: { code: "PGRST202", message: "v2 missing" } })
      .mockResolvedValueOnce({ data: null, error: { code: "PGRST202", message: "v1 missing" } });
    mocks.folderRange.mockResolvedValueOnce({
      data: [{
        id: "entry-2",
        owner_id: "owner-1",
        original_text: "enslaved",
        primary_translation: "escravizado",
        alternative_translations: ["subjugado"],
        note: "particípio",
        side: "A",
        is_active: true,
        created_at: "2026-07-13T00:00:00.000Z",
        updated_at: "2026-07-13T00:00:00.000Z",
      }],
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
    mocks.rpc.mockResolvedValueOnce({ data: null, error: denied });

    await expect(loadListGlossaryRuntime("list-1")).rejects.toBe(denied);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.folderRange).not.toHaveBeenCalled();
  });

  it("returns a diagnostic error without deleting or replacing data", async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: null, error: { code: "57014", message: "v2 timeout" } })
      .mockResolvedValueOnce({ data: null, error: { code: "57014", message: "v1 timeout" } });
    mocks.folderRange.mockResolvedValueOnce({
      data: null,
      error: { code: "08006", message: "connection failure" },
    });

    await expect(loadListGlossaryRuntime("list-1")).rejects.toThrow(
      /não pôde ser carregado.*Nenhum dado foi apagado.*RPC v2.*RPC v1.*leitura direta/iu,
    );
  });
});
