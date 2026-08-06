import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const execution = read("./components/GlobalImportExecutionSection.tsx");
const v2 = read("./SuperGlobalImportScreenV2.tsx");
const guided = read("./GuidedGlobalImportScreen.tsx");
const wizard = read("./OwnerGuidedImportWizard.tsx");
const dialog = read("../smart-import/ContentIngestDialog.tsx");

describe("ações de reset pré-importação", () => {
  it("mantém o executor transacional e o desfazer intactos", () => {
    expect(execution).toContain("Desfazer esta importação");
    expect(v2).toContain("executeMappedGlobalImport");
    expect(guided).toContain("executeMappedGlobalImport");
  });

  it("expõe reset opcional no relatório", () => {
    expect(execution).toContain("onPrepareNewImport");
    expect(execution).toContain("Preparar nova importação");
  });

  it("liga o reset em todos os fluxos de flashcards", () => {
    expect(v2).toContain("onPrepareNewImport={clearImportAttempt}");
    expect(v2).toContain("Cancelar e recomeçar");
    expect(guided).toContain("onPrepareNewImport={clearImportAttempt}");
    expect(guided).toContain("Cancelar e recomeçar");
    expect(wizard).toContain("onPrepareNewImport={clearAttempt}");
    expect(dialog).toContain("Recomeçar");
    expect(dialog).toContain("Preparar nova importação");
  });

  it("pede confirmação antes de descartar conteúdo", () => {
    expect(v2).toContain("Recomeçar esta importação?");
    expect(guided).toContain("Recomeçar esta importação?");
    expect(dialog).toContain("Recomeçar esta importação?");
  });
});
