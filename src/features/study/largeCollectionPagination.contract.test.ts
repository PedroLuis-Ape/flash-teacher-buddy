import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("large collection pagination contracts", () => {
  it("paginates cards in list detail and study routes", () => {
    expect(read("src/pages/ListDetail.tsx")).toContain("fetchAllSupabaseRows<Flashcard>");
    expect(read("src/pages/Study.tsx")).toContain("loadStudyDeck<Flashcard>");
    expect(read("src/features/study/lib/studyDeckLoader.ts")).toContain("fetchAllSupabaseRows(fetchPage)");
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

describe("list detail progressive loading semantics", () => {
  const source = read("src/pages/ListDetail.tsx");

  it("renders a fast real first page before the full set arrives", () => {
    expect(source).toContain('queryKey: ["flashcards", id, "first-page"]');
    expect(source).toContain("fetchFlashcardPage(0, PAGE_SIZE - 1)");
    expect(source).toContain("allFlashcards ?? firstFlashcardPage ?? []");
  });

  it("still loads the whole list so search, layers, selection and export stay correct", () => {
    expect(source).toContain("fetchAllSupabaseRows<Flashcard>(fetchFlashcardPage)");
    expect(source).toContain("const isFullListLoading = allFlashcardsLoading");
    // "Selecionar todos" nunca opera em um conjunto parcial silenciosamente.
    expect(source).toContain("if (isFullListLoading) {");
    expect(source).toContain("library.list.loadingFullList");
  });

  it("shares one page fetcher between first page and full load (no N+1 duplication)", () => {
    expect(source.match(/const fetchFlashcardPage = useCallback/g)?.length).toBe(1);
  });
});
