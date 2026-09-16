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

  it("normalizes legacy rich sections embedded inside hint into one presentation", () => {
    const result = buildStudyHintContent({
      hint: [
        "Dica curta.",
        "",
        "**Explicação detalhada**",
        "Conteúdo legado.",
        "",
        "**Quando usar**",
        "Uso legado.",
      ].join("\n"),
      detailed_explanation: "Conteúdo legado.",
      usage_notes: "Uso legado.",
    });

    expect(result?.match(/\*\*Explicação detalhada\*\*/g)).toHaveLength(1);
    expect(result?.match(/Conteúdo legado\./g)).toHaveLength(1);
    expect(result?.match(/\*\*Quando usar\*\*/g)).toHaveLength(1);
    expect(result).toContain("Dica curta.");
  });

  it("preserves distinct canonical and legacy text without creating a second explanation section", () => {
    const result = buildStudyHintContent({
      hint: "**Explicação detalhada**\nTexto antigo.",
      detailed_explanation: "Texto atual.",
    });

    expect(result?.match(/\*\*Explicação detalhada\*\*/g)).toHaveLength(1);
    expect(result).toContain("Texto atual.\n\nTexto antigo.");
  });

  it("returns null when the card has no hint or enriched explanation", () => {
    expect(buildStudyHintContent({})).toBeNull();
  });
});
