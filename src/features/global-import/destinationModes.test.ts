import { describe, expect, it } from "vitest";
import { GLOBAL_IMPORT_SCHEMA, GLOBAL_IMPORT_VERSION, type GlobalImportPackage } from "./schema";
import {
  prepareGlobalImportDestination,
  type ExistingListConflictPolicy,
} from "./destinationModes";
import type { ImportDestinationCatalog } from "./destination";

function packageWithFolders(): GlobalImportPackage {
  return {
    schema: GLOBAL_IMPORT_SCHEMA,
    version: GLOBAL_IMPORT_VERSION,
    package: {
      name: "Pacote variável",
      folders: [
        {
          name: "Pasta X",
          expected_cards: 2,
          lists: [
            {
              name: "Lista A",
              expected_cards: 2,
              cards: [
                { front: "A1", back: "A1 traduzido" },
                { front: "A2", back: "A2 traduzido" },
              ],
            },
          ],
        },
        {
          name: "Pasta Y",
          expected_cards: 1,
          lists: [
            {
              name: "Lista B",
              expected_cards: 1,
              cards: [{ front: "B1", back: "B1 traduzido" }],
            },
          ],
        },
      ],
    },
  };
}

const catalog: ImportDestinationCatalog = {
  folders: [{ id: "folder-1", title: "Destino existente" }],
  lists: [{ id: "list-1", title: "Lista A", folder_id: "folder-1" }],
};

function prepare(policy: ExistingListConflictPolicy) {
  return prepareGlobalImportDestination(packageWithFolders(), catalog, {
    mode: "existing-folder",
    existingFolderId: "folder-1",
    listConflictPolicy: policy,
  });
}

describe("modos de destino do Super Importador", () => {
  it("usa uma pasta existente como destino único e ignora as pastas do conteúdo", () => {
    const result = prepare("append");
    expect(result.errors).toEqual([]);
    expect(result.packageValue?.package.folders).toHaveLength(1);
    expect(result.packageValue?.package.folders[0].name).toBe("Destino existente");
    expect(result.packageValue?.package.folders[0].lists.map((list) => list.name))
      .toEqual(["Lista A", "Lista B"]);
    expect(result.plan?.folders[0].folder).toEqual({ mode: "existing", folderId: "folder-1" });
    expect(result.warnings.some((warning) => warning.includes("nomes de pasta"))).toBe(true);
  });

  it("cria uma nova pasta única definida na interface", () => {
    const result = prepareGlobalImportDestination(packageWithFolders(), catalog, {
      mode: "new-folder",
      newFolderName: "Pasta escolhida pelo usuário",
    });
    expect(result.errors).toEqual([]);
    expect(result.packageValue?.package.folders[0].name).toBe("Pasta escolhida pelo usuário");
    expect(result.plan?.folders[0].folder).toEqual({
      mode: "create",
      name: "Pasta escolhida pelo usuário",
    });
    expect(result.packageValue?.package.folders[0].lists).toHaveLength(2);
  });

  it("preserva várias pastas quando a estrutura vem do conteúdo", () => {
    const source = packageWithFolders();
    const result = prepareGlobalImportDestination(source, catalog, { mode: "from-file" });
    expect(result.errors).toEqual([]);
    expect(result.packageValue?.package.folders.map((folder) => folder.name))
      .toEqual(["Pasta X", "Pasta Y"]);
    expect(result.plan?.folders[0].folder).toEqual({ mode: "create", name: "Pasta X" });
    expect(result.plan?.folders[1].folder).toEqual({ mode: "create", name: "Pasta Y" });
  });

  it("permite adicionar cards à lista existente", () => {
    const result = prepare("append");
    expect(result.plan?.folders[0].lists[0]).toEqual({
      mode: "existing",
      listId: "list-1",
      strategy: "append",
    });
  });

  it("permite substituir uma lista somente após escolha explícita", () => {
    const result = prepare("replace");
    expect(result.plan?.folders[0].lists[0]).toEqual({
      mode: "existing",
      listId: "list-1",
      strategy: "replace",
    });
  });

  it("numera uma lista conflitante quando essa política é escolhida", () => {
    const result = prepare("rename");
    expect(result.packageValue?.package.folders[0].lists[0].name).toBe("Lista A (2)");
    expect(result.plan?.folders[0].lists[0]).toEqual({ mode: "create", name: "Lista A (2)" });
  });

  it("ignora apenas a lista conflitante quando essa política é escolhida", () => {
    const result = prepare("skip");
    expect(result.skippedLists).toBe(1);
    expect(result.packageValue?.package.folders[0].lists.map((list) => list.name))
      .toEqual(["Lista B"]);
  });
});
