import { describe, expect, it } from "vitest";
import {
  decideAdvance,
  isFinalized,
  requiresCompletion,
  skipDialogCopyFor,
  type AdvanceSource,
  type StudyRuntimeMode,
} from "./advanceGate";

const SOURCES: AdvanceSource[] = [
  "next_button",
  "keyboard",
  "swipe",
  "auto_advance",
  "round_transition",
  "mode_transition",
];

describe("advanceGate.decideAdvance", () => {
  it("advances flip mode regardless of status", () => {
    for (const source of SOURCES) {
      expect(decideAdvance("unanswered", { source }, "flip").kind).toBe("advance");
    }
  });

  it("blocks write mode with confirmation when unanswered", () => {
    for (const source of SOURCES) {
      expect(decideAdvance("unanswered", { source }, "write").kind).toBe("confirm-skip");
    }
  });

  it("advances evaluative modes only when finalized", () => {
    const modes: StudyRuntimeMode[] = [
      "write",
      "mixed",
      "multiple-choice",
      "unscramble",
      "pronunciation",
    ];
    for (const mode of modes) {
      expect(decideAdvance("correct", { source: "next_button" }, mode).kind).toBe("advance");
      expect(decideAdvance("incorrect", { source: "next_button" }, mode).kind).toBe("advance");
      expect(decideAdvance("accepted_with_corrections", { source: "next_button" }, mode).kind).toBe(
        "advance",
      );
      expect(decideAdvance("revealed", { source: "next_button" }, mode).kind).toBe("advance");
      expect(decideAdvance("skipped", { source: "next_button" }, mode).kind).toBe("advance");
      expect(decideAdvance("unanswered", { source: "next_button" }, mode).kind).toBe(
        "confirm-skip",
      );
    }
  });

  it("isFinalized recognizes every terminal status and rejects unanswered", () => {
    expect(isFinalized("unanswered")).toBe(false);
    expect(isFinalized("correct")).toBe(true);
    expect(isFinalized("incorrect")).toBe(true);
    expect(isFinalized("accepted_with_corrections")).toBe(true);
    expect(isFinalized("revealed")).toBe(true);
    expect(isFinalized("skipped")).toBe(true);
  });

  it("requiresCompletion is false only for flip", () => {
    expect(requiresCompletion("flip")).toBe(false);
    expect(requiresCompletion("write")).toBe(true);
    expect(requiresCompletion("mixed")).toBe(true);
    expect(requiresCompletion("multiple-choice")).toBe(true);
    expect(requiresCompletion("unscramble")).toBe(true);
    expect(requiresCompletion("pronunciation")).toBe(true);
  });

  it("skipDialogCopyFor adapts wording per flow mode", () => {
    expect(skipDialogCopyFor("mastery_rounds").description).toContain("Rodadas de Domínio");
    expect(skipDialogCopyFor("continuous").description).toContain("não voltará automaticamente");
    expect(skipDialogCopyFor("continuous").cancelLabel).toBe("Voltar e responder");
    expect(skipDialogCopyFor("mastery_rounds").confirmLabel).toBe("Pular mesmo assim");
  });
});