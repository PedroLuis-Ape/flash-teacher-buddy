import { describe, expect, it } from "vitest";
import {
  validateDestinationPlan,
  type GlobalImportDestinationPlan,
  type ImportDestinationCatalog,
} from "./destination";
import type { GlobalImportPackage } from "./schema";

const incomingEnPt: GlobalImportPackage = {
  schema: "appteco-global-import",
  version: 1,
  package: {
    name: "Phrasal verbs",
    source_language: "en",
    target_language: "pt-BR",
    folders: [{
      name: "Origem",
      lists: [{
        name: "Phrasal verbs e chunks verbais",
        cards: [{
          front: "She has switched back and forth all morning.",
          back: "Ela ficou alternando a manhã inteira.",
          metadata: {
            front_language: "en",
            back_language: "pt-BR",
          },
        }],
      }],
    }],
  },
};

const invertedFolder = {
  id: "folder-target",
  title: "Pasta já existente",
  lang_a: "pt-BR",
  lang_b: "en",
  labels_a: "Português",
  labels_b: "English",
};

const DIRECTION_ERROR = "Os lados do pacote não correspondem aos lados da lista escolhida. Revise o mapeamento antes de importar.";

function plan(destination: GlobalImportDestinationPlan["folders"][number]["lists"][number]): GlobalImportDestinationPlan {
  return {
    folders: {
      0: {
        folder: { mode: "existing", folderId: invertedFolder.id },
        lists: { 0: destination },
      },
    },
  };
}

describe("Super Import canonical A/B language authority", () => {
  it("does not compare a newly-created list against the folder language direction", () => {
    const catalog: ImportDestinationCatalog = {
      folders: [invertedFolder],
      lists: [],
    };

    expect(validateDestinationPlan(
      incomingEnPt,
      catalog,
      plan({ mode: "create", name: "Phrasal verbs e chunks verbais" }),
    )).toEqual([]);
  });

  it("respects an explicit existing list even when its folder has the opposite direction", () => {
    const catalog: ImportDestinationCatalog = {
      folders: [invertedFolder],
      lists: [{
        id: "list-explicit",
        title: "English → Portuguese",
        folder_id: invertedFolder.id,
        lang_a: "en",
        lang_b: "pt-BR",
        labels_a: "English",
        labels_b: "Português",
        language_settings_mode: "explicit",
      }],
    };

    expect(validateDestinationPlan(
      incomingEnPt,
      catalog,
      plan({
        mode: "existing",
        listId: "list-explicit",
        strategy: "append",
        consolidate: true,
      }),
    )).toEqual([]);
  });

  it("accepts pt-BR into a legacy en/pt list without rewriting old cards", () => {
    const catalog: ImportDestinationCatalog = {
      folders: [invertedFolder],
      lists: [{
        id: "list-legacy",
        title: "Lista antiga",
        folder_id: invertedFolder.id,
        lang_a: "en",
        lang_b: "pt",
        labels_a: "English",
        labels_b: "Português",
        language_settings_mode: "legacy",
      }],
    };

    expect(validateDestinationPlan(
      incomingEnPt,
      catalog,
      plan({
        mode: "existing",
        listId: "list-legacy",
        strategy: "append",
        consolidate: true,
      }),
    )).toEqual([]);
  });

  it("still obeys an explicitly inherited folder direction", () => {
    const catalog: ImportDestinationCatalog = {
      folders: [invertedFolder],
      lists: [{
        id: "list-inherited",
        title: "Lista herdada",
        folder_id: invertedFolder.id,
        lang_a: "en",
        lang_b: "pt",
        language_settings_mode: "inherited",
      }],
    };

    expect(validateDestinationPlan(
      incomingEnPt,
      catalog,
      plan({
        mode: "existing",
        listId: "list-inherited",
        strategy: "append",
      }),
    )).toContain(DIRECTION_ERROR);
  });

  it("validates an individually mapped existing list even without consolidate=true", () => {
    const catalog: ImportDestinationCatalog = {
      folders: [invertedFolder],
      lists: [{
        id: "list-explicit-inverted",
        title: "Portuguese → English",
        folder_id: invertedFolder.id,
        lang_a: "pt-BR",
        lang_b: "en",
        language_settings_mode: "explicit",
      }],
    };

    expect(validateDestinationPlan(
      incomingEnPt,
      catalog,
      plan({
        mode: "existing",
        listId: "list-explicit-inverted",
        strategy: "append",
      }),
    )).toContain(DIRECTION_ERROR);
  });
});
