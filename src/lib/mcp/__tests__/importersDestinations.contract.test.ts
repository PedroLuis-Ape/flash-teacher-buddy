import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { executeContentImport, previewContentImport } from "../domain/importers";
import { callsFor, createHarness, buildTables, makeFolderRow, makeListRow } from "./fixtures";

const SECOND_FOLDER_SAME_NAME = "11111111-1111-4111-8111-aaaaaaaaaaaa";
const SECOND_LIST_SAME_NAME = "aaaaaaaa-0001-4000-8000-000000000009";

function packageValue(options: { folder?: string; list?: string; layered?: boolean } = {}) {
  const cards = options.layered
    ? [{
      type: "layered" as const,
      group_title: "work",
      layers: [
        { front: "work", back: "trabalho" },
        { front: "work", back: "funcionar" },
      ],
    }]
    : [{ type: "normal" as const, front: "work", back: "trabalhar" }];
  return {
    schema: "app-piteco-super-import" as const,
    version: "2.0" as const,
    package: {
      name: "Pacote de destino",
      folders: [{
        name: options.folder ?? "Inglês B1",
        lists: [{
          name: options.list ?? "Phrasal Verbs",
          front_language: "en",
          back_language: "pt-BR",
          primary_side: "a" as const,
          study_type: "language" as const,
          glossary: [],
          cards,
        }],
      }],
    },
  };
}

describe("official importer destination safety", () => {
  it("rejects card_conflict=replace for layered packages, exactly like the official gateway", async () => {
    const harness = createHarness();
    await expect(previewContentImport(harness.db, {
      package: packageValue({ layered: true }),
      card_conflict: "replace",
    })).rejects.toThrowError(/E_LAYERED_REPLACE_UNSUPPORTED/);

    const gatewayHarness = createHarness(undefined, {
      rpc: { import_app_piteco_super_package_current: () => ({ data: { batch_id: "never" }, error: null }) },
    });
    await expect(executeContentImport(gatewayHarness.db, {
      package: packageValue({ layered: true }),
      card_conflict: "replace",
      request_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      confirm: true,
    })).rejects.toThrowError(/E_LAYERED_REPLACE_UNSUPPORTED/);
    expect(gatewayHarness.calls.filter((call) => call.operation === "rpc")).toHaveLength(0);
  });

  it("still accepts replace for packages without layered groups", async () => {
    const harness = createHarness();
    const result = await previewContentImport(harness.db, {
      package: packageValue(),
      card_conflict: "replace",
    });
    expect(result.validation.status).toBe("valid");
  });

  it("never picks a folder silently when two existing folders share the name", async () => {
    const tables = buildTables();
    tables.folders.push(makeFolderRow({ id: SECOND_FOLDER_SAME_NAME, title: "Inglês B1" }));
    const harness = createHarness(tables);
    await expect(previewContentImport(harness.db, {
      package: packageValue(),
      card_conflict: "skip",
    })).rejects.toThrowError(/ambiguous|corresponde a 2 pastas/i);
  });

  it("never picks a list silently when two existing lists in the folder share the name", async () => {
    const tables = buildTables();
    const folder = tables.folders.find((row) => row.id === "11111111-1111-4111-8111-111111111111");
    if (!folder) throw new Error("fixture incompleta");
    tables.lists.push(makeListRow({ id: SECOND_LIST_SAME_NAME, title: "Phrasal Verbs" }, folder));
    const harness = createHarness(tables);
    await expect(previewContentImport(harness.db, {
      package: packageValue(),
      card_conflict: "skip",
    })).rejects.toThrowError(/ambiguous|corresponde a 2 listas/i);
  });

  it("keeps uuid resolution of an existing destination working inside the ambiguous catalog", async () => {
    const tables = buildTables();
    tables.folders.push(makeFolderRow({ id: SECOND_FOLDER_SAME_NAME, title: "Inglês B1" }));
    const harness = createHarness(tables);
    const result = await previewContentImport(harness.db, {
      package: packageValue({ list: "Phrasal Verbs" }),
      destination: {
        folder: { id: "11111111-1111-4111-8111-111111111111" },
        list: { id: "aaaaaaaa-0001-4000-8000-000000000001" },
      },
      card_conflict: "skip",
    });
    expect(result.destination_plan.folders[0].folder).toEqual({
      mode: "existing",
      folderId: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("reads reference_id from the personal catalog that mirrors the gateway contract", async () => {
    const harness = createHarness();
    await previewContentImport(harness.db, {
      package: packageValue(),
      destination: {
        folder: { id: "11111111-1111-4111-8111-111111111111" },
        list: { id: "aaaaaaaa-0001-4000-8000-000000000001" },
      },
      card_conflict: "skip",
    });
    const foldersCall = callsFor(harness.calls, "folders")[0];
    const listsCall = callsFor(harness.calls, "lists")[0];
    expect(foldersCall?.columns).toContain("reference_id");
    expect(listsCall?.columns).toContain("reference_id");
  });

  it("resolves a mixed-case reference that the schema accepts", async () => {
    const tables = buildTables();
    const folder = tables.folders.find((row) => row.id === "11111111-1111-4111-8111-111111111111");
    const list = tables.lists.find((row) => row.id === "aaaaaaaa-0001-4000-8000-000000000001");
    if (!folder || !list) throw new Error("fixture incompleta");
    folder.reference_id = "F-K7M2Q9";
    list.reference_id = "L-7M2Q9K";
    const harness = createHarness(tables);
    const result = await previewContentImport(harness.db, {
      package: packageValue({ folder: "Inglês B1", list: "Phrasal Verbs" }),
      destination: { folder: { reference_id: "f-k7m2q9" }, list: { reference_id: "l-7m2q9k" } },
      card_conflict: "skip",
    });
    expect(result.destination_plan.folders[0].folder).toEqual({ mode: "existing", folderId: folder.id });
    expect(result.destination_plan.folders[0].lists[0]).toEqual({ mode: "existing", listId: list.id });
  });

  it("never offers a class or institution list as a personal import destination", async () => {
    const tables = buildTables();
    const folder = tables.folders.find((row) => row.id === "11111111-1111-4111-8111-111111111111");
    if (!folder) throw new Error("fixture incompleta");
    tables.lists.push(makeListRow({ id: SECOND_LIST_SAME_NAME, title: "Phrasal Verbs", class_id: "99999999-1111-4111-8111-999999999999" }, folder));
    tables.lists.push(makeListRow({ id: SECOND_FOLDER_SAME_NAME, title: "Phrasal Verbs", institution_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" }, folder));
    const harness = createHarness(tables);
    const result = await previewContentImport(harness.db, {
      package: packageValue({ folder: "Inglês B1", list: "Phrasal Verbs" }),
      destination: {
        folder: { id: "11111111-1111-4111-8111-111111111111" },
        list: { id: "aaaaaaaa-0001-4000-8000-000000000001" },
      },
      card_conflict: "skip",
    });
    const listsCall = callsFor(harness.calls, "lists")[0];
    const filters = (listsCall?.filters ?? []).map((filter) => `${filter.column} ${filter.op}`);
    expect(filters).toContain("class_id is");
    expect(filters).toContain("institution_id is");
    expect(result.destination_plan.folders[0].lists[0]).toEqual({
      mode: "existing",
      listId: "aaaaaaaa-0001-4000-8000-000000000001",
    });
  });

  it("compares consolidation against the real list languages, not bare defaults", async () => {
    const tables = buildTables();
    const folder = tables.folders.find((row) => row.id === "11111111-1111-4111-8111-111111111111");
    const list = tables.lists.find((row) => row.id === "aaaaaaaa-0001-4000-8000-000000000001");
    if (!folder || !list) throw new Error("fixture incompleta");
    folder.lang_a = "es";
    folder.lang_b = "fr";
    list.lang_a = "es";
    list.lang_b = "fr";
    const harness = createHarness(tables);
    const result = await previewContentImport(harness.db, {
      package: {
        ...packageValue({ folder: "Inglês B1", list: "Phrasal Verbs" }),
        package: {
          ...packageValue().package,
          source_language: "es",
          target_language: "fr",
        },
      },
      destination_plan: {
        folders: {
          0: {
            folder: { mode: "existing", folderId: folder.id as string },
            lists: { 0: { mode: "existing", listId: list.id as string, consolidate: true } },
          },
        },
      },
      card_conflict: "skip",
    });
    expect(result.validation.status).toBe("valid");
  });

  it("still rejects consolidation when the package sides do not match the target list", async () => {
    const tables = buildTables();
    const folder = tables.folders.find((row) => row.id === "11111111-1111-4111-8111-111111111111");
    const list = tables.lists.find((row) => row.id === "aaaaaaaa-0001-4000-8000-000000000001");
    if (!folder || !list) throw new Error("fixture incompleta");
    folder.lang_a = "es";
    folder.lang_b = "fr";
    list.lang_a = "es";
    list.lang_b = "fr";
    const harness = createHarness(tables);
    await expect(previewContentImport(harness.db, {
      package: {
        ...packageValue(),
        package: { ...packageValue().package, source_language: "en", target_language: "pt" },
      },
      destination_plan: {
        folders: {
          0: {
            folder: { mode: "existing", folderId: folder.id as string },
            lists: { 0: { mode: "existing", listId: list.id as string, consolidate: true } },
          },
        },
      },
      card_conflict: "skip",
    })).rejects.toThrowError(/lados do pacote/i);
  });
});

function migration(name: string): string {
  return readFileSync(fileURLToPath(new URL(`../../../../supabase/migrations/${name}`, import.meta.url)), "utf8");
}

describe("pending migrations publish the contracts the app already assumes", () => {
  it("adds reference_id to get_lists_with_card_counts", () => {
    const sql = migration("20260914132000_lists_with_card_counts_reference_id.sql");
    expect(sql).toMatch(/CREATE FUNCTION public\.get_lists_with_card_counts/);
    expect(sql).toMatch(/reference_id text,/);
    expect(sql).toMatch(/list_row\.reference_id,/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.get_lists_with_card_counts\(uuid\) TO authenticated/);
  });

  it("publishes the official glossary importer diagnosis without guessing", () => {
    const sql = migration("20260914133000_import_capabilities_glossary.sql");
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.get_import_capabilities_v2\(\)/);
    expect(sql).toMatch(/public\.import_folder_glossary_v2\(uuid,jsonb,text,boolean\)/);
    expect(sql).toMatch(/'glossary', v_glossary_ready/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.get_import_capabilities_v2\(\) TO authenticated/);
  });
});
