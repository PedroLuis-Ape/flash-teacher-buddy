import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RecordedCall } from "./fakeSupabase";

const hoisted = vi.hoisted(() => {
  const tables: Record<string, Record<string, unknown>[]> = {};
  const calls: RecordedCall[] = [];
  return { tables, calls };
});

vi.mock("@supabase/supabase-js", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const { createFakeClient } = await import("./fakeSupabase");
  return {
    ...actual,
    createClient: () => createFakeClient(hoisted.tables, {}, hoisted.calls),
  };
});

import mcp from "../index";
import {
  CARD_A_1,
  CARD_A_2,
  LIST_A,
  LIST_B,
  TEST_BEARER,
  authenticatedContext,
  buildTables,
  rpcCalls,
} from "./fixtures";

function toolNamed(name: string) {
  const tool = mcp.tools.find((candidate) => candidate.name === name);
  if (!tool) throw new Error("tool not registered: " + name);
  return tool;
}

async function invoke(name: string, args: Record<string, unknown>) {
  const result = await toolNamed(name).handler(args, authenticatedContext());
  const text = String((result.content?.[0] as { text?: string } | undefined)?.text ?? "{}");
  expect(text.includes(TEST_BEARER), name).toBe(false);
  return { result, payload: JSON.parse(text) };
}

beforeEach(() => {
  for (const key of Object.keys(hoisted.tables)) delete hoisted.tables[key];
  Object.assign(hoisted.tables, buildTables());
  hoisted.calls.length = 0;
});

describe("GATE_WRITE through the authenticated tool boundary", () => {
  it("creates folder -> list -> 5 cards and reads the result back", async () => {
    const folder = await invoke("create_folder", { title: "MCP TEST" });
    expect(folder.payload.ok).toBe(true);
    const folderId = String(folder.payload.folder.id);

    const list = await invoke("create_list", { folder_id: folderId, title: "MCP TEST LIST" });
    expect(list.payload.ok).toBe(true);
    const listId = String(list.payload.list.id);

    const added = await invoke("add_flashcards", {
      list_id: listId,
      cards: [
        { term: "work", translation: "trabalhar" },
        { term: "study", translation: "estudar" },
        { term: "learn", translation: "aprender" },
        { term: "teach", translation: "ensinar" },
        { term: "practice", translation: "praticar" },
      ],
    });
    expect(added.payload.created).toBe(5);
    // Five cards = ONE insert request (batch), not five.
    const cardInserts = hoisted.calls.filter(
      (call) => call.operation === "insert" && call.table === "flashcards",
    );
    expect(cardInserts).toHaveLength(1);

    const read = await invoke("get_list", { list_id: listId, include_cards: true });
    expect(read.payload.card_count).toBe(5);
    expect((read.payload.cards as unknown[]).length).toBe(5);

    const retry = await invoke("add_flashcards", {
      list_id: listId,
      cards: [{ term: "work", translation: "trabalhar" }],
    });
    expect(retry.payload).toMatchObject({ created: 0, skipped_existing: 1 });
  });

  it("renames a list, edits cards in batch and moves the list", async () => {
    const renamed = await invoke("update_list", { list_id: LIST_A, title: "Teste MCP Final" });
    expect(renamed.payload).toMatchObject({ updated: true });
    expect(renamed.payload.list).toMatchObject({ title: "Teste MCP Final" });

    const edited = await invoke("update_flashcards", {
      list_id: LIST_A,
      updates: [{ card_id: CARD_A_1, example_text: "I work every day." }, { card_id: CARD_A_2, hint: "verbo" }],
    });
    expect(edited.payload).toMatchObject({ mode: "per_card", updated: 2 });

    const moved = await invoke("move_list", { list_id: LIST_A, folder_id: hoisted.tables.folders.find((row) => row.title === "Biblioteca da instituição")?.id });
    expect(moved.payload).toMatchObject({ moved: true });
    expect(moved.payload.to).toMatchObject({ folder_title: "Biblioteca da instituição" });
  });

  it("keeps another account's content out of reach", async () => {
    const denied = await invoke("update_list", { list_id: LIST_B, title: "hack" });
    expect(denied.result.isError).toBe(true);
    expect(denied.payload.error.code).toBe("not_found");
    const foreign = await invoke("duplicate_list", { list_id: LIST_B });
    expect(foreign.payload.error.code).toBe("not_found");
  });
});

describe("GATE_DESTRUCTIVE through the authenticated tool boundary", () => {
  it("needs preview + token to delete a list and can restore it afterwards", async () => {
    const preview = await invoke("preview_delete_list", { list_id: LIST_A });
    expect(preview.payload).toMatchObject({ dry_run: true, card_count: 2 });

    const denied = await invoke("confirm_delete_list", { list_id: LIST_A });
    expect(denied.result.isError).toBe(true);
    expect(denied.payload.error.code).toBe("confirmation_required");

    const forged = await invoke("confirm_delete_list", {
      list_id: LIST_A,
      confirmation_token: "forjado.9999999999",
    });
    expect(forged.payload.error.code).toBe("confirmation_required");

    const confirmed = await invoke("confirm_delete_list", {
      list_id: LIST_A,
      confirmation_token: preview.payload.confirmation_token,
    });
    expect(confirmed.payload).toMatchObject({ deleted: true, cards_removed: 2 });
    expect(rpcCalls(hoisted.calls, "soft_delete_list")).toHaveLength(1);
    expect(rpcCalls(hoisted.calls, "soft_delete_list")[0]?.rpcParams.p_user_id).toBe(
      hoisted.tables.lists.find((row) => row.id === LIST_A)?.owner_id,
    );

    const hidden = await invoke("get_list", { list_id: LIST_A });
    expect(hidden.result.isError).toBe(true);
    expect(hidden.payload.error.code).toBe("not_found");

    const restored = await invoke("restore_from_trash", { target: "list", id: LIST_A });
    expect(restored.payload).toMatchObject({ restored: true });
    const visible = await invoke("get_list", { list_id: LIST_A });
    expect(visible.payload.ok).toBe(true);
  });

  it("requires dry_run before removing many cards and cascades to layers", async () => {
    const layer = await invoke("add_flashcards", {
      list_id: LIST_A,
      cards: [
        { term: "to work", translation: "trabalhar", parent_card_id: CARD_A_1 },
        { term: "to study", translation: "estudar", parent_card_id: CARD_A_2 },
      ],
    });
    expect(layer.payload.created).toBe(2);

    const small = await invoke("remove_flashcards", { list_id: LIST_A, card_ids: [CARD_A_1] });
    expect(small.payload).toMatchObject({ removed_cards: 1, removed_layers: 1, total_removed: 2 });

    const bulk = await invoke("add_flashcards", {
      list_id: LIST_A,
      cards: Array.from({ length: 30 }, (_, index) => ({ term: "bulk " + index, translation: "lote " + index })),
    });
    expect(bulk.payload.created).toBe(30);
    const bulkIds = (bulk.payload.cards as Array<{ id: string }>).map((card) => card.id);

    const denied = await invoke("remove_flashcards", { list_id: LIST_A, card_ids: bulkIds });
    expect(denied.result.isError).toBe(true);
    expect(denied.payload.error.code).toBe("confirmation_required");

    const preview = await invoke("remove_flashcards", { list_id: LIST_A, card_ids: bulkIds, dry_run: true });
    expect(preview.payload).toMatchObject({ requires_confirmation: true, cards_to_remove: 30 });

    const confirmed = await invoke("remove_flashcards", {
      list_id: LIST_A,
      card_ids: bulkIds,
      confirmation_token: preview.payload.confirmation_token,
    });
    expect(confirmed.payload).toMatchObject({ total_removed: 30 });
    const alive = await invoke("get_flashcards", { list_id: LIST_A });
    // CARD_A_2 and its own layer survive: only the 30 requested cards went out.
    expect(alive.payload.total_count).toBe(2);
  });
});
