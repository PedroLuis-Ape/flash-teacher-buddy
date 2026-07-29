import { describe, expect, it } from "vitest";
import type { SmartImportPackage } from "@/features/smart-import/schema";
import type { GlobalImportDestinationPlan } from "./destination";
import { glossaryPackageForDestinationPlan } from "./destinationGlossary";

const packageValue: SmartImportPackage = {
  schema: "app-piteco-super-import",
  version: "2.0",
  declared_totals: {
    folders: 1,
    lists: 2,
    cards: 2,
    glossary_entries: 2,
    layered_groups: 0,
  },
  package: {
    name: "Pacote",
    folders: [{
      name: "Pasta",
      lists: [
        {
          name: "Lista pulada",
          front_language: "pt",
          back_language: "en",
          primary_side: "a",
          study_type: "language",
          tts_enabled: true,
          glossary: [{ term: "pular", translation: "skip", side: "A", active: true }],
          cards: [{ type: "normal", front: "pular", back: "skip" }],
        },
        {
          name: "Lista importada",
          front_language: "pt",
          back_language: "en",
          primary_side: "a",
          study_type: "language",
          tts_enabled: true,
          glossary: [{ term: "manter", translation: "keep", side: "A", active: true }],
          cards: [{ type: "normal", front: "manter", back: "keep" }],
        },
      ],
    }],
  },
};

const destinationPlan: GlobalImportDestinationPlan = {
  folders: {
    0: {
      folder: { mode: "create", name: "Pasta" },
      lists: {
        0: { mode: "skip" },
        1: { mode: "create", name: "Lista importada" },
      },
    },
  },
};

describe("glossário do plano de destino", () => {
  it("remove somente o glossário de listas puladas e preserva os índices", () => {
    const filtered = glossaryPackageForDestinationPlan(packageValue, destinationPlan);

    expect(filtered.package.folders[0].lists).toHaveLength(2);
    expect(filtered.package.folders[0].lists[0].glossary).toEqual([]);
    expect(filtered.package.folders[0].lists[1].glossary).toEqual([
      expect.objectContaining({ term: "manter" }),
    ]);
    expect(filtered.declared_totals?.glossary_entries).toBe(1);
    expect(packageValue.package.folders[0].lists[0].glossary).toHaveLength(1);
  });

  it("não cria totais declarados quando o pacote não os possuía", () => {
    const withoutTotals = { ...packageValue, declared_totals: undefined };
    const filtered = glossaryPackageForDestinationPlan(withoutTotals, destinationPlan);

    expect(filtered.declared_totals).toBeUndefined();
  });
});
