import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("study completion flow", () => {
  it("wires completion, restart and deterministic return actions", () => {
    const study = read("src/pages/Study.tsx");
    expect(study).toContain("handleCompleteAndExit");
    expect(study).toContain("handleFinishedExit");
    expect(study).toContain("handleRestartWithSettings");
    expect(study).toContain("buildStudyReturnRoute");
    expect(study).toContain("CONCLUINDO...");
    expect(study).toContain("Reiniciando...");
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
    expect(engine).toContain("discardSession");
    expect(engine).not.toContain("if (!isAuthenticated) return;");
  });
});
