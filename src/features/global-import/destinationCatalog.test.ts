import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  calls: [] as Array<{ table: string; method: string; args: unknown[] }>,
  results: {
    folders: { data: [] as any[], error: null as unknown },
    lists: { data: [] as any[], error: null as unknown },
    turmas: { data: null as any, error: null as unknown },
  },
  user: { id: "user-1" } as { id: string } | null,
}));

function queryFor(table: "folders" | "lists" | "turmas") {
  const query: Record<string, any> = {};
  for (const method of ["select", "eq", "is", "in", "order"]) {
    query[method] = (...args: unknown[]) => {
      mocks.calls.push({ table, method, args });
      return query;
    };
  }
  query.maybeSingle = async () => mocks.results[table];
  query.then = (
    resolve: (value: unknown) => unknown,
    reject: (reason: unknown) => unknown,
  ) => Promise.resolve(mocks.results[table]).then(resolve, reject);
  return query;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: mocks.user } })),
    },
    from: vi.fn((table: "folders" | "lists" | "turmas") => queryFor(table)),
  },
}));

import {
  loadImportDestinationCatalog,
  normalizeImportDestinationCatalog,
} from "./destinationCatalog";

function hasCall(table: string, method: string, ...args: unknown[]) {
  return mocks.calls.some((call) => (
    call.table === table
    && call.method === method
    && JSON.stringify(call.args) === JSON.stringify(args)
  ));
}

describe("catálogo de destinos de flashcards", () => {
  beforeEach(() => {
    mocks.calls.length = 0;
    mocks.user = { id: "user-1" };
    mocks.results.folders = { data: [], error: null };
    mocks.results.lists = { data: [], error: null };
    mocks.results.turmas = { data: null, error: null };
  });

  it("limita a Biblioteca Geral ao owner, sem turma e sem instituição", async () => {
    mocks.results.folders.data = [
      { id: "folder-1", title: "Geral", institution_id: null, class_id: null },
    ];
    mocks.results.lists.data = [
      { id: "list-1", title: "Lista", folder_id: "folder-1", class_id: null },
    ];

    const catalog = await loadImportDestinationCatalog({
      scope: "personal",
      institutionId: null,
    });

    expect(catalog.folders.map((folder) => folder.id)).toEqual(["folder-1"]);
    expect(catalog.lists.map((list) => list.id)).toEqual(["list-1"]);
    expect(hasCall("folders", "eq", "owner_id", "user-1")).toBe(true);
    expect(hasCall("folders", "is", "deleted_at", null)).toBe(true);
    expect(hasCall("folders", "is", "class_id", null)).toBe(true);
    expect(hasCall("folders", "is", "institution_id", null)).toBe(true);
    expect(hasCall("lists", "in", "folder_id", ["folder-1"])).toBe(true);
    expect(hasCall("lists", "is", "class_id", null)).toBe(true);
  });

  it("limita a Biblioteca institucional à instituição selecionada", async () => {
    mocks.results.folders.data = [
      { id: "folder-inst", title: "Institucional", institution_id: "institution-1", class_id: null },
    ];

    await loadImportDestinationCatalog({
      scope: "personal",
      institutionId: "institution-1",
    });

    expect(hasCall("folders", "eq", "institution_id", "institution-1")).toBe(true);
    expect(hasCall("folders", "is", "class_id", null)).toBe(true);
  });

  it("mantém o catálogo da turma isolado por class_id", async () => {
    mocks.results.turmas.data = { id: "class-1", owner_teacher_id: "user-1" };
    mocks.results.folders.data = [
      { id: "folder-class", title: "Turma", institution_id: null, class_id: "class-1" },
    ];

    await loadImportDestinationCatalog({
      scope: "classroom",
      turmaId: "class-1",
    });

    expect(hasCall("turmas", "eq", "id", "class-1")).toBe(true);
    expect(hasCall("turmas", "eq", "owner_teacher_id", "user-1")).toBe(true);
    expect(hasCall("folders", "eq", "class_id", "class-1")).toBe(true);
    expect(hasCall("lists", "eq", "class_id", "class-1")).toBe(true);
  });

  it("remove duplicatas e listas que não pertencem às pastas válidas", () => {
    const catalog = normalizeImportDestinationCatalog({
      folders: [
        { id: "folder-1", title: "Primeira" },
        { id: "folder-1", title: "Duplicada" },
      ],
      lists: [
        { id: "list-1", title: "Válida", folder_id: "folder-1" },
        { id: "list-1", title: "Duplicada", folder_id: "folder-1" },
        { id: "list-2", title: "Fantasma", folder_id: "folder-other" },
      ],
    });

    expect(catalog.folders.map((folder) => folder.title)).toEqual(["Primeira"]);
    expect(catalog.lists.map((list) => list.title)).toEqual(["Válida"]);
  });
});
