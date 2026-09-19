import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const tools = readFileSync(new URL("./StudyToolsMenu.tsx", import.meta.url), "utf8");
const study = readFileSync(new URL("../../../pages/Study.tsx", import.meta.url), "utf8");

describe("controle único de Reforço no Study", () => {
  it("não duplica o Reforço dentro do menu de ferramentas do card", () => {
    expect(tools).not.toContain("Adicionar ao Reforço");
    expect(tools).not.toContain("Remover do Reforço");
    expect(tools).not.toContain("No Reforço");
    // Props seguem aceitas para não quebrar as views de modo, mas não renderizam nada.
    expect(tools).toContain("isDifficult?: boolean");
  });

  it("mantém exatamente uma superfície por layout usando a mesma mutation", () => {
    // Aba de ferramentas da sessão (mobile) + toolbar (desktop/sm+).
    const toggles = study.split("aria-pressed={isDisplayedReinforcement}").length - 1;
    expect(toggles).toBe(2);
    expect(study).toContain('data-reinforcement-toggle="true"');
    expect(study).toContain("onToggleDifficulty={userId && canToggleReinforcement ? handleToggleReinforcement : undefined}");
    expect(study).toContain("difficultyPending={reinforcementMutation.isPending}");
  });

  it("deixa o estado ativo inequívoco sem depender só da cor", () => {
    expect(study).toContain("bg-emerald-600");
    expect(study).toContain('<Check className="h-4 w-4" />');
    expect(study).toContain('{isDisplayedReinforcement ? "No Reforço" : "Adicionar ao Reforço"}');
    expect(study).toContain("Este card já está na sua área de Reforço.");
    expect(study).toContain("aria-label={isDisplayedReinforcement");
  });
});

