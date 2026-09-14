import { describe, expect, it } from "vitest";
import {
  executeContentImport,
  executeGlossaryImport,
  previewContentImport,
  previewGlossaryImport,
} from "../domain/importers";
import { getPitecoCapabilities } from "../domain/capabilities";
import { createHarness, FOLDER_A, LIST_A, buildTables } from "./fixtures";

const PACKAGE = {
  schema: "app-piteco-super-import" as const,
  version: "2.0" as const,
  package: {
    name: "Pacote oficial",
    folders: [{
      name: "Inglês B1",
      lists: [{
        name: "Phrasal Verbs",
        front_language: "en",
        back_language: "pt-BR",
        primary_side: "a" as const,
        study_type: "language" as const,
        glossary: [],
        cards: [{ type: "normal" as const, front: "work", back: "trabalhar" }],
      }],
    }],
  },
};

describe("official MCP importer domains", () => {
  it("returns the authenticated capability RPC without claiming unsupported rich features", async () => {
    const harness = createHarness(undefined, {
      rpc: {
        get_import_capabilities_v1: () => ({
          data: { contract_version: "1", engine_version: "2.0", capabilities: { basic_import: true, safe_import: true, enriched_fields: false, layered_cards: false } },
          error: null,
        }),
      },
    });
    const result = await getPitecoCapabilities(harness.db);
    expect(result.source).toBe("rpc");
    // Sem a v2 publicada, a leitura cai na v1 e reporta glossary como unknown.
    expect(result.capability_rpc).toBe("get_import_capabilities_v1");
    expect(result.capabilities.glossary).toBe("unknown");
    expect(result.capabilities.enriched_fields).toBe("missing");
    expect(harness.calls.some((call) => call.operation === "rpc" && call.rpcName === "get_import_capabilities_v1")).toBe(true);
  });

  it("prefers the v2 capability RPC and reports the official glossary importer state", async () => {
    const harness = createHarness(undefined, {
      rpc: {
        get_import_capabilities_v2: () => ({
          data: {
            contract_version: "1.1",
            engine_version: "2.0",
            capabilities: { basic_import: true, safe_import: true, enriched_fields: true, layered_cards: true, glossary: true },
          },
          error: null,
        }),
      },
    });
    const result = await getPitecoCapabilities(harness.db);
    expect(result.capability_rpc).toBe("get_import_capabilities_v2");
    expect(result.capabilities.glossary).toBe("ready");
    expect(result.importers.glossary.status).toBe("ready");
    expect(harness.calls.some((call) => call.operation === "rpc" && call.rpcName === "get_import_capabilities_v1")).toBe(false);
  });

  it("previews content locally without calling the transactional gateway", async () => {
    const harness = createHarness();
    const result = await previewContentImport(harness.db, {
      package: PACKAGE,
      destination: { folder: { id: FOLDER_A }, list: { id: LIST_A } },
      card_conflict: "skip",
    });
    expect(result.transaction.preview_is_transaction).toBe(false);
    expect(result.summary.cards).toBe(1);
    expect(harness.calls.filter((call) => call.operation === "rpc")).toHaveLength(0);
  });

  it("resolves reference ids through the ownership-scoped lote A helpers", async () => {
    const tables = buildTables();
    const folder = tables.folders.find((row) => row.id === FOLDER_A);
    const list = tables.lists.find((row) => row.id === LIST_A);
    if (!folder || !list) throw new Error("fixture incompleta");
    folder.reference_id = "F-K7M2Q9";
    list.reference_id = "L-7M2Q9K";
    list.folders = folder;
    const harness = createHarness(tables);
    const result = await previewContentImport(harness.db, {
      package: PACKAGE,
      destination: { folder: { reference_id: "F-K7M2Q9" }, list: { reference_id: "L-7M2Q9K" } },
      card_conflict: "skip",
    });
    expect(result.destination_plan.folders[0].folder).toEqual({ mode: "existing", folderId: FOLDER_A });
  });

  it("sends the rich package and index-based plan to the official personal gateway", async () => {
    const harness = createHarness(undefined, {
      rpc: {
        import_app_piteco_super_package_current: (params) => ({ data: { batch_id: "batch-1", ...params }, error: null }),
      },
    });
    const result = await executeContentImport(harness.db, {
      package: PACKAGE,
      destination: { folder: { id: FOLDER_A }, list: { id: LIST_A } },
      card_conflict: "skip",
      request_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      confirm: true,
    });
    expect(result.report.batch_id).toBe("batch-1");
    const call = harness.calls.find((item) => item.operation === "rpc" && item.rpcName === "import_app_piteco_super_package_current");
    expect(call && call.operation === "rpc" ? call.rpcParams : null).toMatchObject({
      _institution_id: null,
      _request_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      _card_conflict: "skip",
      _payload: PACKAGE,
    });
    expect(call && call.operation === "rpc" ? call.rpcParams._destination_plan : null).toEqual({
      folders: { 0: { folder: { mode: "existing", folderId: FOLDER_A }, lists: { 0: { mode: "existing", listId: LIST_A } } } },
    });
  });

  it("uses only the official folder glossary v2 RPC for preview and execute", async () => {
    const harness = createHarness(undefined, {
      rpc: {
        import_folder_glossary_v2: (params) => ({ data: { inserted: 1, ...params }, error: null }),
      },
    });
    const preview = await previewGlossaryImport(harness.db, {
      folder: { id: FOLDER_A }, entries: [{ term: "work", translation: "trabalho" }], mode: "merge",
    });
    expect(preview.transaction).toMatchObject({ preview_is_transaction: true, dry_run: true });
    await executeGlossaryImport(harness.db, {
      folder: { id: FOLDER_A }, entries: [{ term: "work", translation: "trabalho" }], mode: "replace", confirm: true,
    });
    const calls = harness.calls.filter((call) => call.operation === "rpc" && call.rpcName === "import_folder_glossary_v2");
    expect(calls).toHaveLength(2);
    expect(calls.map((call) => call.operation === "rpc" ? call.rpcParams._dry_run : null)).toEqual([true, false]);
    expect(calls.every((call) => call.operation === "rpc" && call.rpcParams._folder_id === FOLDER_A)).toBe(true);
  });
});
