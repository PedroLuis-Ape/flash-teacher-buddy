import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

const interactiveText = read("src/features/study/components/InteractiveText.tsx");
const hook = read("src/features/study/hooks/useInGameGlossaryNote.ts");
const noteLib = read("src/features/study/lib/glossaryNote.ts");

const views = [
  "src/features/study/components/FlipStudyView.impl.tsx",
  "src/features/study/components/WriteStudyView.impl.tsx",
  "src/features/study/components/MultipleChoiceStudyView.impl.tsx",
  "src/features/study/components/UnscrambleStudyView.impl.tsx",
  "src/features/study/components/PronunciationStudyView.impl.tsx",
  "src/features/study/components/StudyFeedbackPanel.tsx",
].map(read);

describe("in-game glossary usage note", () => {
  it("keeps the card visually clean and puts every action inside the glossary entry", () => {
    expect(interactiveText).toContain('data-glossary-entry="true"');
    expect(interactiveText).toContain('data-glossary-note-action="true"');
    expect(interactiveText).toContain('data-glossary-note-editor="true"');
    expect(interactiveText).not.toContain("fixed bottom");
    expect(interactiveText).not.toContain("action-rail");
  });

  it("shows the lightbulb only when a personal note exists", () => {
    expect(interactiveText).toContain("{personalNote && (");
    expect(interactiveText).toContain('aria-label="Ver anotação de uso"');
    expect(interactiveText).toContain('aria-label={personalNote ? "Editar anotação de uso" : "Adicionar anotação de uso"}');
  });

  it("closes the tap preview after 5s and cancels it while editing", () => {
    expect(interactiveText).toContain("const NOTE_PREVIEW_MS = 5000");
    expect(interactiveText).toContain("window.setTimeout(() => setPreviewOpen(false), NOTE_PREVIEW_MS)");
    expect(interactiveText).toContain("if (!previewOpen || previewPinned || previewHovered || editing) return;");
    expect(interactiveText).toContain('data-glossary-note-preview="true"');
    expect(interactiveText).toContain('aria-label="Fechar anotação"');
  });

  it("edits inline with explicit save and preserves the draft on error", () => {
    expect(interactiveText).toContain("<Textarea");
    expect(interactiveText).toContain("maxLength={GLOSSARY_NOTE_MAX_LENGTH}");
    expect(interactiveText).toContain("setError(saveError instanceof Error");
    expect(interactiveText).not.toContain("onBlur={() => { void handleSave");
  });

  it("blocks doom-scroll gestures while the mobile sheet is open", () => {
    expect(interactiveText).toContain('data-glossary-sheet="true"');
    expect(interactiveText).toContain("onTouchStart={(event) => event.stopPropagation()}");
    expect(interactiveText).toContain("onTouchMove={(event) => event.stopPropagation()}");
  });

  it("never keeps a parallel local store", () => {
    expect(interactiveText).not.toContain("localStorage");
    expect(hook).not.toContain("localStorage");
    expect(noteLib).not.toContain("localStorage");
    expect(interactiveText).not.toContain("glossary_notes");
  });

  it("invalidates the shared React Query entry after saving", () => {
    expect(hook).toContain("setQueryData");
    expect(hook).toContain("invalidateQueries");
    expect(hook).toContain('queryKey: ["in-game-glossary-note"');
  });

  it("wires the physical side of the card in every shared view", () => {
    for (const view of views.slice(0, 5)) {
      expect(view).toContain('side=');
    }
    expect(views[5]).toContain("otherSideAnswer");
  });
});

