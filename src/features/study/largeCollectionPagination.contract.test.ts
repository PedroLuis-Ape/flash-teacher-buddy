import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("large collection pagination contracts", () => {
  it("paginates cards in list detail and study routes", () => {
    expect(read("src/pages/ListDetail.tsx")).toContain("fetchAllSupabaseRows<Flashcard>");
    expect(read("src/pages/Study.tsx")).toContain("fetchAllSupabaseRows<Flashcard>");
  });

  it("paginates folder glossary, list glossary and account glossary reads", () => {
    expect(read("src/features/study/lib/folderGlossaryApi.ts")).toContain("loadFolderGlossaryRows");
    expect(read("src/features/study/lib/folderGlossaryApi.ts")).toContain("fetchAllSupabaseRows<FolderGlossaryEntry>");
    expect(read("src/features/study/lib/accountGlossaryApi.ts")).toContain("fetchAllSupabaseRows<AccountGlossaryEntry>");
  });

  it("paginates folder export and forced glossary synchronization", () => {
    expect(read("src/features/export/folderExport.ts")).toContain("fetchAllSupabaseRows<ListRow>");
    expect(read("src/features/study/lib/folderGlossarySyncApi.ts")).toContain("fetchAllSupabaseRows<{ id: string }>");
  });

  it("paginates large favorites and red-list scopes", () => {
    expect(read("src/hooks/useFavorites.ts")).toContain("fetchAllSupabaseRows<{ group_id: string }>");
    expect(read("src/hooks/useRedList.ts")).toContain("fetchAllSupabaseRows<{ group_id: string }>");
  });
});
