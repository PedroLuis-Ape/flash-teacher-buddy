import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tables = new Map<string, Record<string, unknown>[]>();
  const calls: Array<{ table: string; filters: Array<[string, unknown]> }> = [];

  const from = vi.fn((table: string) => {
    const record = { table, filters: [] as Array<[string, unknown]> };
    calls.push(record);
    const builder: any = {
      select: () => builder,
      is: () => builder,
      order: () => builder,
      eq: (column: string, value: unknown) => {
        record.filters.push([column, value]);
        return builder;
      },
      in: (column: string, value: unknown) => {
        record.filters.push([column, value]);
        return builder;
      },
      range: (start: number, end: number) => {
        const rows = tables.get(table) ?? [];
        const scoped = record.filters.length > 0
          ? rows.filter((row) => record.filters.every(([column, value]) =>
              Array.isArray(value) ? value.includes(row[column]) : row[column] === value))
          : rows;
        return Promise.resolve({ data: scoped.slice(start, end + 1), error: null });
      },
    };
    return builder;
  });

  return { from, tables, calls };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));

import { assembleLibraryExport, buildLibraryExport, LIBRARY_EXPORT_SCHEMA } from "./libraryExport";

const USER = "user-1";
const OTHER = "user-2";

beforeEach(() => {
  mocks.tables.clear();
  mocks.calls.length = 0;
});

describe("global library export payload", () => {
  it("preserves multiple folders, lists, layers and repeated cards without deduplication", () => {
    const result = assembleLibraryExport({
      userId: USER,
      folders: [
        { id: "f1", title: "Pasta 1" },
        { id: "f2", title: "Pasta 2" },
      ],
      lists: [
        { id: "l1", folder_id: "f1", title: "Lista 1" },
        { id: "l2", folder_id: "f1", title: "Lista vazia" },
        { id: "l3", folder_id: "f2", title: "Lista 3" },
      ],
      cards: [
        { id: "c1", list_id: "l1", term: "run", translation: "correr" },
        { id: "c2", list_id: "l1", term: "run", translation: "correr" },
        { id: "c3", list_id: "l1", term: "run", translation: "administrar", parent_card_id: "c1", layer_index: 1 },
        { id: "c4", list_id: "l3", term: "book", translation: "livro" },
      ],
      folderGlossary: [{ id: "g1", folder_id: "f1", original_text: "run" }],
      listGlossary: [{ id: "lg1", list_id: "l1", original_text: "run" }],
      accountGlossary: [{ id: "ag1", original_text: "run" }],
    });

    expect(result.payload.schema).toBe(LIBRARY_EXPORT_SCHEMA);
    expect(result.payload.version).toBe("1.0");
    expect(result.payload.folders).toHaveLength(2);
    expect(result.payload.folders[0].lists).toHaveLength(2);
    expect(result.payload.folders[0].lists[0].cards).toHaveLength(3);
    expect(result.payload.folders[0].lists[0].cards.map((card) => card.id)).toEqual(["c1", "c2", "c3"]);
    expect(result.payload.folders[0].glossary).toHaveLength(1);
    expect(result.payload.folders[0].lists[0].glossary).toHaveLength(1);
    expect(result.payload.account_glossary).toHaveLength(1);
    expect(result.summary).toMatchObject({
      folders: 2,
      lists: 3,
      cards: 4,
      topLevelCards: 3,
      layerCards: 1,
      emptyLists: 1,
    });
    expect(JSON.parse(result.jsonText).folders[1].lists[0].cards[0].id).toBe("c4");
  });

  it("keeps lists and cards whose parent is missing instead of dropping them", () => {
    const result = assembleLibraryExport({
      userId: USER,
      folders: [],
      lists: [{ id: "l9", folder_id: null, title: "Solta" }],
      cards: [{ id: "c9", list_id: null, term: "x", translation: "y" }],
      folderGlossary: [],
      listGlossary: [],
      accountGlossary: [],
    });

    expect(result.payload.lists_without_folder).toHaveLength(1);
    expect(result.payload.cards_without_list).toHaveLength(1);
    expect(result.summary.listsWithoutFolder).toBe(1);
  });
});

describe("global library export reads", () => {
  it("only exports rows owned by the authenticated user", async () => {
    mocks.tables.set("folders", [
      { id: "f1", owner_id: USER, title: "Minha" },
      { id: "fx", owner_id: OTHER, title: "De outro" },
    ]);
    mocks.tables.set("lists", [
      { id: "l1", owner_id: USER, folder_id: "f1", title: "Lista" },
      { id: "lx", owner_id: OTHER, folder_id: "fx", title: "Outra" },
    ]);
    mocks.tables.set("flashcards", [
      { id: "c1", user_id: USER, list_id: "l1", term: "a", translation: "b" },
      { id: "cx", user_id: OTHER, list_id: "lx", term: "a", translation: "b" },
    ]);

    const result = await buildLibraryExport(USER);

    expect(result.summary).toMatchObject({ folders: 1, lists: 1, cards: 1 });
    expect(result.jsonText).not.toContain("fx");
    expect(mocks.calls.some((call) => call.table === "flashcards" && call.filters.some(([c, v]) => c === "user_id" && v === USER))).toBe(true);
  });

  it("pages through large libraries instead of stopping at 1000 rows", async () => {
    mocks.tables.set("folders", [{ id: "f1", owner_id: USER, title: "Grande" }]);
    mocks.tables.set("lists", [{ id: "l1", owner_id: USER, folder_id: "f1", title: "Lista" }]);
    mocks.tables.set(
      "flashcards",
      Array.from({ length: 2_300 }, (_, index) => ({
        id: `c${index}`,
        user_id: USER,
        list_id: "l1",
        term: "run",
        translation: "correr",
      })),
    );

    const result = await buildLibraryExport(USER);

    expect(result.summary.cards).toBe(2_300);
    expect(result.payload.folders[0].lists[0].cards).toHaveLength(2_300);
  });

  it("refuses to run without an authenticated user", async () => {
    await expect(buildLibraryExport("")).rejects.toThrow(/Entre na sua conta/);
  });
});

describe("global library export contracts", () => {
  it("is read-only and reuses the folder export download helper", () => {
    const source = readFileSync("src/features/export/libraryExport.ts", "utf8");
    expect(source).not.toMatch(/\.delete\(|\.update\(|\.insert\(|\.upsert\(/);
    expect(source).toContain("fetchAllSupabaseRows");
    expect(readFileSync("src/features/export/LibraryExportDialog.tsx", "utf8")).toContain("downloadExportFile");
  });

  it("exposes the global action in the personal library and keeps folder export untouched", () => {
    const library = readFileSync("src/features/library/FoldersOptimized.tsx", "utf8");
    expect(library).toContain("LibraryExportDialog");
    const folderExport = readFileSync("src/features/export/folderExport.ts", "utf8");
    expect(folderExport).toContain("app-piteco-super-import");
    expect(folderExport).toContain("buildFolderExport");
  });
});
