import { describe, expect, it } from "vitest";
import type { SmartImportPackage } from "@/features/smart-import/schema";
import { buildLayerChecks } from "./layerChecks";

function packageWithCards(cards: SmartImportPackage["package"]["folders"][number]["lists"][number]["cards"]): SmartImportPackage {
  return {
    schema: "app-piteco-super-import",
    version: "2.0",
    package: {
      name: "Teste",
      folders: [{
        name: "Pasta",
        lists: [{
          name: "Lista",
          front_language: "en",
          back_language: "pt-BR",
          primary_side: "a",
          study_type: "language",
          tts_enabled: true,
          glossary: [],
          cards,
        }],
      }],
    },
  };
}

describe("buildLayerChecks", () => {
  it("warns when alternative translations are joined in the same side", () => {
    const issues = buildLayerChecks(packageWithCards([{
      type: "normal",
      front: "The train may arrive late.",
      back: "O trem pode chegar atrasado. / Talvez o trem chegue atrasado.",
    }]));

    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("W_JOINED_OPTIONS");
    expect(issues[0].path).toContain(".back");
    expect(issues[0].severity).toBe("warning");
  });

  it("warns when a layer group uses a grammatical label instead of the base term", () => {
    const issues = buildLayerChecks(packageWithCards([{
      type: "layered",
      group_title: "Afirmativo",
      layers: [
        { front: "He may come.", back: "Talvez ele venha." },
        { front: "It may rain.", back: "Talvez chova." },
      ],
    }]));

    expect(issues.some((issue) => issue.code === "W_LAYER_TITLE")).toBe(true);
  });

  it("accepts a semantic phrasal verb group", () => {
    const issues = buildLayerChecks(packageWithCards([{
      type: "layered",
      group_title: "turn up",
      layers: [
        { front: "He turned up late.", back: "Ele apareceu atrasado.", context_tag: "aparecer" },
        { front: "Turn up the volume.", back: "Aumente o volume.", context_tag: "aumentar" },
      ],
    }]));

    expect(issues).toEqual([]);
  });
});
