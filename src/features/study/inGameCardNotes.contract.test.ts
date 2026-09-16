import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

const study = read("src/pages/Study.tsx");
const mixed = read("src/pages/MixedStudy.tsx");
const settings = read("src/features/study/components/GameSettingsModal.impl.tsx");
const editor = read("src/components/EditFlashcardDialog.tsx");
const explanationPanel = read("src/features/study/components/DetailedExplanationPanel.impl.tsx");

describe("in-game card notes", () => {
  it("keeps the exact visible card editor wired through the regular Study runtime", () => {
    expect(study).toContain("setEditingFlashcard(displayedCard as Flashcard)");
    expect(study).toContain("handleUpdateFlashcardInGame");
    expect(study).toContain("preserving cardsOrder + currentIndex");
  });

  it("makes the same action available to Mixed Study through the shared settings menu", () => {
    expect(mixed).toContain("<GameSettingsModal");
    expect(settings).toContain("readStudyResumePointer");
    expect(settings).toContain("pointer.currentCardId");
    expect(settings).toContain("pointerPathname !== currentPathname");
    expect(settings).toContain('contentMode="notes-only"');
    expect(settings).toContain("Editar / anotar este card");
  });

  it("persists the pedagogical note fields on the flashcard itself", () => {
    expect(editor).toContain("note_text");
    expect(editor).toContain("short_explanation");
    expect(editor).toContain("detailed_explanation");
    expect(editor).toContain("usage_notes");
    expect(editor).toContain("common_mistakes");
    expect(editor).toContain('.from("flashcards")');
    expect(editor).toContain(".update(extendedPayload)");
    expect(editor).toContain('.select("id")');
  });

  it("refreshes the visible detailed explanation without rebuilding the deck", () => {
    expect(editor).toContain("setCurrentDetailedExplanation");
    expect(explanationPanel).toContain("useSyncExternalStore");
    expect(explanationPanel).toContain("liveValue.explanation");
    expect(explanationPanel).toContain("liveValue.usageNotes");
    expect(explanationPanel).toContain("liveValue.commonMistakes");
  });

  it("does not restart or rebuild the study session just to save notes", () => {
    expect(editor).toContain("ape:flashcard:notes-updated");
    expect(editor).toContain("flashcard.detailed_explanation = extendedPayload.detailed_explanation");
    expect(editor).not.toContain("restartSession");
    expect(editor).not.toContain("resetSession");
  });

  it("keeps Mixed Study note editing scoped to an owned exact card", () => {
    expect(settings).toContain('(data as any).user_id !== user.id');
    expect(settings).toContain("Você só pode editar cards que pertencem à sua conta.");
    expect(settings).toContain('.eq("id", pointer.currentCardId)');
  });
});
