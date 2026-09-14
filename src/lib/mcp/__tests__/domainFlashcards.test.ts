import { describe, expect, it } from "vitest";
import { PERSONAL_SCOPE } from "../domain/scope";
import { getFlashcards } from "../domain/flashcards";
import { CARD_A_1, CARD_A_2, LIST_A, LIST_B, createHarness } from "./fixtures";

describe("get_flashcards domain", () => {
  it("returns one page of the list's active cards in study order", async () => {
    const { db } = createHarness();
    const result = await getFlashcards(db, { scope: PERSONAL_SCOPE, listId: LIST_A });
    expect(result.list).toMatchObject({ id: LIST_A, title: "Phrasal Verbs" });
    expect(result.items.map((card) => card.id)).toEqual([CARD_A_1, CARD_A_2]);
    expect(result.items[0]).toMatchObject({ term: "work", translation: "trabalhar" });
    expect(result.total_count).toBe(2);
    expect(result.limit).toBe(25);
    expect(result.has_more).toBe(false);
  });

  it("paginates with offset and reports has_more", async () => {
    const { db } = createHarness();
    const first = await getFlashcards(db, { scope: PERSONAL_SCOPE, listId: LIST_A, limit: 1 });
    expect(first.items.map((card) => card.id)).toEqual([CARD_A_1]);
    expect(first.has_more).toBe(true);
    const second = await getFlashcards(db, { scope: PERSONAL_SCOPE, listId: LIST_A, limit: 1, offset: 1 });
    expect(second.items.map((card) => card.id)).toEqual([CARD_A_2]);
    expect(second.has_more).toBe(false);
  });

  it("caps the page size so a whole deck can never be dumped at once", async () => {
    const { db } = createHarness();
    const result = await getFlashcards(db, { scope: PERSONAL_SCOPE, listId: LIST_A, limit: 1000 });
    expect(result.limit).toBe(100);
  });

  it("refuses a list from another account", async () => {
    const { db } = createHarness();
    await expect(getFlashcards(db, { scope: PERSONAL_SCOPE, listId: LIST_B })).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(
      getFlashcards(db, { scope: PERSONAL_SCOPE, listId: "not-a-uuid" }),
    ).rejects.toMatchObject({ code: "invalid_input" });
  });
});
