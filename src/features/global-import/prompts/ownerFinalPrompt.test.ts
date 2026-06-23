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

  it("defines the semantic difference between layers and alternative translations", () => {
    const prompt = buildOwnerFinalImportPrompt("detailed", {
      ...classroomContext,
      scope: "personal",
    });

    expect(prompt).toContain("CONTRATO SEMÂNTICO DE CAMADAS");
    expect(prompt).toContain("group_title deve ser o termo-base estudado");
    expect(prompt).toContain("Traduções sinônimas da mesma ideia não viram layers diferentes");
    expect(prompt).toContain("short_observation");
    expect(prompt).toContain("turn up");
    expect(prompt).toContain("context_tag");
    expect(prompt).toContain("Não una traduções alternativas");
  });

  it("keeps the regular prompt unchanged outside the owner canary builder", () => {
    const regularPrompt = buildFinalGlobalImportPrompt("complete", classroomContext);

    expect(regularPrompt).not.toContain("ENTREVISTA INICIAL EM DUAS FASES");
    expect(regularPrompt).not.toContain("CONFIGURAÇÃO DA VERSÃO CANÁRIO");
  });
});
