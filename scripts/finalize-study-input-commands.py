from pathlib import Path

# One-shot finalizer used only on the isolated validation branch.
study = Path("src/pages/Study.tsx")
text = study.read_text()
marker = 'import { StudyProgressHud } from "@/features/study/components/StudyProgressHud";\n'
imports = '''import { StudyCommandsPanel } from "@/features/study/components/StudyCommandsPanel";\nimport {\n  isStudyCommandAvailable,\n  type StudyCommandContext,\n} from "@/features/study/lib/studyCommandRegistry";\n'''
if 'StudyCommandsPanel } from "@/features/study/components/StudyCommandsPanel"' not in text:
    if marker not in text:
        raise SystemExit("Study import marker not found")
    text = text.replace(marker, marker + imports, 1)

old_mode = 'mode: (effectiveMode === "mixed" ? "flip" : effectiveMode) as StudyCommandContext["mode"],'
new_mode = 'mode: effectiveMode as StudyCommandContext["mode"],'
if old_mode in text:
    text = text.replace(old_mode, new_mode, 1)
if '<StudyCommandsPanel context={studyCommandContext} />' not in text:
    raise SystemExit("StudyCommandsPanel integration missing")
study.write_text(text)

Path("src/features/study/lib/studyCommandRegistry.test.ts").write_text('''import { describe, expect, it } from "vitest";
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
''')

Path("src/features/study/lib/typeToAnswer.test.ts").write_text('''import { describe, expect, it } from "vitest";
import { evaluateTypeToAnswerKey, isPrintableTextKey } from "./typeToAnswer";

const options = {
  enabled: true,
  activeElement: null,
  overlayOpen: false,
  scopeBlocking: false,
};

describe("typeToAnswer", () => {
  it("captures the first printable character", () => {
    expect(evaluateTypeToAnswerKey({ key: "a" }, options)).toEqual({ capture: true });
    expect(evaluateTypeToAnswerKey({ key: "Á" }, options)).toEqual({ capture: true });
  });

  it("does not capture modifier combinations", () => {
    expect(evaluateTypeToAnswerKey({ key: "a", ctrlKey: true }, options).capture).toBe(false);
    expect(evaluateTypeToAnswerKey({ key: "a", metaKey: true }, options).capture).toBe(false);
    expect(evaluateTypeToAnswerKey({ key: "a", altKey: true }, options).capture).toBe(false);
  });

  it("does not capture IME composition", () => {
    expect(evaluateTypeToAnswerKey({ key: "あ", isComposing: true }, options).capture).toBe(false);
  });

  it("does not capture semantic/special keys", () => {
    for (const key of ["Enter", "Tab", "Escape", "ArrowLeft", "ArrowRight", "Backspace", "F1", " "]) {
      expect(isPrintableTextKey({ key })).toBe(false);
      expect(evaluateTypeToAnswerKey({ key }, options).capture).toBe(false);
    }
  });

  it("does not steal input from an already focused editable", () => {
    const editable = { tagName: "INPUT", isContentEditable: false } as unknown as EventTarget;
    expect(evaluateTypeToAnswerKey({ key: "x", target: editable }, options).capture).toBe(false);
  });

  it("does not capture while an overlay or blocking scope is active", () => {
    expect(evaluateTypeToAnswerKey({ key: "x" }, { ...options, overlayOpen: true }).capture).toBe(false);
    expect(evaluateTypeToAnswerKey({ key: "x" }, { ...options, scopeBlocking: true }).capture).toBe(false);
  });

  it("does nothing when the text-answer state is disabled", () => {
    expect(evaluateTypeToAnswerKey({ key: "x" }, { ...options, enabled: false }).capture).toBe(false);
  });
});
''')

Path("src/features/study/components/studyRuntimeInput.contract.test.ts").write_text('''import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("study runtime input/audio contracts", () => {
  it("Write owns type-to-answer without mount autofocus", () => {
    const source = read("src/features/study/components/WriteStudyView.impl.tsx");
    expect(source).toContain("useTypeToAnswer({");
    expect(source).toContain("inputRef,");
    expect(source).not.toContain("autoFocus");
  });

  it("all primary game modes keep a manual audio control", () => {
    const files = [
      "src/features/study/components/FlipStudyView.impl.tsx",
      "src/features/study/components/WriteStudyView.impl.tsx",
      "src/features/study/components/MultipleChoiceStudyView.impl.tsx",
      "src/features/study/components/UnscrambleStudyView.impl.tsx",
      "src/features/study/components/PronunciationStudyView.impl.tsx",
    ];
    for (const file of files) {
      const source = read(file);
      expect(source, file).toContain("Volume2");
      expect(source, file).toMatch(/speak|handlePlayAudio|handlePlayPronunciation/);
    }
  });

  it("Flip no longer drives entry audio through DOM clicks or a fixed 1000 ms delay", () => {
    const wrapper = read("src/features/study/components/FlipStudyView.tsx");
    expect(wrapper).not.toContain("querySelector");
    expect(wrapper).not.toContain("FLIP_ENTRY_AUDIO_DELAY_MS");
    expect(wrapper).not.toMatch(/setTimeout\\([^)]*1000/);
  });

  it("the Commands panel renders from the semantic registry", () => {
    const source = read("src/features/study/components/StudyCommandsPanel.tsx");
    expect(source).toContain("resolveStudyCommands(context)");
    expect(source).not.toContain("Sabia / Não sabia");
  });
});
''')
