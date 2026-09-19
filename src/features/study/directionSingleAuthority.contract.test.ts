import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_STUDY_SETTINGS_SNAPSHOT,
  applyStudySettingsPatch,
  normalizeStudySettingsSnapshotV3,
} from "./lib/studySettingsSnapshotV3";
import { directionToRewriteSide, rewriteSideToDirection } from "./lib/writeActivityMode";

const read = (path: string) => readFileSync(path, "utf8");

const BASE = { ...DEFAULT_STUDY_SETTINGS_SNAPSHOT, studyFlowMode: "continuous" as const };

describe("direção única para todos os modos de Study", () => {
  it("direction decide e writeRewriteSide é apenas espelho derivado", () => {
    expect(directionToRewriteSide("a-b")).toBe("b");
    expect(directionToRewriteSide("b-a")).toBe("a");
    expect(directionToRewriteSide("any")).toBe("alternating");

    for (const direction of ["a-b", "b-a", "any"] as const) {
      expect(applyStudySettingsPatch(BASE, { direction })).toMatchObject({
        direction,
        writeRewriteSide: directionToRewriteSide(direction),
      });
    }
  });

  it("repara snapshot dessincronizado sempre pela direção", () => {
    const repaired = normalizeStudySettingsSnapshotV3({
      version: 3,
      direction: "any",
      writeActivityMode: "rewrite",
      writeRewriteSide: "a",
    });
    expect(repaired.direction).toBe("any");
    expect(repaired.writeRewriteSide).toBe("alternating");

    // Compatibilidade: um patch legado que só pede o lado é traduzido para direção,

    // nunca aceito como decisão paralela.

    const legacy = applyStudySettingsPatch(BASE, { writeRewriteSide: "b" });
    expect(legacy.direction).toBe(rewriteSideToDirection("b"));
    expect(legacy.writeRewriteSide).toBe("b");
  });

  it("a UI de escrita não pergunta o lado de novo", () => {
    const settings = read("src/features/study/components/WriteActivitySettings.tsx");
    expect(settings).not.toContain("Qual lado você quer praticar?");
    expect(settings).not.toContain("writeRewriteSide:");
    expect(settings).toContain("A direção é definida nas configurações de direção do Study");
  });

  it("a view de escrita deriva o lado da direção", () => {
    const write = read("src/features/study/components/WriteStudyView.impl.tsx");
    expect(write).toContain("resolveRewriteSideForCard(cardIdentity, directionToRewriteSide(direction))");
    expect(write).not.toContain("writeRewriteSide");
  });

  it("todos os modos resolvem o lado pela mesma direção", () => {
    const modes = [
      "src/features/study/components/FlipStudyView.impl.tsx",
      "src/features/study/components/WriteStudyView.impl.tsx",
      "src/features/study/components/MultipleChoiceStudyView.impl.tsx",
      "src/features/study/components/UnscrambleStudyView.impl.tsx",
      "src/features/study/components/PronunciationStudyView.impl.tsx",
    ];
    for (const path of modes) {
      const source = read(path);
      expect(source).toContain("resolveStudySides(");
      expect(source).toMatch(/resolveStudySides\([\s\S]{0,220}?direction/);
    }
  });

  it("o seletor canônico de direção é único e reutilizado", () => {
    const selector = "src/features/study/components/StudyDirectionSelector.tsx";
    expect(read(selector)).toContain("buildStudyDirectionOptions");
    // Quem hospeda o seletor são os dois pontos canônicos de configuração.
    expect(read("src/features/study/components/GameSettingsModal.impl.tsx")).toContain("StudyDirectionSelector");
    // Mixed/Study usam a mesma autoridade via modal, nunca um seletor próprio.
    expect(read("src/pages/MixedStudy.tsx")).toContain("showDirection");
    expect(read("src/pages/MixedStudy.tsx")).not.toContain("buildStudyDirectionOptions");
    expect(read("src/pages/Study.tsx")).not.toContain("Qual lado você quer praticar?");
  });
});
