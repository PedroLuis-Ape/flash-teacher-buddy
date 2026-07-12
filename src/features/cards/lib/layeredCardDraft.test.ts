import { describe, expect, it } from "vitest";
import {
  moveLayerDraft,
  normalizeLayeredCardDrafts,
  validateLayeredCardDrafts,
} from "./layeredCardDraft";

describe("layeredCardDraft", () => {
  it("treats layers as arbitrary A/B pairs without semantic labels", () => {
    const layers = normalizeLayeredCardDrafts([
      { front: " I work every day. ", back: " Eu trabalho todos os dias. " },
      { front: " I worked yesterday. ", back: " Eu trabalhei ontem. " },
      { front: " Modal verbs can change the meaning. ", back: " Verbos modais podem mudar o sentido. " },
    ]);

    expect(layers).toEqual([
      { front: "I work every day.", back: "Eu trabalho todos os dias." },
      { front: "I worked yesterday.", back: "Eu trabalhei ontem." },
      { front: "Modal verbs can change the meaning.", back: "Verbos modais podem mudar o sentido." },
    ]);
    expect(validateLayeredCardDrafts(layers)).toEqual([]);
    expect(layers.every((layer) => !("label" in layer) && !("kind" in layer))).toBe(true);
  });

  it("requires at least two complete layers", () => {
    expect(validateLayeredCardDrafts([{ front: "work", back: "trabalhar" }]))
      .toContain("Um card em camadas precisa ter pelo menos duas camadas.");

    expect(validateLayeredCardDrafts([
      { front: "work", back: "trabalhar" },
      { front: "", back: "funcionar" },
    ])).toContain("A Camada 2 precisa ter conteúdo nos dois lados.");
  });

  it("rejects exact duplicate pairs inside the same group", () => {
    expect(validateLayeredCardDrafts([
      { front: "work", back: "trabalhar" },
      { front: " WORK ", back: " TRABALHAR " },
    ])).toContain("A Camada 2 repete exatamente outra camada deste card.");
  });

  it("moves layers without changing their content", () => {
    const layers = [
      { id: "a", front: "A", back: "1" },
      { id: "b", front: "B", back: "2" },
      { id: "c", front: "C", back: "3" },
    ];

    expect(moveLayerDraft(layers, 2, -1).map((layer) => layer.id)).toEqual(["a", "c", "b"]);
    expect(moveLayerDraft(layers, 0, -1)).toEqual(layers);
    expect(moveLayerDraft(layers, 2, 1)).toEqual(layers);
  });
});