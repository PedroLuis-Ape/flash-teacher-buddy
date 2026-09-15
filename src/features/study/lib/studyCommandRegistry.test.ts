import { describe, expect, it } from "vitest";
import {
  isStudyCommandAvailable,
  resolveStudyCommands,
  type StudyCommandContext,
} from "./studyCommandRegistry";

const base = (patch: Partial<StudyCommandContext> = {}): StudyCommandContext => ({
  mode: "flip",
  flowMode: "continuous",
  canGoNext: true,
  canGoPrevious: true,
  hasLayers: false,
  ttsEnabled: true,
  awaitingTextAnswer: false,
  hasFeedback: false,
  ...patch,
});

const ids = (context: StudyCommandContext) => resolveStudyCommands(context).map((command) => command.id);

describe("studyCommandRegistry", () => {
  it("removes mastery assessment from Flip continuous and keeps free navigation", () => {
    const context = base({ mode: "flip", flowMode: "continuous" });
    expect(ids(context)).toContain("nextCard");
    expect(ids(context)).toContain("flip");
    expect(ids(context)).toContain("playAudio");
    expect(ids(context)).not.toContain("knew");
    expect(ids(context)).not.toContain("didntKnow");
  });

  it("exposes Sabia/Não sabia only in Flip mastery and removes free next", () => {
    const context = base({ mode: "flip", flowMode: "mastery_rounds" });
    expect(ids(context)).toContain("knew");
    expect(ids(context)).toContain("didntKnow");
    expect(ids(context)).not.toContain("nextCard");
  });

  it("never exposes Sabia/Não sabia in Write or Rewrite-capable write flow", () => {
    for (const flowMode of ["continuous", "mastery_rounds"] as const) {
      const context = base({ mode: "write", flowMode, awaitingTextAnswer: true });
      expect(ids(context)).toContain("confirm");
      expect(ids(context)).toContain("playAudio");
      expect(ids(context)).not.toContain("knew");
      expect(ids(context)).not.toContain("didntKnow");
    }
  });

  it("keeps non-assessment modes free of hidden assessment commands", () => {
    for (const mode of ["multiple-choice", "unscramble", "pronunciation"] as const) {
      const context = base({ mode, flowMode: "mastery_rounds" });
      expect(ids(context)).not.toContain("knew");
      expect(ids(context)).not.toContain("didntKnow");
    }
  });

  it("UI resolution and execution availability are the same source of truth", () => {
    const contexts = [
      base({ mode: "flip", flowMode: "continuous" }),
      base({ mode: "flip", flowMode: "mastery_rounds" }),
      base({ mode: "write", flowMode: "continuous" }),
      base({ mode: "multiple-choice" }),
      base({ mode: "unscramble" }),
      base({ mode: "pronunciation" }),
    ];
    for (const context of contexts) {
      const resolved = new Set(ids(context));
      for (const command of ["nextCard", "prevCard", "flip", "confirm", "knew", "didntKnow", "skip", "playAudio", "nextLayer", "restart"] as const) {
        expect(isStudyCommandAvailable(command, context)).toBe(resolved.has(command));
      }
    }
  });

  it("re-resolves immediately when the flow changes", () => {
    const continuous = base({ mode: "flip", flowMode: "continuous" });
    const mastery = { ...continuous, flowMode: "mastery_rounds" as const };
    expect(isStudyCommandAvailable("knew", continuous)).toBe(false);
    expect(isStudyCommandAvailable("knew", mastery)).toBe(true);
    expect(isStudyCommandAvailable("nextCard", continuous)).toBe(true);
    expect(isStudyCommandAvailable("nextCard", mastery)).toBe(false);
  });
});
