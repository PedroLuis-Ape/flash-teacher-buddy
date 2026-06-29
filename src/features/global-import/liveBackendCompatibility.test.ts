import { describe, expect, it } from "vitest";
import { smartImportPackageSchema } from "@/features/smart-import/schema";
import { smartImportToOfficialV1Package } from "./liveBackendCompatibility";

const richPackage = smartImportPackageSchema.parse({
  schema: "app-piteco-super-import",
  version: "2.0",
  package: {
    name: "Atender em inglês",
    folders: [{
      name: "Atendimento",
      lists: [{
        name: "Clientes",
        front_language: "en",
        back_language: "pt-BR",
        primary_side: "a",
        study_type: "language",
        tts_enabled: true,
        glossary: [{
          term: "help",
          translation: "ajudar; atender",
          side: "A",
          active: true,
        }],
        cards: [
          {
            type: "normal",
            front: "I am helping a customer.",
            back: "Eu estou atendendo um cliente.",
            detailed_explanation: "Forma cotidiana.",
          },
          {
            type: "layered",
            group_title: "Atender formalmente",
            layers: [
              {
                front: "I am assisting a client.",
                back: "Eu estou atendendo um cliente.",
              },
              {
                front: "I am helping a customer.",
                back: "Eu estou atendendo um cliente.",
              },
            ],
          },
        ],
      }],
    }],
  },
});

describe("smartImportToOfficialV1Package", () => {
  it("flattens rich cards into the strict official v1 contract", () => {
    const result = smartImportToOfficialV1Package(richPackage);
    const list = result.package.folders[0].lists[0];

    expect(result.schema).toBe("app-piteco-super-import");
    expect(result.version).toBe("1.0");
    expect(result.declared_totals).toEqual({ folders: 1, lists: 1, cards: 2 });
    expect(list.declared_card_count).toBe(2);
    expect(list.cards).toEqual([
      {
        front: "I am helping a customer.",
        back: "Eu estou atendendo um cliente.",
      },
      {
        front: "I am assisting a client.",
        back: "Eu estou atendendo um cliente.",
      },
    ]);
  });

  it("removes exact duplicate card pairs because the v1 RPC rejects them", () => {
    const result = smartImportToOfficialV1Package(richPackage);
    expect(result.package.folders[0].lists[0].cards).toHaveLength(2);
  });
});
