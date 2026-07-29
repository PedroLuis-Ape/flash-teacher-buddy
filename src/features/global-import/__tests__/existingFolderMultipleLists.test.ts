import { describe, expect, it } from "vitest";
import type { ImportDestinationCatalog } from "../destination";
import { prepareGlobalImportDestination } from "../destinationModes";
import type { GlobalImportPackage } from "../schema";

function packageWithThreeLists(): GlobalImportPackage {
  return {
    schema: "appteco-global-import",
    version: 1,
    package: {
      name: "Pacote com três listas",
      folders: [{
        name: "Pasta informada no JSON",
        lists: [
          { name: "Afirmativo", cards: [{ front: "I can go.", back: "Eu posso ir." }] },
          { name: "Negativo", cards: [{ front: "I cannot go.", back: "Eu não posso ir." }] },
          { name: "Interrogativo", cards: [{ front: "Can I go?", back: "Eu posso ir?" }] },
        ],
      }],
    },
  };
}

const catalog: ImportDestinationCatalog = {
  folders: [{ id: "folder-existing", title: "Modais" }],
  lists: [
    { id: "list-existing", title: "Confirming Places", folder_id: "folder-existing" },
    { id: "list-other-folder", title: "Outra pasta", folder_id: "folder-other" },
  ],
};

describe("existing folder with multiple imported lists", () => {
  it("keeps all three lists separate inside the selected folder", () => {
    const prepared = prepareGlobalImportDestination(packageWithThreeLists(), catalog, {
      mode: "existing-folder",
      existingFolderId: "folder-existing",
      listConflictPolicy: "rename",
    });

    expect(prepared.errors).toEqual([]);
    expect(prepared.packageValue?.package.folders).toHaveLength(1);
    expect(prepared.packageValue?.package.folders[0].name).toBe("Modais");
    expect(prepared.packageValue?.package.folders[0].lists.map((list) => list.name)).toEqual([
      "Afirmativo",
      "Negativo",
      "Interrogativo",
    ]);
    expect(prepared.plan?.folders[0].folder).toEqual({
      mode: "existing",
      folderId: "folder-existing",
    });
    expect(prepared.plan?.folders[0].lists).toEqual({
      0: { mode: "create", name: "Afirmativo" },
      1: { mode: "create", name: "Negativo" },
      2: { mode: "create", name: "Interrogativo" },
    });
    expect(prepared.warnings[0]).toContain("3 lista(s) recebidas");
    expect(prepared.warnings[0]).toContain("3 serão importadas separadamente");
    expect(prepared.warnings[0]).toContain("3 nova(s)");
  });

  it("creates a numbered list instead of silently appending when names collide", () => {
    const prepared = prepareGlobalImportDestination(packageWithThreeLists(), {
      ...catalog,
      lists: [{ id: "list-existing", title: "Afirmativo", folder_id: "folder-existing" }],
    }, {
      mode: "existing-folder",
      existingFolderId: "folder-existing",
      listConflictPolicy: "rename",
    });

    expect(prepared.errors).toEqual([]);
    expect(prepared.packageValue?.package.folders[0].lists[0].name).toBe("Afirmativo (2)");
    expect(prepared.plan?.folders[0].lists[0]).toEqual({
      mode: "create",
      name: "Afirmativo (2)",
    });
  });

  it("consolida os novos cards na lista existente escolhida antes da análise", () => {
    const prepared = prepareGlobalImportDestination(packageWithThreeLists(), catalog, {
      mode: "existing-folder",
      existingFolderId: "folder-existing",
      existingListId: "list-existing",
      existingListStrategy: "append",
    });

    expect(prepared.errors).toEqual([]);
    expect(prepared.plan?.folders[0].lists).toEqual({
      0: {
        mode: "existing",
        listId: "list-existing",
        strategy: "append",
        consolidate: true,
      },
      1: {
        mode: "existing",
        listId: "list-existing",
        strategy: "append",
        consolidate: true,
      },
      2: {
        mode: "existing",
        listId: "list-existing",
        strategy: "append",
        consolidate: true,
      },
    });
    expect(prepared.warnings[0]).toContain("Confirming Places");
  });

  it("substitui uma única vez e adiciona os demais grupos ao consolidar", () => {
    const prepared = prepareGlobalImportDestination(packageWithThreeLists(), catalog, {
      mode: "existing-folder",
      existingFolderId: "folder-existing",
      existingListId: "list-existing",
      existingListStrategy: "replace",
    });

    expect(prepared.plan?.folders[0].lists[0]).toMatchObject({ strategy: "replace" });
    expect(prepared.plan?.folders[0].lists[1]).toMatchObject({ strategy: "append" });
    expect(prepared.plan?.folders[0].lists[2]).toMatchObject({ strategy: "append" });
  });

  it("bloqueia uma lista que não pertence à pasta escolhida", () => {
    const prepared = prepareGlobalImportDestination(packageWithThreeLists(), catalog, {
      mode: "existing-folder",
      existingFolderId: "folder-existing",
      existingListId: "list-other-folder",
    });

    expect(prepared.packageValue).toBeNull();
    expect(prepared.plan).toBeNull();
    expect(prepared.errors).toContain("Selecione uma lista válida dentro da pasta escolhida.");
  });
});
