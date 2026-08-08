import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("study completion flow", () => {
  it("wires completion, restart and deterministic return actions", () => {
    const study = read("src/pages/Study.tsx");
    const modal = read("src/features/study/components/StudyCompletionModal.impl.tsx");
    expect(study).toContain("handleCompleteAndExit");
    expect(study).toContain("handleFinishedExit");
    expect(study).toContain("handleRestartWithSettings");
    expect(study).toContain("buildStudyReturnRoute");
    expect(modal).toContain("CONCLUINDO...");
    expect(modal).toContain("Reiniciando...");
  });

  it("uses the 3D trophy emoji in both completion views", () => {
    const study = read("src/pages/Study.tsx");
    const modal = read("src/features/study/components/StudyCompletionModal.impl.tsx");
    expect(study).toContain("🏆");
    expect(modal).toContain("🏆");
  });

  it("saves on page exit and creates a fresh session on restart", () => {
    const engine = read("src/features/study/hooks/useStudyEngine.ts");
    expect(engine).toContain("writeStudySnapshot");
    expect(engine).toContain("readStudySnapshot");
    expect(engine).toContain("pagehide");
    expect(engine).toContain("visibilitychange");
    expect(engine).toContain("const restartSession = useCallback(async");
    expect(engine).toContain("fresh-close-previous-session");
    expect(engine).toContain("restart-close-previous-session-unconfirmed");
    expect(engine).toContain("recordStudyProgressAttempt");
    expect(engine).toContain("progressBufferRef.current.length > 0");
    expect(engine).toContain("await flushProgressBuffer();");
    const progressRepository = read("src/features/study/lib/studyProgressRepository.ts");
    expect(progressRepository).toContain("record_flashcard_progress_v1");
    expect(progressRepository).toContain("study-progress-fallback-update-unconfirmed");
    expect(engine).toContain("discardSession");
    expect(engine).not.toContain("if (!isAuthenticated) return;");
  });

  it("aguarda progresso pendente antes de sair do Misto", () => {
    const mixed = read("src/pages/MixedStudy.tsx");
    expect(mixed).toContain("progressWritesRef");
    expect(mixed).toContain("mixed-progress-before-exit");
    expect(mixed).toContain("await mixed.persistNow()");
  });

  it("routes Mixed through the shared readiness contract", () => {
    const mixed = read("src/pages/MixedStudy.tsx");
    expect(mixed).toContain("resolveStudySessionReadiness");
    expect(mixed).toContain('retrying: loadAttempt > 0 && loading');
    expect(mixed).toContain('sessionReadiness.phase === "retrying"');
    expect(mixed).toContain('sessionReadiness.phase === "empty"');
  });
});
