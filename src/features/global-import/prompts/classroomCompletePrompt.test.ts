import { describe, expect, it } from "vitest";
import { buildFinalGlobalImportPrompt } from "./finalPrompt";

describe("complete classroom prompt", () => {
  it("builds a complete package using normal cards", () => {
    const prompt = buildFinalGlobalImportPrompt("complete", {
      scope: "classroom",
      intent: "structured",
      destinationMode: "from-file",
    });

    expect(prompt).toContain("PADRÃO PEDAGÓGICO OBRIGATÓRIO PARA TURMA");
    expect(prompt).toContain("detailed_explanation");
    expect(prompt).toContain("example_translation");
    expect(prompt).toContain("word_hints");
    expect(prompt).toContain("Inclua somente cards com type=normal");
    expect(prompt).toContain("um card para ser e outro para estar");
    expect(prompt).toContain("glossary será centralizado na conta do professor");
    expect(prompt).not.toContain("Use cards layered");
  });

  it("keeps classroom-only rules out of the personal preset", () => {
    const prompt = buildFinalGlobalImportPrompt("complete", {
      scope: "personal",
      intent: "structured",
      destinationMode: "from-file",
    });

    expect(prompt).not.toContain("PADRÃO PEDAGÓGICO OBRIGATÓRIO PARA TURMA");
  });
});
