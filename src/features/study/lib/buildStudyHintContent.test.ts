import { describe, expect, it } from "vitest";
import { buildStudyHintContent } from "./buildStudyHintContent";

describe("buildStudyHintContent", () => {
  it("keeps the original hint and appends enriched explanation sections", () => {
    const result = buildStudyHintContent({
      hint: "Pense em possibilidade.",
      detailed_explanation: "May indica uma possibilidade real.",
      usage_notes: "Também pode indicar permissão formal.",
      common_mistakes: "Não use may to arrive; use may arrive.",
    });

    expect(result).toContain("Pense em possibilidade.");
    expect(result).toContain("**Explicação detalhada**");
    expect(result).toContain("**Quando usar**");
    expect(result).toContain("**Erros comuns**");
  });

  it("enables the hint content even when only detailed explanation exists", () => {
    expect(buildStudyHintContent({
      hint: null,
      detailed_explanation: "Explicação disponível.",
    })).toBe("**Explicação detalhada**\nExplicação disponível.");
  });

  it("returns null when the card has no hint or enriched explanation", () => {
    expect(buildStudyHintContent({})).toBeNull();
  });
});
