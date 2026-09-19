import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const tools = readFileSync(new URL("./StudyToolsMenu.tsx", import.meta.url), "utf8");
const study = readFileSync(new URL("../../../pages/Study.tsx", import.meta.url), "utf8");
const mixed = readFileSync(new URL("./MixedSlotActivity.tsx", import.meta.url), "utf8");

const modeViews = [
  "./FlipStudyView.impl.tsx",
  "./WriteStudyView.impl.tsx",
  "./MultipleChoiceStudyView.impl.tsx",
  "./UnscrambleStudyView.impl.tsx",
  "./PronunciationStudyView.impl.tsx",
].map((path) => readFileSync(new URL(path, import.meta.url), "utf8"));

describe("controle único de Reforço no Study", () => {
  it("não existe mais nenhuma superfície de Reforço dentro do menu do card", () => {
    expect(tools).not.toContain("Adicionar ao Reforço");
    expect(tools).not.toContain("Remover do Reforço");
    expect(tools).not.toContain("No Reforço");
    expect(tools).not.toContain("isDifficult");
    expect(tools).not.toContain("onToggleDifficulty");
    expect(tools).not.toContain("difficultyPending");
  });

  it("nenhuma view de modo transporta mais estado de Reforço", () => {
    for (const source of modeViews) {
      expect(source).not.toContain("onToggleDifficulty");
      expect(source).not.toContain("difficultyPending");
    }
    expect(mixed).not.toContain("onToggleDifficulty");
    expect(mixed).not.toContain("difficultyPending");
  });

  it("mantém exatamente uma superfície por layout usando a mesma mutation", () => {
    // Aba de ferramentas da sessão (mobile) + toolbar (sm+).
    const toggles = study.split("aria-pressed={isDisplayedReinforcement}").length - 1;
    expect(toggles).toBe(2);
    expect(study).toContain('data-reinforcement-toggle="true"');
    expect(study.split("handleToggleReinforcement").length - 1).toBeGreaterThanOrEqual(3);
    expect(study).toContain("reinforcementMutation.isPending");
  });

  it("deixa o estado ativo inequívoco sem depender só da cor", () => {
    expect(study).toContain("bg-emerald-600");
    expect(study).toContain('<Check className="h-4 w-4" />');
    expect(study).toContain('{isDisplayedReinforcement ? "No Reforço" : "Adicionar ao Reforço"}');
    expect(study).toContain("Este card já está na sua área de Reforço.");
    expect(study).toContain("aria-label={isDisplayedReinforcement");
  });
});

