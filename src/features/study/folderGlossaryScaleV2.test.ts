import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../../supabase/migrations/20260712194500_folder_glossary_scale_v2.sql", import.meta.url),
  "utf8",
);
const api = readFileSync(new URL("./lib/folderGlossaryApi.ts", import.meta.url), "utf8");
const manager = readFileSync(
  new URL("./components/FolderGlossaryManagerCore.tsx", import.meta.url),
  "utf8",
);
const hook = readFileSync(new URL("../../hooks/useFolderGlossary.ts", import.meta.url), "utf8");


describe("large folder glossary architecture", () => {
  it("installs canonical identity and set-based import functions", () => {
    expect(migration).toContain("folder_glossary_identity_v2");
    expect(migration).toContain("identity_key");
    expect(migration).toContain("import_folder_glossary_v2");
    expect(migration).toContain("ON CONFLICT (folder_id, side, identity_key)");
  });

  it("exposes server-side summary, pagination and compact study rows", () => {
    expect(migration).toContain("get_folder_glossary_summary_v2");
    expect(migration).toContain("search_folder_glossary_page_v2");
    expect(migration).toContain("get_folder_glossary_for_list_v2");
    expect(api).toContain('rpc("search_folder_glossary_page_v2"');
    expect(api).toContain('rpc("get_folder_glossary_for_list_v2"');
  });

  it("renders only one page and debounces searches", () => {
    expect(manager).toContain("const PAGE_SIZE = 60");
    expect(manager).toContain("const SEARCH_DELAY_MS = 300");
    expect(manager).toContain("useFolderGlossaryPage");
    expect(manager).toContain("Exibindo");
    expect(manager).not.toContain("filtered.map");
  });

  it("keeps full downloads explicit instead of running on mount", () => {
    expect(manager).toContain("await loadFolderGlossary(folderId)");
    expect(hook).toContain("Compatibilidade para componentes antigos");
    expect(hook).not.toContain("queryFn: () => loadFolderGlossary(folderId as string)");
  });

  it("compacts repeated imports before calling PostgreSQL", () => {
    expect(api).toContain("compactFolderGlossaryEntries(entries)");
    expect(api).toContain('rpc("import_folder_glossary_v2"');
    expect(api).toContain("DEFAULT_IMPORT_CHUNK_SIZE = 1_000");
  });
});
