import { describe, expect, it } from "vitest";
import {
  buildAttentionPointAiText,
  buildAttentionPointContextText,
  buildAttentionPointJson,
  buildAttentionPointWordsText,
} from "./attentionPointExport";

const cards = [{
  flashcard_id: "layer-2",
  term: "strang",
  translation: "estranho",
  list_title: "Viagem",
  example_text: "That feels strange.",
  example_translation: "Isso parece estranho.",
  focus_text: "strang",
  focus_side: "b",
  focus_tag: "vocabulary",
}];

describe("exportação dos pontos de atenção", () => {
  it("monta o texto principal para IA com foco e contexto", () => {
    const text = buildAttentionPointAiText(cards);
    expect(text).toContain("strang → estranho");
    expect(text).toContain("Ponto de atenção: strang");
    expect(text).toContain("That feels strange.");
  });

  it("mantém palavras únicas e contexto em formatos simples", () => {
    expect(buildAttentionPointWordsText([...cards, cards[0]])).toBe("strang");
    expect(buildAttentionPointContextText(cards)).toContain("strang → That feels strange. — Isso parece estranho.");
  });

  it("preserva a identidade da camada no JSON", () => {
    const parsed = JSON.parse(buildAttentionPointJson(cards));
    expect(parsed.schema).toBe("app-piteco-attention-points");
    expect(parsed.items[0]).toMatchObject({ flashcard_id: "layer-2", focus_side: "b" });
  });
});
