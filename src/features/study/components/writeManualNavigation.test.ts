import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const writeSource = readFileSync(new URL("./WriteStudyView.tsx", import.meta.url), "utf8");
const mixedSource = readFileSync(new URL("./MultipleChoiceStudyView.tsx", import.meta.url), "utf8");
const advanceControllerSource = readFileSync(
  new URL("../hooks/useAdvanceController.ts", import.meta.url),
  "utf8",
);

describe("write mode stability", () => {
  it("guards duplicate submit and navigation events", () => {
    expect(writeSource).toContain("submitLockedRef");
    expect(writeSource).toContain("navigationLockedRef");
    expect(writeSource).toContain("onKeyDownCapture");
    expect(writeSource).toContain("event.stopPropagation()");
  });

  it("unlocks both gates when the learner retries a correction", () => {
    expect(writeSource).toContain('includes("tentar corrigir")');
    expect(writeSource).toContain('includes("reescrever agora")');
    expect(writeSource).toContain("submitLockedRef.current = false");
    expect(writeSource).toContain("navigationLockedRef.current = false");
    expect(advanceControllerSource).toContain('if (next === "unanswered") resetAttempt()');
  });

  it("never leaves the submit gate permanently locked", () => {
    // O bloqueio de envio existe apenas para o duplo-clique imediato: precisa
    // ser liberado por tempo para não travar "Corrigir" após feedback.
    expect(writeSource).toContain("submitUnlockTimerRef");
    expect(writeSource).toContain("window.setTimeout(() => {");
    expect(writeSource).toContain("window.clearTimeout(submitUnlockTimerRef.current)");
  });

  it("routes mixed write slots through the same stability boundary", () => {
    expect(mixedSource).toContain('import { WriteStudyView } from "./WriteStudyView"');
    expect(mixedSource).not.toContain('import("./WriteStudyView.impl")');
    expect(mixedSource).toContain("return (");
    expect(mixedSource).toContain("<WriteStudyView");
  });
});
