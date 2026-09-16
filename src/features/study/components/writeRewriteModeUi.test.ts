import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const settingsSource = readFileSync(new URL("./WriteActivitySettings.tsx", import.meta.url), "utf8");
const writeSource = readFileSync(new URL("./WriteStudyView.impl.tsx", import.meta.url), "utf8");
const writeBoundarySource = readFileSync(new URL("./WriteStudyView.tsx", import.meta.url), "utf8");
const modalSource = readFileSync(new URL("./GameSettingsModal.impl.tsx", import.meta.url), "utf8");
const studySource = readFileSync(new URL("../../../pages/Study.tsx", import.meta.url), "utf8");
const mixedSource = readFileSync(new URL("../../../pages/MixedStudy.tsx", import.meta.url), "utf8");
const mixedMultipleSource = readFileSync(new URL("./MultipleChoiceStudyView.tsx", import.meta.url), "utf8");

describe("write rewrite activity UI", () => {
  it("exposes translate, visible rewrite and listening as three sibling options", () => {
    expect(settingsSource).toContain("Atividade de escrita");
    expect(settingsSource).toContain('{ value: "translate", label: "Traduzir" }');
    expect(settingsSource).toContain('{ value: "rewrite-visible", label: "Reescrever" }');
    expect(settingsSource).toContain('{ value: "rewrite-listening", label: "Escrever o que ouviu" }');
    // Reescrever e Escrever o que ouviu são irmãs: mesmos campos, sem duplicar config.
    expect(settingsSource).toContain('writeActivityMode: "rewrite"');
    expect(settingsSource).toContain('writeRewritePromptMode: option === "rewrite-listening" ? "listening" : "visible"');
    expect(settingsSource).toContain("Reescrever vendo o texto");
    expect(settingsSource).toContain("Escrever o que ouviu");
    // Componente controlado: os lados usam os rótulos dinâmicos do runtime.
    expect(settingsSource).toContain('{ value: "a", label: playRuntime.labelA }');
    expect(settingsSource).toContain('{ value: "b", label: playRuntime.labelB }');
    expect(settingsSource).toContain("Alternar");
    expect(settingsSource).not.toContain("useWriteStudyPreferences");
    expect(modalSource).toContain("<WriteActivitySettings");
    expect(modalSource).toContain("rewritePromptMode={settings.writeRewritePromptMode}");
  });

  it("keeps the write view fully controlled by the session owner", () => {
    expect(writeSource).not.toContain("useWriteStudyPreferences");
    expect(writeSource).toContain("writeActivityMode: WriteActivityMode");
    expect(writeSource).toContain("writeRewriteSide: WriteRewriteSide");
    expect(writeSource).toContain("writeRewritePromptMode: WriteRewritePromptMode");
    expect(writeSource).toContain('const isRewriteActivity = writeActivityMode === "rewrite"');
    expect(writeSource).toContain('const isListeningRewrite = isRewriteActivity && writeRewritePromptMode === "listening"');
    expect(writeSource).toContain('const isVisibleRewrite = isRewriteActivity && writeRewritePromptMode === "visible"');
    expect(writeBoundarySource).not.toContain("readWriteActivityPreference");
    expect(writeBoundarySource).not.toContain("WRITE_ACTIVITY_PREFERENCE_CHANGED_EVENT");
  });

  it("routes rewrite submissions through exact-copy evaluation in both modalities", () => {
    expect(writeSource).toContain("evaluateRewriteAnswer");
    expect(writeSource).toContain("Ouça e reconstrua a frase sem vê-la:");
    expect(writeSource).toContain("Reescreva corretamente a frase revelada:");
    // Reescrita visual: a frase já está na tela desde o começo.
    expect(writeSource).toContain("Reescreva exatamente a frase acima:");
    expect(writeSource).toContain('effectiveCorrectionMode: WriteCorrectionMode = isRewriteActivity ? "hard"');
  });

  it("keeps visible and listening attempts in separate snapshots", () => {
    expect(writeSource).toContain("buildRewriteCardIdentity(cardIdentity, writeRewritePromptMode, resolvedRewriteSide)");
    expect(writeSource).toContain("buildLegacyRewriteCardIdentity(cardIdentity, resolvedRewriteSide)");
    expect(writeSource).toContain("restoreRewriteFlowState({");
  });

  it("mounts the target immediately in visible and hides it only while listening", () => {
    expect(writeSource).toContain("(!isRewriteActivity || rewriteTargetRevealed)");
    expect(writeSource).toContain("promptMode: writeRewritePromptMode");
    expect(writeSource).toContain("createRewriteFlowState(options.promptMode)");
    expect(writeSource).toContain('rewriteState.phase !== "LISTENING"');
    expect(writeSource).toContain("<InteractiveText");
    expect(writeSource).toContain("<SpeechRateControl />");
  });

  it("renders the opposite side declaratively inside the rewrite card", () => {
    expect(writeSource).toContain('data-write-rewrite-translation="true"');
    expect(writeSource).toContain('const rewriteOppositeText = resolvedRewriteSide === "a" ? back : front');
    expect(writeSource).toContain("normalizeRewriteComparison");
    expect(writeSource).toContain("showRewriteTranslation");
    expect(writeSource).toContain("text-xs italic");
    expect(writeSource).toContain("text-muted-foreground/60");
    expect(writeSource).toContain("Tradução do texto para reescrita");
  });

  it("shows the translation only during listening and hides duplicates", () => {
    expect(writeSource).toContain(
      'isListeningRewrite && rewriteState.phase === "LISTENING" && rewriteTranslationText.length > 0',
    );
    expect(writeSource).toContain(
      "normalizeRewriteComparison(rewriteOppositeText) !== normalizeRewriteComparison(prompt)",
    );
  });

  it("places the translation before the rewrite instruction", () => {
    const translationIndex = writeSource.indexOf("data-write-rewrite-translation");
    const instructionIndex = writeSource.indexOf("Ouça e reconstrua a frase sem vê-la:");
    expect(translationIndex).toBeGreaterThan(-1);
    expect(instructionIndex).toBeGreaterThan(translationIndex);
  });

  it("keeps the boundary free of imperative translation injection", () => {
    expect(writeBoundarySource).not.toContain("data-write-rewrite-translation");
    expect(writeBoundarySource).not.toContain("insertAdjacentElement");
    expect(writeBoundarySource).not.toContain("findRewriteInstruction");
    expect(writeBoundarySource).not.toContain("REWRITE_TRANSLATION_RETRY_DELAYS");
    expect(writeBoundarySource).toContain("rewriteLayerKey");
    expect(writeBoundarySource).toContain('?? "local"');
    expect(writeBoundarySource).toContain("key={rewriteLayerKey}");
  });

  it("persists Rewrite state under the existing direct and mixed session keys", () => {
    expect(studySource).toContain("rewriteSnapshotScope={studySnapshotKey}");
    expect(mixedSource).toContain("const mixedSnapshotKey = buildStudySnapshotKey");
    expect(mixedSource).toContain("rewriteSnapshotScope={mixedSnapshotKey}");
    expect(mixedMultipleSource).toContain("rewriteSnapshotScope={props.rewriteSnapshotScope}");
  });

  it("propagates the rewrite prompt mode through Study and Mixed", () => {
    expect(studySource).toContain("writeRewritePromptMode: studySettings.writeRewritePromptMode");
    expect(studySource).toContain("writeRewritePromptMode={writeSessionSettings.writeRewritePromptMode}");
    expect(mixedSource).toContain("writeRewritePromptMode: studySettings.writeRewritePromptMode");
    expect(mixedSource).toContain("writeRewritePromptMode={writeSessionSettings.writeRewritePromptMode}");
    expect(mixedMultipleSource).toContain("...(props.writeSettings ?? DEFAULT_WRITE_SESSION_SETTINGS)");
  });

  it("keeps navigation, duplicate-submit protection, and mobile action controls", () => {
    expect(writeBoundarySource).toContain("submitLockedRef");
    expect(writeBoundarySource).toContain("navigationLockedRef");
    expect(writeBoundarySource).toContain("onPrevious: props.onPrevious");
    expect(writeBoundarySource).toContain('grid-template-columns", "minmax(4.25rem, .85fr)');
    expect(writeSource).toContain('<span className="hidden sm:inline">Dica</span>');
  });
});
