import { describe, expect, it } from "vitest";
import {
  buildDefaultDestinationPlan,
  validateDestinationPlan,
  type ImportDestinationCatalog,
} from "./destination";
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
    { id: "folder-airport", title: "Inglês para Aeroporto" },
    { id: "folder-existing", title: "Minha pasta antiga" },
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
});
