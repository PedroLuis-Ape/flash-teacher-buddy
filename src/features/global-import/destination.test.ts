import { describe, expect, it } from "vitest";
import {
  buildDefaultDestinationPlan,
  validateDestinationPlan,
  type ImportDestinationCatalog,
} from "./destination";
import {
  buildStableImportRpcPayload,
  CLASSROOM_IMPORT_RPC,
  getStableImportRpcName,
  PERSONAL_IMPORT_RPC,
} from "./mappedService";
import type { GlobalImportPackage } from "./schema";

const packageValue: GlobalImportPackage = {
  schema: "appteco-global-import",
  version: 1,
  package: {
    name: "Pacote livre",
    folders: [
      {
        name: "Inglês para Aeroporto",
        lists: [
          {
            name: "Check-in",
            cards: [{ front: "Where is the counter?", back: "Onde fica o balcão?" }],
          },
        ],
      },
      {
        name: "Phrasal Verbs",
        lists: [
          {
            name: "Movimento",
            cards: [{ front: "Get up", back: "Levantar-se" }],
          },
        ],
      },
    ],
  },
};

const catalog: ImportDestinationCatalog = {
  folders: [
    { id: "folder-airport", title: "Inglês para Aeroporto", lang_a: "en", lang_b: "pt-BR" },
    { id: "folder-existing", title: "Minha pasta antiga", lang_a: "en", lang_b: "pt-BR" },
  ],
  lists: [
    { id: "list-checkin", title: "Check-in", folder_id: "folder-airport" },
    { id: "list-old", title: "Lista antiga", folder_id: "folder-existing" },
  ],
};

describe("global import destination mapping", () => {
  it("suggests an exact existing folder/list match without changing arbitrary names", () => {
    const plan = buildDefaultDestinationPlan(packageValue, catalog);

    expect(plan.folders[0].folder).toEqual({ mode: "existing", folderId: "folder-airport" });
    expect(plan.folders[0].lists[0]).toEqual({ mode: "existing", listId: "list-checkin" });
    expect(plan.folders[1].folder).toEqual({ mode: "create", name: "Phrasal Verbs" });
    expect(plan.folders[1].lists[0]).toEqual({ mode: "create", name: "Movimento" });
  });

  it("accepts creating a new list inside an existing folder", () => {
    const plan = buildDefaultDestinationPlan(packageValue, catalog);
    plan.folders[1] = {
      folder: { mode: "existing", folderId: "folder-existing" },
      lists: { 0: { mode: "create", name: "Movimento" } },
    };

    expect(validateDestinationPlan(packageValue, catalog, plan)).toEqual([]);
  });

  it("rejects linking a list that belongs to another selected folder", () => {
    const plan = buildDefaultDestinationPlan(packageValue, catalog);
    plan.folders[1] = {
      folder: { mode: "existing", folderId: "folder-existing" },
      lists: { 0: { mode: "existing", listId: "list-checkin" } },
    };

    expect(validateDestinationPlan(packageValue, catalog, plan)[0]).toContain(
      "a lista não pertence à pasta selecionada",
    );
  });

  it("checks the language direction of each list during consolidation", () => {
    const mixed: GlobalImportPackage = {
      schema: "appteco-global-import",
      version: 1,
      package: {
        name: "Pacote misto",
        source_language: "en",
        target_language: "pt-BR",
        folders: [{
          name: "Origem",
          lists: [
            {
              name: "Compatível",
              cards: [{
                front: "Hello",
                back: "Olá",
                metadata: { front_language: "en-US", back_language: "pt" },
              }],
            },
            {
              name: "Invertida",
              cards: [{
                front: "Olá",
                back: "Hello",
                metadata: { front_language: "pt-BR", back_language: "en" },
              }],
            },
          ],
        }],
      },
    };
    const plan = {
      folders: {
        0: {
          folder: { mode: "existing" as const, folderId: "folder-existing" },
          lists: {
            0: { mode: "existing" as const, listId: "list-old", consolidate: true },
            1: { mode: "existing" as const, listId: "list-old", consolidate: true },
          },
        },
      },
    };

    expect(validateDestinationPlan(mixed, catalog, plan)).toContain(
      "Os lados do pacote não correspondem aos lados da lista escolhida. Revise o mapeamento antes de importar.",
    );
  });
});

describe("stable Super Import gateway contract", () => {
  const destinationPlan = { folders: {} } as never;
  const payload = { schema: "app-piteco-super-import", version: "2.0" } as never;

  it("uses only the stable personal gateway", () => {
    expect(getStableImportRpcName()).toBe(PERSONAL_IMPORT_RPC);
    expect(getStableImportRpcName(null)).toBe("import_app_piteco_super_package_current");
  });

  it("uses only the stable classroom gateway", () => {
    expect(getStableImportRpcName("turma-123")).toBe(CLASSROOM_IMPORT_RPC);
    expect(CLASSROOM_IMPORT_RPC).toBe("import_app_piteco_super_package_to_class_current");
  });

  it("builds the exact personal gateway parameters", () => {
    expect(buildStableImportRpcPayload({
      requestId: "request-123",
      payload,
      destinationPlan,
      cardConflict: "skip",
      institutionId: "institution-123",
    })).toEqual({
      _request_id: "request-123",
      _payload: payload,
      _destination_plan: destinationPlan,
      _card_conflict: "skip",
      _institution_id: "institution-123",
    });
  });

  it("uses _turma_id rather than _institution_id for classroom imports", () => {
    const rpcPayload = buildStableImportRpcPayload({
      requestId: "request-123",
      payload,
      destinationPlan,
      cardConflict: "replace",
      institutionId: "must-not-be-sent",
      turmaId: "turma-123",
    });

    expect(rpcPayload).toEqual({
      _request_id: "request-123",
      _payload: payload,
      _destination_plan: destinationPlan,
      _card_conflict: "replace",
      _turma_id: "turma-123",
    });
    expect(rpcPayload).not.toHaveProperty("_institution_id");
  });
});
