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
import { LIST_B, TEST_BEARER, USER_A, authenticatedContext, buildTables } from "./fixtures";

function toolNamed(name: string) {
  const tool = mcp.tools.find((candidate) => candidate.name === name);
  if (!tool) throw new Error("tool not registered: " + name);
  return tool;
}

function readPayload(result: { content?: Array<{ type: string; text?: string }> }) {
  return JSON.parse(String(result.content?.[0]?.text ?? "{}"));
}

async function invoke(name: string, args: Record<string, unknown>) {
  const result = await toolNamed(name).handler(args, authenticatedContext());
  const block = result.content?.[0];
  const text = String(block?.type === "text" ? block.text : "{}");
  expect(text.includes(TEST_BEARER), name).toBe(false);
  return { result, payload: JSON.parse(text) };
}

beforeEach(() => {
  for (const key of Object.keys(hoisted.tables)) delete hoisted.tables[key];
  Object.assign(hoisted.tables, buildTables());
  hoisted.calls.length = 0;
});

describe("MCP phase 5 metadata and phase 6 high-level write", () => {
  it("publishes an explicit annotation contract and teaches the discovery flow", () => {
    expect(toolNamed("create_study_material")).toBeTruthy();
    expect(mcp.instructions).toMatch(/discover.*resolve.*name.*id.*act.*re-?confirm/i);
    expect(mcp.instructions).toMatch(/never.*memory/i);
    expect(mcp.instructions).toMatch(/paginated/i);

    for (const tool of mcp.tools.filter((candidate) => candidate.name !== "echo")) {
      expect(typeof tool.annotations?.readOnlyHint, tool.name).toBe("boolean");
      expect(typeof tool.annotations?.idempotentHint, tool.name).toBe("boolean");
      expect(typeof tool.annotations?.destructiveHint, tool.name).toBe("boolean");
      expect(typeof tool.annotations?.openWorldHint, tool.name).toBe("boolean");
      expect(tool.title.length, tool.name).toBeGreaterThan(3);
      expect(tool.description.length, tool.name).toBeGreaterThan(120);
    }
  });

  it("previews material creation without writing anything", async () => {
    const { payload } = await invoke("create_study_material", {
      scope: "personal",
      folder: { name: "Nova pasta" },
      list: { name: "Viagem" },
      cards: [
        { term: "ticket", translation: "passagem" },
        { term: "hotel", translation: "hotel" },
      ],
      dry_run: true,
    });

    expect(payload).toMatchObject({
      ok: true,
      dry_run: true,
      scope: "personal",
      will_create: { folder: true, list: true, cards: 2 },
    });
    expect(hoisted.calls.filter((call) => call.operation !== "select")).toHaveLength(0);
  });

  it("creates or reuses folder/list and inserts all cards in one batch", async () => {
    const first = await invoke("create_study_material", {
      scope: "personal",
      folder: { name: "Nova pasta" },
      list: { name: "Viagem" },
      cards: [
        { term: "ticket", translation: "passagem" },
        { term: "hotel", translation: "hotel" },
      ],
    });

    expect(first.payload.ok).toBe(true);
    expect(first.payload.created_folder_id).toBeTruthy();
    expect(first.payload.created_list_id).toBeTruthy();
    expect(first.payload.card_ids).toHaveLength(2);
    expect(first.payload.summary).toMatchObject({ cards_created: 2 });
    expect(hoisted.calls.filter((call) => call.operation === "insert" && call.table === "flashcards")).toHaveLength(1);

    const second = await invoke("create_study_material", {
      scope: "personal",
      folder: { name: "Nova pasta" },
      list: { name: "Viagem" },
      cards: [{ term: "ticket", translation: "passagem" }],
    });

    expect(second.payload.ok).toBe(true);
    expect(second.payload.created_folder_id).toBeNull();
    expect(second.payload.created_list_id).toBeNull();
    expect(second.payload.summary).toMatchObject({ cards_created: 0, cards_skipped: 1 });
  });

  it("returns actionable candidates when a name is ambiguous", async () => {
    const folders = hoisted.tables.folders;
    folders.push({
      ...(folders[0] ?? {}),
      id: "aaaaaaaa-0001-4000-8000-000000000099",
      title: "Inglês B1",
    });

    const { result, payload } = await invoke("create_study_material", {
      scope: "personal",
      folder: { name: "Inglês B1" },
      list: { name: "Viagem" },
      cards: [{ term: "ticket", translation: "passagem" }],
      dry_run: true,
    });

    expect(result.isError).toBe(true);
    expect(payload.error.code).toBe("ambiguous");
    expect(payload.error.hint).toMatch(/aaaaaaaa-0001-4000-8000-000000000099/);
    expect(payload.error.hint).toMatch(/Inglês B1/);
  });
});

describe("MCP phase 7 audit log", () => {
  it("emits one structured audit event for a successful write", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      await invoke("create_study_material", {
        scope: "personal",
        folder: { name: "Audit pasta" },
        list: { name: "Audit lista" },
        cards: [{ term: "audit", translation: "auditoria" }],
      });

      const event = log.mock.calls
        .map(([value]) => String(value))
        .map((value) => {
          try { return JSON.parse(value) as Record<string, unknown>; } catch { return null; }
        })
        .find((value) => value?.event === "mcp.audit");

      expect(event).toMatchObject({
        event: "mcp.audit",
        uid: USER_A,
        tool: "create_study_material",
        scope: "personal",
        result: "success",
      });
      expect(event?.target).toEqual(expect.objectContaining({ folder: expect.any(String), list: expect.any(String) }));
      expect(typeof event?.count).toBe("number");
      expect(typeof event?.duration_ms).toBe("number");
    } finally {
      log.mockRestore();
    }
  });

  it("does not leak a foreign target id in an audit event", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      const { result } = await invoke("update_list", { list_id: LIST_B, title: "não autorizado" });
      expect(result.isError).toBe(true);
      const lines = log.mock.calls.map(([value]) => String(value));
      const eventLine = lines.find((value) => value.includes('"event":"mcp.audit"'));
      expect(eventLine).toBeTruthy();
      expect(eventLine).not.toContain(LIST_B);
      const event = JSON.parse(String(eventLine)) as Record<string, unknown>;
      expect(event.target).toEqual(expect.objectContaining({ type: "list", reason: expect.any(String) }));
    } finally {
      log.mockRestore();
    }
  });
});
