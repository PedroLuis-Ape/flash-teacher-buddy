import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const state: {
    response: { count: number | null; error: unknown };
  } = {
    response: { count: 3, error: null },
  };

  const builder: any = {};
  builder.eq = vi.fn(() => builder);
  builder.in = vi.fn(() => builder);
  builder.then = (
    onFulfilled: (value: typeof state.response) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise.resolve(state.response).then(onFulfilled, onRejected);

  const remove = vi.fn(() => builder);
  const from = vi.fn(() => ({ delete: remove }));

  return {
    rpc: vi.fn(),
    from,
    remove,
    builder,
    state,
    loadPage: vi.fn(),
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: mocks.rpc, from: mocks.from },
}));

vi.mock("./lib/folderGlossaryApi", () => ({
  loadFolderGlossaryPage: mocks.loadPage,
}));

import { deleteFolderGlossaryBulk } from "./lib/folderGlossaryBulkDeleteApi";

const missingRpcError = {
  code: "PGRST202",
  message: "Could not find the function public.delete_folder_glossary_bulk_v1 in the schema cache",
};

const pageResult = (ids: string[], total = ids.length) => ({
  entries: ids.map((id) => ({ id })),
  total,
  page: 0,
  pageSize: 200,
  canEdit: true,
});

describe("folder glossary bulk deletion", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.rpc.mockResolvedValue({ data: { deleted: 3, scope: "ids" }, error: null });
    mocks.from.mockClear();
    mocks.remove.mockClear();
    mocks.builder.eq.mockClear();
    mocks.builder.in.mockClear();
    mocks.state.response = { count: 3, error: null };
    mocks.loadPage.mockReset();
  });

  it("deletes explicit selected ids without loading the whole glossary", async () => {
    await expect(deleteFolderGlossaryBulk("folder-1", {
      scope: "ids",
      ids: ["entry-1", "entry-2", "entry-3"],
    })).resolves.toMatchObject({ deleted: 3, scope: "ids" });

    expect(mocks.rpc).toHaveBeenCalledWith("delete_folder_glossary_bulk_v1", {
      _folder_id: "folder-1",
      _scope: "ids",
      _ids: ["entry-1", "entry-2", "entry-3"],
      _search: null,
      _side: null,
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("deletes every server-side search result across pages", async () => {
    mocks.rpc.mockResolvedValue({ data: { deleted: 42, scope: "filter" }, error: null });

    await expect(deleteFolderGlossaryBulk("folder-1", {
      scope: "filter",
      search: "news",
      side: "A",
    })).resolves.toMatchObject({ deleted: 42, scope: "filter" });

    expect(mocks.rpc).toHaveBeenCalledWith("delete_folder_glossary_bulk_v1", {
      _folder_id: "folder-1",
      _scope: "filter",
      _ids: null,
      _search: "news",
      _side: "A",
    });
  });

  it("supports deleting the complete folder glossary", async () => {
    mocks.rpc.mockResolvedValue({ data: { deleted: 20_000, scope: "all" }, error: null });

    await expect(deleteFolderGlossaryBulk("folder-1", { scope: "all" }))
      .resolves.toMatchObject({ deleted: 20_000, scope: "all" });
  });

  it("falls back to RLS-protected direct deletion for selected ids when the RPC is absent", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: missingRpcError });
    mocks.state.response = { count: 3, error: null };

    await expect(deleteFolderGlossaryBulk("folder-1", {
      scope: "ids",
      ids: ["entry-1", "entry-2", "entry-3"],
    })).resolves.toEqual({ deleted: 3, scope: "ids" });

    expect(mocks.from).toHaveBeenCalledWith("folder_glossary");
    expect(mocks.remove).toHaveBeenCalledWith({ count: "exact" });
    expect(mocks.builder.eq).toHaveBeenCalledWith("folder_id", "folder-1");
    expect(mocks.builder.in).toHaveBeenCalledWith("id", ["entry-1", "entry-2", "entry-3"]);
  });

  it("falls back to one direct folder deletion for apagar tudo", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: missingRpcError });
    mocks.loadPage.mockResolvedValue(pageResult(["entry-1"], 8_570));
    mocks.state.response = { count: 8_570, error: null };

    await expect(deleteFolderGlossaryBulk("folder-1", { scope: "all" }))
      .resolves.toEqual({ deleted: 8_570, scope: "all" });

    expect(mocks.loadPage).toHaveBeenCalledWith("folder-1", { page: 0, pageSize: 1 });
    expect(mocks.builder.eq).toHaveBeenCalledWith("folder_id", "folder-1");
    expect(mocks.builder.in).not.toHaveBeenCalled();
  });

  it("falls back to paged ids for filtered deletion while preserving the server search", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: missingRpcError });
    mocks.loadPage.mockResolvedValue(pageResult(["entry-1", "entry-2"], 2));
    mocks.state.response = { count: 2, error: null };

    await expect(deleteFolderGlossaryBulk("folder-1", {
      scope: "filter",
      search: "news",
      side: "B",
    })).resolves.toEqual({ deleted: 2, scope: "filter" });

    expect(mocks.loadPage).toHaveBeenCalledWith("folder-1", {
      page: 0,
      pageSize: 200,
      search: "news",
      side: "B",
    });
    expect(mocks.builder.in).toHaveBeenCalledWith("id", ["entry-1", "entry-2"]);
  });

  it("does not hide real database errors behind the fallback", async () => {
    const error = new Error("permission denied for table folder_glossary");
    mocks.rpc.mockResolvedValue({ data: null, error });

    await expect(deleteFolderGlossaryBulk("folder-1", { scope: "all" }))
      .rejects.toThrow("permission denied");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("rejects unsafe empty selections and empty filters", async () => {
    await expect(deleteFolderGlossaryBulk("folder-1", { scope: "ids", ids: [] }))
      .rejects.toThrow(/selecione pelo menos uma entrada/iu);
    await expect(deleteFolderGlossaryBulk("folder-1", { scope: "filter" }))
      .rejects.toThrow(/busca ou um filtro/iu);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("exposes checkboxes, all-results selection and typed full deletion", () => {
    const component = readFileSync(
      "src/features/study/components/FolderGlossaryBulkDeleteCard.tsx",
      "utf8",
    );
    const manager = readFileSync(
      "src/features/study/components/FolderGlossaryManager.tsx",
      "utf8",
    );
    const migration = readFileSync(
      "supabase/migrations/20260712203000_folder_glossary_bulk_delete.sql",
      "utf8",
    );
    const api = readFileSync(
      "src/features/study/lib/folderGlossaryBulkDeleteApi.ts",
      "utf8",
    );

    expect(component).toContain("Selecionar página");
    expect(component).toContain("Selecionar todos os");
    expect(component).toContain("Apagar selecionados");
    expect(component).toContain('const DELETE_ALL_PHRASE = "APAGAR TUDO"');
    expect(manager).toContain("FolderGlossaryBulkDeleteCard");
    expect(migration).toContain("delete_folder_glossary_bulk_v1");
    expect(migration).toContain("can_manage_folder_glossary_v1");
    expect(migration).toContain("GET DIAGNOSTICS v_deleted = ROW_COUNT");
    expect(api).toContain("isMissingBulkDeleteRpc");
    expect(api).toContain("deleteWithoutRpc");
    expect(api).toContain("delete({ count: \"exact\" })");
  });
});
