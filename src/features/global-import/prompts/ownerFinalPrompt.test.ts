import { describe, expect, it } from "vitest";
import { buildFinalGlobalImportPrompt } from "./finalPrompt";
import { buildOwnerFinalImportPrompt } from "./ownerFinalPrompt";

const classroomContext = {
  scope: "classroom" as const,
  intent: "structured" as const,
  destinationMode: "from-file" as const,
};

describe("owner guided import prompt", () => {
  it("requires an interview before generating JSON", () => {
    const prompt = buildOwnerFinalImportPrompt("complete", classroomContext);

    expect(prompt).toContain("ENTREVISTA INICIAL EM DUAS FASES");
    expect(prompt).toContain("Na primeira resposta, não gere JSON");
    expect(prompt).toContain("Tema, nível e quantidade aproximada de cards");
    expect(prompt).toContain("Glossário Global sempre exige confirmação explícita");
    expect(prompt).toContain("usar os padrões");
  });

  it("generates useful interpretations as separate normal cards", () => {
    const prompt = buildOwnerFinalImportPrompt("detailed", {
      ...classroomContext,
      scope: "personal",
    });

    expect(prompt).toContain("CARDS NORMAIS APENAS");
    expect(prompt).toContain("Nunca gere objetos com type=layered");
    expect(prompt).toContain("to be");
    expect(prompt).toContain('"back": "ser"');
    expect(prompt).toContain('"back": "estar"');
    expect(prompt).toContain("turn up");
    expect(prompt).toContain("Mesclar em camadas");
    expect(prompt).not.toContain("CONTRATO SEMÂNTICO DE CAMADAS");
  });

  it("keeps the regular prompt without the owner interview", () => {
    const regularPrompt = buildFinalGlobalImportPrompt("complete", classroomContext);

    expect(regularPrompt).not.toContain("ENTREVISTA INICIAL EM DUAS FASES");
    expect(regularPrompt).toContain("Inclua somente cards com type=normal");
    expect(regularPrompt).toContain("um card para ser e outro para estar");
  });
});
