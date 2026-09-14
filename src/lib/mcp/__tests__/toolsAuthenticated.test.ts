import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToolContext } from "@lovable.dev/mcp-js";
import type { FakeQueryCall } from "./fakeSupabase";

const hoisted = vi.hoisted(() => {
  const tables: Record<string, Record<string, unknown>[]> = {};
  const calls: FakeQueryCall[] = [];
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
  FOLDER_A,
  LIST_A,
  LIST_B,
  USER_A,
  buildTables,
  callsFor,
  filtersOf,
} from "./fixtures";

const TOKEN = "unit-test-bearer-secret";

function toolNamed(name: string) {
  const tool = mcp.tools.find((candidate) => candidate.name === name);
  if (!tool) throw new Error("tool not registered: " + name);
  return tool;
}

function authenticatedContext(userId: string = USER_A): ToolContext {
  return new ToolContext({
    type: "oauth",
    principal: {
      claims: { sub: userId, aud: "authenticated" },
      issuer: "https://ymahldldyxvwjeruaxpr.supabase.co/auth/v1",
      resource: "https://ymahldldyxvwjeruaxpr.supabase.co/functions/v1/mcp",
      acceptedAudiences: ["authenticated"],
      scopes: [],
      sub: userId,
    },
    bearer: { token: TOKEN },
  } as unknown as ConstructorParameters<typeof ToolContext>[0]);
}

function readText(result: { content?: Array<{ type: string; text?: string }> }): string {
  return String(result.content?.[0]?.text ?? "{}");
}

async function invoke(name: string, args: Record<string, unknown>) {
  const result = await toolNamed(name).handler(args, authenticatedContext());
  const text = readText(result);
  expect(text.includes(TOKEN), name).toBe(false);
  return { result, payload: JSON.parse(text) };
}

beforeEach(() => {
  for (const key of Object.keys(hoisted.tables)) delete hoisted.tables[key];
  Object.assign(hoisted.tables, buildTables());
  hoisted.calls.length = 0;
});

describe("MCP read tools through the authenticated tool boundary", () => {
  it("get_my_profile answers where the account can operate", async () => {
    const { payload } = await invoke("get_my_profile", {});
    expect(payload.ok).toBe(true);
    expect(payload.user_id).toBe(USER_A);
    expect(payload.profile).toMatchObject({ first_name: "Pedro", is_teacher: true, level: 7 });
    expect(payload.scopes).toHaveLength(2);
    expect(payload.scopes[0]).toEqual({ kind: "personal", role: "owner" });
    expect(payload.scopes[1]).toMatchObject({ kind: "institution", name: "Colégio Alfa" });
  });

  it("list_folders returns only account A content and applies the ownership filter", async () => {
    const { payload } = await invoke("list_folders", {});
    expect(payload.ok).toBe(true);
    expect(payload.scope).toBe("personal");
    expect(payload.items.map((item: { id: string }) => item.id)).toEqual([FOLDER_A]);
    expect(payload.items[0].list_count).toBe(1);
    expect(payload.total_count).toBe(1);
    const filters = filtersOf(callsFor(hoisted.calls, "folders")[0]);
    expect(filters).toContain("owner_id eq " + USER_A);
    expect(filters).toContain("system_kind eq user");
  });

  it("list_lists and get_list walk the discovery flow", async () => {
    const lists = await invoke("list_lists", {});
    expect(lists.payload.items.map((item: { id: string }) => item.id).sort()).toEqual([LIST_A, "aaaaaaaa-0001-4000-8000-000000000002"].sort());

    const detail = await invoke("get_list", { list_id: LIST_A });
    expect(detail.payload.list).toMatchObject({ id: LIST_A, title: "Phrasal Verbs" });
    expect(detail.payload.folder).toEqual({ id: FOLDER_A, title: "Inglês B1" });
    expect(detail.payload.card_count).toBe(2);
  });

  it("get_flashcards paginates and never dumps the deck", async () => {
    const { payload } = await invoke("get_flashcards", { list_id: LIST_A, limit: 1 });
    expect(payload.ok).toBe(true);
    expect(payload.items).toHaveLength(1);
    expect(payload.total_count).toBe(2);
    expect(payload.has_more).toBe(true);
  });

  it("search_my_content stays compact and scoped to the account", async () => {
    const { payload } = await invoke("search_my_content", { query: "warehouse", limit: 5 });
    expect(payload.ok).toBe(true);
    expect(payload.returned).toBe(1);
    expect(payload.items[0]).toMatchObject({ type: "flashcard", title: "warehouse" });
  });

  it("answers a foreign list with a controlled not_found instead of data", async () => {
    const { result, payload } = await invoke("get_list", { list_id: LIST_B });
    expect(result.isError).toBe(true);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("not_found");
  });
});
