import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const settingsSource = readFileSync(new URL("./WriteActivitySettings.tsx", import.meta.url), "utf8");
const writeSource = readFileSync(new URL("./WriteStudyView.impl.tsx", import.meta.url), "utf8");
const modalSource = readFileSync(new URL("./GameSettingsModal.impl.tsx", import.meta.url), "utf8");

describe("write rewrite activity UI", () => {
  it("exposes translate and rewrite choices with side selection", () => {
    expect(settingsSource).toContain("Atividade de escrita");
    expect(settingsSource).toContain("Traduzir");
    expect(settingsSource).toContain("Reescrever");
    expect(settingsSource).toContain("Somente {playRuntime.labelA}");
    expect(settingsSource).toContain("Somente {playRuntime.labelB}");
    expect(settingsSource).toContain("Alternar");
    expect(modalSource).toContain("<WriteActivitySettings />");
  });

  it("routes rewrite submissions through exact-copy evaluation", () => {
    expect(writeSource).toContain("evaluateRewriteAnswer");
    expect(writeSource).toContain("Reescreva exatamente como aparece acima");
    expect(writeSource).toContain('effectiveCorrectionMode: WriteCorrectionMode = isRewriteActivity ? "hard"');
  });
});
