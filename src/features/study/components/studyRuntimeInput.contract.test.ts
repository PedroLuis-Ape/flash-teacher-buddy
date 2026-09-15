import { readFileSync } from "node:fs";
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
    expect(wrapper).not.toMatch(/setTimeout\([^)]*1000/);
  });

  it("the Commands panel renders from the semantic registry", () => {
    const source = read("src/features/study/components/StudyCommandsPanel.tsx");
    expect(source).toContain("resolveStudyCommands(context)");
    expect(source).not.toContain("Sabia / Não sabia");
  });
});
