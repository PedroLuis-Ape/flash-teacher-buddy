import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const settingsSource = readFileSync(new URL("./WriteActivitySettings.tsx", import.meta.url), "utf8");
const writeSource = readFileSync(new URL("./WriteStudyView.impl.tsx", import.meta.url), "utf8");
const writeBoundarySource = readFileSync(new URL("./WriteStudyView.tsx", import.meta.url), "utf8");
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

  it("shows the opposite side as a smaller translation inside the rewrite card", () => {
    expect(writeBoundarySource).toContain("rewriteTranslationText");
    expect(writeBoundarySource).toContain("data-write-rewrite-translation");
    expect(writeBoundarySource).toContain("text-xs italic");
    expect(writeBoundarySource).toContain("Tradução do texto para reescrita");
    expect(writeBoundarySource).toContain('resolvedRewriteSide === "a" ? props.back : props.front');
  });

  it("anchors the translation immediately before the rewrite instruction inside the card", () => {
    expect(writeBoundarySource).toContain("findRewriteInstruction");
    expect(writeBoundarySource).toContain('startsWith("Reescreva exatamente como aparece acima")');
    expect(writeBoundarySource).toContain('instruction.insertAdjacentElement("beforebegin", preview)');
    expect(writeBoundarySource).not.toContain("findPromptRow");
  });

  it("re-synchronizes the translation when a layered card changes under the same flashcard id", () => {
    expect(writeBoundarySource).toContain('const rewriteLayerKey = `${props.flashcardId ?? "card"}|${props.front}|${props.back}`');
    expect(writeBoundarySource).toContain("key={rewriteLayerKey}");
    expect(writeBoundarySource).toContain("REWRITE_TRANSLATION_RETRY_DELAYS");
    expect(writeBoundarySource).toContain("characterData: true");
    expect(writeBoundarySource).toContain("preview.dataset.writeRewriteTranslationKey = rewriteLayerKey");
    expect(writeBoundarySource).toContain("window.requestAnimationFrame(applyLayout)");
  });
});