import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const FOLDER = readFileSync(path.join(process.cwd(), "src/pages/Folder.tsx"), "utf8");
const DIALOGS = readFileSync(
  path.join(process.cwd(), "src/features/library/EmbeddedListDialogs.tsx"),
  "utf8",
);

describe("folder UI contract — listas combinadas", () => {
  it("exposes creation next to the existing list creation action", () => {
    expect(FOLDER).toContain("Nova Lista");
    expect(FOLDER).toContain("Lista combinada");
    expect(FOLDER).toContain("embedded-list-create-trigger");
    expect(FOLDER).toContain("EmbeddedListCreateDialog");
  });

  it("exposes owner-only management for embedded lists", () => {
    expect(FOLDER).toContain("Gerenciar cards incorporados");
    expect(FOLDER).toContain("embedded-list-manage-action");
    expect(FOLDER).toContain("list.is_embedded && isOwner");
  });

  it("exposes management in the default list view too", () => {
    expect(FOLDER).toContain("embedded-list-manage-action-row");
    expect(FOLDER).toContain("Gerenciar cards incorporados de ${list.title}");
    expect(FOLDER.match(/setManagingEmbeddedList\(list\)/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("keeps v1 owner-private: creation hidden in class context and sharing skips embedded lists", () => {
    expect(FOLDER).toContain("isOwner && !isSystemFolder && !isClassContext");
    expect(FOLDER).toContain("lists.filter((list) => !list.is_embedded).map((list) => list.id)");
    expect(FOLDER).toContain("if (normalListIds.length > 0)");
    expect(FOLDER).toContain('.in("id", normalListIds)');
  });


  it("marks embedded lists and keeps reference ids and normal counts", () => {
    expect(FOLDER).toContain("🔗 Combinada");
    expect(FOLDER).toContain("list.reference_id");
    expect(FOLDER).toContain("{list.card_count || 0} {list.card_count === 1 ? 'card' : 'cards'}");
  });

  it("never labels unembed as card deletion", () => {
    expect(DIALOGS).toContain("da lista combinada");
    expect(DIALOGS).toContain("Remover todos desta fonte");
    expect(DIALOGS).toContain("Esvaziar lista combinada");
    expect(DIALOGS).not.toContain("Excluir card");
    expect(DIALOGS).not.toContain('from("flashcards")');
  });

  it("supports single and multi-select unembed plus source-level operations", () => {
    expect(DIALOGS).toContain("unembedCards(listId, [member.flashcard_id])");
    expect(DIALOGS).toContain("unembedCards(listId, selected)");
    expect(DIALOGS).toContain("unembedSourceList(listId, group.sourceListId)");
    expect(DIALOGS).toContain("embedSourceLists(listId, [list.id])");
    expect(DIALOGS).toContain("clearEmbeddedList(listId)");
  });
});
