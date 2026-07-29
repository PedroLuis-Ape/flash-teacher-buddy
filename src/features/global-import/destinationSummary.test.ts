import { describe, expect, it } from "vitest";
import type { GlobalImportDestinationPlan, ImportDestinationCatalog } from "./destination";
import { summarizeDestinationPlan } from "./destinationSummary";
import type { GlobalImportPackage } from "./schema";

const packageValue: GlobalImportPackage = {
  schema: "appteco-global-import",
  version: 1,
  package: {
    name: "Pacote",
    folders: [{
      name: "Origem",
      lists: [
        { name: "Nova", cards: [{ front: "A", back: "B" }] },
        { name: "Adicionar", cards: [{ front: "C", back: "D" }, { front: "E", back: "F" }] },
        { name: "Substituir", cards: [{ front: "G", back: "H" }] },
        { name: "Ignorar", cards: [{ front: "I", back: "J" }] },
      ],
    }],
  },
};

const catalog: ImportDestinationCatalog = {
  folders: [{ id: "folder-1", title: "Destino" }],
  lists: [
    { id: "list-append", title: "Conversa", folder_id: "folder-1" },
    { id: "list-replace", title: "Vocabulário", folder_id: "folder-1" },
  ],
};

const plan: GlobalImportDestinationPlan = {
  folders: {
    0: {
      folder: { mode: "existing", folderId: "folder-1" },
      lists: {
        0: { mode: "create", name: "Nova editada" },
        1: { mode: "existing", listId: "list-append", strategy: "append" },
        2: { mode: "existing", listId: "list-replace", strategy: "replace" },
        3: { mode: "skip" },
      },
    },
  },
};

describe("resumo do destinationPlan", () => {
  it("reflete create, append, replace e skip sem usar política paralela", () => {
    const summary = summarizeDestinationPlan(packageValue, catalog, plan);

    expect(summary).toMatchObject({
      foldersCreated: 0,
      listsCreated: 1,
      listsUpdated: 2,
      listsReplaced: 1,
      listsSkipped: 1,
      cardsImported: 4,
      replacementListNames: ["Vocabulário"],
    });
    expect(summary.items.map((item) => item.action)).toEqual([
      "create",
      "append",
      "replace",
      "skip",
    ]);
  });
});
