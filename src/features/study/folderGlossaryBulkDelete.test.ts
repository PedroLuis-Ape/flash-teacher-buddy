import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: mocks.rpc },
}));

import { deleteFolderGlossaryBulk } from "./lib/folderGlossaryBulkDeleteApi";

describe("folder glossary bulk deletion", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.rpc.mockResolvedValue({ data: { deleted: 3, scope: "ids" }, error: null });
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

    expect(component).toContain("Selecionar página");
    expect(component).toContain("Selecionar todos os");
    expect(component).toContain("Apagar selecionados");
    expect(component).toContain('const DELETE_ALL_PHRASE = "APAGAR TUDO"');
    expect(manager).toContain("FolderGlossaryBulkDeleteCard");
    expect(migration).toContain("delete_folder_glossary_bulk_v1");
    expect(migration).toContain("can_manage_folder_glossary_v1");
    expect(migration).toContain("GET DIAGNOSTICS v_deleted = ROW_COUNT");
  });
});
