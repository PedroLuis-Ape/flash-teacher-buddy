import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const wrapper = readFileSync(
  "src/features/study/components/GameSettingsModal.tsx",
  "utf8",
);
const resolution = readFileSync(
  "src/features/study/lib/studyCardNotesTarget.ts",
  "utf8",
);
const glossaryNoteService = readFileSync(
  "src/features/study/lib/glossaryNoteApi.ts",
  "utf8",
);

describe("revision-mode card notes", () => {
  it("keeps note editing available when Study intentionally withholds direct system-card editing", () => {
    expect(wrapper).toContain("fallbackNotesHandler");
    expect(wrapper).toContain("Boolean(user?.id)");
    expect(wrapper).toContain("onEditCurrentCard={effectiveEditHandler}");
    expect(wrapper).toContain("canEditCurrentCard={effectiveCanEdit}");
  });

  it("uses the shared resolver instead of a second copy of the identity logic", () => {
    expect(wrapper).toContain("resolveCurrentSourceCard");
    expect(wrapper).not.toContain('from("user_reinforcement_points")');
    expect(glossaryNoteService).toContain("resolveCurrentSourceCard");
  });

  it("resolves the exact visible layer from the shared resume pointer", () => {
    expect(resolution).toContain("readStudyResumePointer");
    expect(resolution).toContain("pointer.layerIndex");
    expect(resolution).toContain("resolveVisibleCard");
    expect(resolution).toContain('.order("layer_index", { ascending: true })');
  });

  it("maps reinforcement materializations back to the original flashcard before writing", () => {
    expect(resolution).toContain('from("user_reinforcement_points")');
    expect(resolution).toContain('eq("materialization_group_id", materializationGroupId)');
    expect(resolution).toContain('select("source_card_id")');
    expect(resolution).toContain("resolveMatchingSourceLayer");
  });

  it("keeps compatibility with historical attention-point materializations", () => {
    expect(resolution).toContain('from("user_special_flashcards")');
    expect(resolution).toContain('select("flashcard_id")');
  });

  it("opens the original card in notes-only mode so gameplay state is untouched", () => {
    expect(wrapper).toContain('contentMode="notes-only"');
    expect(wrapper).toContain("setNotesCard(sourceCard)");
    expect(wrapper).not.toContain("restartSession");
    expect(wrapper).not.toContain("resetSession");
  });
});

