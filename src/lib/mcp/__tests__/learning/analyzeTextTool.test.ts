import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import type { FakeQueryCall } from "../fakeSupabase";

const hoisted = vi.hoisted(() => {
  const tables: Record<string, Record<string, unknown>[]> = {};
  const calls: FakeQueryCall[] = [];
  return { tables, calls };
});

vi.mock("@supabase/supabase-js", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const { createFakeClient } = await import("../fakeSupabase");
  return {
    ...actual,
    createClient: () => createFakeClient(hoisted.tables, {}, hoisted.calls),
  };
});

import analyzeTextTool from "../../tools/analyzeText";
import { invalidateVocabularyInventory } from "../../learning/inventory";
import { MAX_FILTER_IDS, MAX_TEXT_CHARS } from "../../learning/analyze";
import { FOLDER_A, LIST_A, USER_A, buildTables } from "../fixtures";

const TOKEN = "unit-test-bearer-secret";

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

type ToolArgs = Parameters<typeof analyzeTextTool.handler>[0];

function invoke(args: Record<string, unknown>, context: ToolContext) {
  return analyzeTextTool.handler(args as ToolArgs, context);
}

function contentOf(result: { content?: unknown }): Array<{ text?: string }> {
  return (result.content as Array<{ text?: string }> | undefined) ?? [];
}

function readPayload(result: { content?: unknown }): Record<string, unknown> {
  return JSON.parse(String(contentOf(result)[0]?.text ?? "{}"));
}

beforeEach(() => {
  for (const key of Object.keys(hoisted.tables)) delete hoisted.tables[key];
  Object.assign(hoisted.tables, buildTables());
  hoisted.calls.length = 0;
  invalidateVocabularyInventory();
});

describe("tool analyze_text_against_library", () => {
  it("declara a superficie esperada (nome, descricao, read-only)", () => {
    expect(analyzeTextTool.name).toBe("analyze_text_against_library");
    expect(analyzeTextTool.description.length).toBeGreaterThan(400);
    expect(analyzeTextTool.description).toMatch(/never creates, edits or deletes/i);
    expect(analyzeTextTool.description).toMatch(/look after/i);
    expect(analyzeTextTool.annotations?.readOnlyHint).toBe(true);
    expect(analyzeTextTool.annotations?.idempotentHint).toBe(true);
    expect(analyzeTextTool.annotations?.destructiveHint).toBeUndefined();
  });

  it("valida entrada e nunca aceita campo de identidade", () => {
    const schema = z.object(analyzeTextTool.inputSchema ?? {});
    expect(schema.safeParse({ text: "hello world" }).success).toBe(true);
    expect(schema.safeParse({ text: "" }).success).toBe(false);
    expect(schema.safeParse({ text: "x".repeat(MAX_TEXT_CHARS + 1) }).success).toBe(false);
    expect(schema.safeParse({ text: "hello", language: "de" }).success).toBe(false);
    expect(schema.safeParse({ text: "hello", folder_ids: ["not-a-uuid"] }).success).toBe(false);
    expect(
      schema.safeParse({ text: "hello", list_ids: Array.from({ length: MAX_FILTER_IDS + 1 }, () => LIST_A) })
        .success,
    ).toBe(false);

    const parsed = schema.parse({ text: "hello", user_id: USER_A, owner_id: USER_A });
    expect("user_id" in parsed).toBe(false);
    expect("owner_id" in parsed).toBe(false);
  });

  it("responde erro controlado sem autenticacao", async () => {
    const result = await invoke({ text: "The warehouse is open." }, new ToolContext(undefined));
    expect(result.isError).toBe(true);
    const payload = readPayload(result);
    expect(payload.ok).toBe(false);
    expect((payload.error as { code: string }).code).toBe("unauthenticated");
  });

  it("exige institution_id quando o escopo e institucional", async () => {
    const result = await invoke(
      { text: "The warehouse is open.", scope: { kind: "institution" } },
      authenticatedContext(),
    );
    expect(result.isError).toBe(true);
    const payload = readPayload(result);
    expect((payload.error as { code: string }).code).toBe("invalid_input");
  });

  it("recusa texto vazio de verdade (apenas espacos)", async () => {
    const result = await invoke({ text: "   " }, authenticatedContext());
    expect(result.isError).toBe(true);
    expect((readPayload(result).error as { code: string }).code).toBe("invalid_input");
  });

  it("analisa contra a biblioteca real do token e devolve as seis chaves do contrato", async () => {
    const result = await invoke(
      { text: "The warehouse is open and the study is done." },
      authenticatedContext(),
    );
    const text = JSON.stringify(result.content ?? []);
    expect(text).not.toContain(TOKEN);
    const payload = readPayload(result);

    expect(payload.ok).toBe(true);
    expect(payload.analyzed_language).toBe("en");
    for (const key of ["candidates", "already_known", "new_vocabulary", "ambiguous", "summary"]) {
      expect(payload[key], key).toBeDefined();
    }

    const known = (payload.already_known as Array<{ text: string; status: string }>).map((item) =>
      item.text.toLowerCase(),
    );
    expect(known).toContain("warehouse");
    expect(known).toContain("study");
    const created = (payload.new_vocabulary as Array<{ text: string }>).map((item) => item.text.toLowerCase());
    expect(created).toContain("open");
    expect(created).not.toContain("warehouse");

    const summary = payload.summary as { library: { cards_scanned: number; lists: number; queries: number } };
    expect(summary.library.lists).toBe(2);
    expect(summary.library.cards_scanned).toBeGreaterThanOrEqual(3);
    expect(summary.library.queries).toBeLessThanOrEqual(4);
  });

  it("respeita folder_ids e list_ids sem ampliar o escopo", async () => {
    const result = await invoke(
      { text: "The warehouse is open.", folder_ids: [FOLDER_A] },
      authenticatedContext(),
    );
    const payload = readPayload(result);
    expect(payload.ok).toBe(true);
    expect((payload.summary as { library: { folders: string[] } }).library.folders).toEqual([FOLDER_A]);

    const restrito = await invoke(
      { text: "The warehouse is open.", list_ids: [LIST_A] },
      authenticatedContext(),
    );
    const restrictedPayload = readPayload(restrito);
    expect(restrictedPayload.ok).toBe(true);
    const known = (restrictedPayload.already_known as Array<{ text: string }>).map((item) =>
      item.text.toLowerCase(),
    );
    // "warehouse" vive na segunda lista: fora do filtro, nao pode aparecer como conhecido.
    expect(known).not.toContain("warehouse");
    expect(
      (restrictedPayload.new_vocabulary as Array<{ text: string }>).map((item) => item.text.toLowerCase()),
    ).toContain("warehouse");
  });
});
