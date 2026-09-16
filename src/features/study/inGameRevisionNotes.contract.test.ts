import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const wrapper = readFileSync(
  "src/features/study/components/GameSettingsModal.tsx",
  "utf8",
);

describe("revision-mode card notes", () => {
  it("keeps note editing available when Study intentionally withholds direct system-card editing", () => {
    expect(wrapper).toContain("fallbackNotesHandler");
    expect(wrapper).toContain("Boolean(user?.id)");
    expect(wrapper).toContain("onEditCurrentCard={effectiveEditHandler}");
    expect(wrapper).toContain("canEditCurrentCard={effectiveCanEdit}");
  });

  it("resolves the exact visible layer from the shared resume pointer", () => {
    expect(wrapper).toContain("readStudyResumePointer");
    expect(wrapper).toContain("pointer.layerIndex");
    expect(wrapper).toContain("resolveVisibleCard");
    expect(wrapper).toContain('.order("layer_index", { ascending: true })');
  });

  it("maps reinforcement materializations back to the original flashcard before saving notes", () => {
    expect(wrapper).toContain('from("user_reinforcement_points")');
    expect(wrapper).toContain('eq("materialization_group_id", materializationGroupId)');
    expect(wrapper).toContain('select("source_card_id")');
    expect(wrapper).toContain("resolveMatchingSourceLayer");
  });

  it("keeps compatibility with historical attention-point materializations", () => {
    expect(wrapper).toContain('from("user_special_flashcards")');
    expect(wrapper).toContain('select("flashcard_id")');
  });

  it("opens the original card in notes-only mode so gameplay state is untouched", () => {
    expect(wrapper).toContain('contentMode="notes-only"');
    expect(wrapper).toContain("setNotesCard(originalCard)");
    expect(wrapper).not.toContain("restartSession");
    expect(wrapper).not.toContain("resetSession");
  });
});
