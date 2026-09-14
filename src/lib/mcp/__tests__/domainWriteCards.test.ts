import { describe, expect, it } from "vitest";
import { addCards, removeCards, updateCards } from "../domain/cardWrites";
import {
  CARD_A_1,
  CARD_A_2,
  CARD_B_1,
  EXTRA_LAYER_CARD,
  LIST_A,
  LIST_B,
  USER_A,
  USER_B,
  buildTables,
  callsFor,
  confirmationKeyFor,
  createHarness,
  makeCardRow,
} from "./fixtures";

const KEY = confirmationKeyFor();

function bulkCardIds(count: number): string[] {
  return Array.from({ length: count }, (_, index) => "aaaaaaaa-0004-4000-8000-" + String(index).padStart(12, "0"));
}

function tablesWithBulkCards(count: number) {
  const tables = buildTables();
  const listA = tables.lists.find((row) => row.id === LIST_A);
  for (const id of bulkCardIds(count)) {
    tables.flashcards.push(makeCardRow({ id, term: "term-" + id.slice(-3) }, listA));
  }
  const layerId = "aaaaaaaa-0005-4000-8000-000000000001";
  tables.flashcards.push(
    makeCardRow({ id: layerId, term: "layer", translation: "camada", parent_card_id: CARD_A_1 }, listA),
  );
  return { tables, layerId };
}

describe("add_flashcards", () => {
  it("inserts a whole batch in one request and skips pairs that already exist", async () => {
    const harness = createHarness();
    const result = await addCards(harness.db, {
      list_id: LIST_A,
      cards: [
        { term: "work", translation: "trabalhar" },
        { term: "study", translation: "estudar" },
        { term: "learn", translation: "aprender" },
        { term: "teach", translation: "ensinar", hint: "dica", example_text: "They teach." },
      ],
    });

    expect(result.created).toBe(2);
    expect(result.skipped_existing).toBe(2);
    const inserts = callsFor(harness.calls, "flashcards").filter((call) => call.operation === "insert");
    expect(inserts).toHaveLength(1);
    const created = harness.fake.tables.flashcards.filter((row) => row.term === "learn" || row.term === "teach");
    expect(created).toHaveLength(2);
    expect(created.every((row) => row.user_id === USER_A)).toBe(true);
  });

  it("can force insertion of repeated terms when the user asks for it", async () => {
    const harness = createHarness();
    const result = await addCards(harness.db, {
      list_id: LIST_A,
      cards: [{ term: "bank", translation: "banco (financeiro)" }, { term: "bank", translation: "margem do rio" }],
      on_duplicate: "insert",
    });
    expect(result.created).toBe(2);
    expect(result.skipped_existing).toBe(0);
  });

  it("skips duplicate pairs repeated inside the same batch", async () => {
    const harness = createHarness();
    const result = await addCards(harness.db, {
      list_id: LIST_A,
      cards: [
        { term: "same", translation: "igual" },
        { term: " SAME ", translation: "IGUAL" },
      ],
    });

    expect(result).toMatchObject({ created: 1, skipped_existing: 1 });
    expect(harness.fake.tables.flashcards.filter((row) => row.term?.toString().trim().toLowerCase() === "same")).toHaveLength(1);
  });

  it("refuses a foreign list, a foreign parent card and an invalid batch", async () => {
    const harness = createHarness();
    await expect(
      addCards(harness.db, { list_id: LIST_B, cards: [{ term: "a", translation: "b" }] }),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(
      addCards(harness.db, {
        list_id: LIST_A,
        cards: [{ term: "a", translation: "b", parent_card_id: CARD_B_1 }],
      }),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(addCards(harness.db, { list_id: LIST_A, cards: [] })).rejects.toMatchObject({
      code: "invalid_input",
    });
    await expect(
      addCards(harness.db, { list_id: LIST_A, cards: [{ term: "", translation: "b" }] }),
    ).rejects.toMatchObject({ code: "invalid_input" });
  });
});

describe("update_flashcards", () => {
  it("applies the same values to many cards in a single UPDATE", async () => {
    const harness = createHarness();
    const result = await updateCards(harness.db, {
      list_id: LIST_A,
      card_ids: [CARD_A_1, CARD_A_2],
      set: { context_tag: "A1", example_text: "Example." },
    });

    expect(result).toMatchObject({ mode: "same_values", updated: 2, not_found: [] });
    expect(callsFor(harness.calls, "flashcards").filter((call) => call.operation === "update")).toHaveLength(1);
    expect(harness.fake.tables.flashcards.find((row) => row.id === CARD_A_1)?.context_tag).toBe("A1");
  });

  it("applies per-card values and reports cards that are not in the list", async () => {
    const harness = createHarness();
    const result = await updateCards(harness.db, {
      list_id: LIST_A,
      updates: [
        { card_id: CARD_A_1, term: "work (verb)", hint: "verbo" },
        { card_id: CARD_B_1, term: "não mexe" },
      ],
    });

    expect(result).toMatchObject({ mode: "per_card", updated: 1 });
    expect(result.not_found).toEqual([CARD_B_1]);
    expect(harness.fake.tables.flashcards.find((row) => row.id === CARD_A_1)?.term).toBe("work (verb)");
    const foreign = harness.fake.tables.flashcards.find((row) => row.id === CARD_B_1);
    expect(foreign?.user_id).toBe(USER_B);
    expect(foreign?.term).toBe("warehouse");
  });

  it("keeps per-card updates within a fixed request ceiling for a 50-card batch", async () => {
    const { tables } = tablesWithBulkCards(50);
    const harness = createHarness(tables);
    const ids = bulkCardIds(50);

    const result = await updateCards(harness.db, {
      list_id: LIST_A,
      updates: ids.map((card_id) => ({ card_id, hint: "batch hint" })),
    });

    expect(result).toMatchObject({ mode: "per_card", updated: 50, not_found: [] });
    const batchWrites = callsFor(harness.calls, "flashcards").filter((call) => call.operation === "update" || call.operation === "upsert");
    expect(batchWrites).toHaveLength(1);
  });

  it("refuses ambiguous or empty edits", async () => {
    const harness = createHarness();
    await expect(
      updateCards(harness.db, { list_id: LIST_A, card_ids: [CARD_A_1], set: {} }),
    ).rejects.toMatchObject({ code: "invalid_input" });
    await expect(
      updateCards(harness.db, {
        list_id: LIST_A,
        card_ids: [CARD_A_1],
        set: { hint: "x" },
        updates: [{ card_id: CARD_A_2, hint: "y" }],
      }),
    ).rejects.toMatchObject({ code: "invalid_input" });
  });
});

describe("remove_flashcards", () => {
  it("soft deletes small removals immediately, including child layers", async () => {
    const { tables, layerId } = tablesWithBulkCards(0);
    const harness = createHarness(tables);
    const result = await removeCards(harness.db, { list_id: LIST_A, card_ids: [CARD_A_1] }, KEY);

    expect(result).toMatchObject({ removed_cards: 1, removed_layers: 1, total_removed: 2, recoverable: true });
    expect(harness.fake.tables.flashcards.find((row) => row.id === CARD_A_1)?.deleted_at).toBeTruthy();
    expect(harness.fake.tables.flashcards.find((row) => row.id === layerId)?.deleted_at).toBeTruthy();
    expect(harness.fake.tables.flashcards.find((row) => row.id === CARD_A_2)?.deleted_at).toBeNull();
  });

  it("requires the two-step confirmation above the material threshold", async () => {
    const { tables } = tablesWithBulkCards(30);
    const harness = createHarness(tables);
    const ids = bulkCardIds(30);

    const preview = await removeCards(harness.db, { list_id: LIST_A, card_ids: ids, dry_run: true }, KEY);
    expect(preview.requires_confirmation).toBe(true);
    expect(preview.cards_to_remove).toBe(30);
    expect(String(preview.confirmation_token)).toContain(".");

    await expect(
      removeCards(harness.db, { list_id: LIST_A, card_ids: ids }, KEY),
    ).rejects.toMatchObject({ code: "confirmation_required" });
    await expect(
      removeCards(harness.db, { list_id: LIST_A, card_ids: ids, confirmation_token: "forjado-token.9999999999" }, KEY),
    ).rejects.toMatchObject({ code: "confirmation_required" });

    const confirmed = await removeCards(
      harness.db,
      { list_id: LIST_A, card_ids: ids, confirmation_token: preview.confirmation_token },
      KEY,
    );
    expect(confirmed.total_removed).toBe(30);

    const repeated = await removeCards(
      harness.db,
      { list_id: LIST_A, card_ids: ids, dry_run: false },
      KEY,
    );
    expect(repeated).toMatchObject({ total_removed: 0, already_removed: 30 });
    expect(repeated.note).toContain("Nada a remover");
  });

  it("rejects a confirmation token when the requested card set changes", async () => {
    const { tables } = tablesWithBulkCards(60);
    const harness = createHarness(tables);
    const firstSet = bulkCardIds(30);
    const secondSet = bulkCardIds(60).slice(30);

    const preview = await removeCards(harness.db, { list_id: LIST_A, card_ids: firstSet, dry_run: true }, KEY);

    await expect(
      removeCards(
        harness.db,
        { list_id: LIST_A, card_ids: secondSet, confirmation_token: preview.confirmation_token },
        KEY,
      ),
    ).rejects.toMatchObject({ code: "confirmation_required" });
    expect(harness.fake.tables.flashcards.filter((row) => secondSet.includes(String(row.id)) && row.deleted_at == null)).toHaveLength(30);
  });

  it("refuses a token signed for another account", async () => {
    const { tables } = tablesWithBulkCards(30);
    const harness = createHarness(tables);
    const ids = bulkCardIds(30);
    const foreignPreview = await removeCards(
      harness.db,
      { list_id: LIST_A, card_ids: ids, dry_run: true },
      confirmationKeyFor(USER_B),
    );
    await expect(
      removeCards(
        harness.db,
        { list_id: LIST_A, card_ids: ids, confirmation_token: foreignPreview.confirmation_token },
        KEY,
      ),
    ).rejects.toMatchObject({ code: "confirmation_required" });
  });

  it("keeps the card set consistent when the atomic delete statement fails", async () => {
    const { tables } = tablesWithBulkCards(0);
    const harness = createHarness(tables, {
      failUpdate: { code: "57014", message: "simulated statement failure" },
    });

    await expect(removeCards(harness.db, { list_id: LIST_A, card_ids: [CARD_A_1] }, KEY)).rejects.toMatchObject({
      code: "unavailable",
    });
    expect(harness.fake.tables.flashcards.find((row) => row.id === CARD_A_1)?.deleted_at).toBeNull();
    expect(harness.fake.tables.flashcards.find((row) => row.parent_card_id === CARD_A_1)?.deleted_at).toBeNull();
    expect(callsFor(harness.calls, "flashcards").filter((call) => call.operation === "update")).toHaveLength(1);
  });
});
