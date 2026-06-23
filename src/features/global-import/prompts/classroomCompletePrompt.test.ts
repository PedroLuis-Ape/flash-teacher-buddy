import { describe, expect, it } from "vitest";
import { buildFinalGlobalImportPrompt } from "./finalPrompt";

describe("complete classroom prompt", () => {
  it("requires a pedagogically complete v2 package", () => {
    const prompt = buildFinalGlobalImportPrompt("complete", {
      scope: "classroom",
      intent: "structured",
      destinationMode: "from-file",
    });

    expect(prompt).toContain("PADRÃO PEDAGÓGICO OBRIGATÓRIO PARA TURMA");
    expect(prompt).toContain("detailed_explanation");
    expect(prompt).toContain("example_translation");
    expect(prompt).toContain("word_hints");
    expect(prompt).toContain("Use cards layered");
    expect(prompt).toContain("glossary será centralizado na conta do professor");
  });

  it("does not force classroom rules into the global complete preset", () => {
    const prompt = buildFinalGlobalImportPrompt("complete", {
      scope: "personal",
      intent: "structured",
      destinationMode: "from-file",
    });

    expect(prompt).not.toContain("PADRÃO PEDAGÓGICO OBRIGATÓRIO PARA TURMA");
  });
});
