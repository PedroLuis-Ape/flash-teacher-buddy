import { describe, expect, it } from "vitest";
import { ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import mcp from "../index";
import { LIST_A, USER_A, USER_B } from "./fixtures";

const READ_TOOLS = [
  "get_my_profile",
  "list_folders",
  "list_lists",
  "get_list",
  "get_flashcards",
  "search_my_content",
];

function toolNamed(name: string) {
  const tool = mcp.tools.find((candidate) => candidate.name === name);
  if (!tool) throw new Error("tool not registered: " + name);
  return tool;
}

function readPayload(result: { content?: Array<{ type: string; text?: string }> }) {
  return JSON.parse(String(result.content?.[0]?.text ?? "{}"));
}

describe("MCP read-only tool surface", () => {
  it("registers the read tools next to echo and bumps the server version", () => {
    expect(mcp.tools.map((tool) => tool.name)).toEqual(["echo", ...READ_TOOLS]);
    expect(mcp.name).toBe("ape-piteco-mcp");
    expect(mcp.version).toBe("0.2.0");
    expect(mcp.instructions).toMatch(/read-only/i);
  });

  it("annotates every tool as read-only and idempotent", () => {
    for (const tool of mcp.tools) {
      expect(tool.annotations?.readOnlyHint, tool.name).toBe(true);
      expect(tool.annotations?.idempotentHint, tool.name).toBe(true);
      expect(tool.annotations?.destructiveHint, tool.name).toBeUndefined();
      expect(tool.description.length, tool.name).toBeGreaterThan(60);
    }
    for (const name of READ_TOOLS) {
      expect(toolNamed(name).description.length, name).toBeGreaterThan(200);
    }
  });

  it("never declares an identity field in any input schema", () => {
    const forbidden = ["user_id", "owner_id", "userId", "token", "access_token", "role"];
    for (const tool of mcp.tools) {
      const keys = Object.keys(tool.inputSchema ?? {});
      for (const key of forbidden) {
        expect(keys, tool.name).not.toContain(key);
      }
    }
  });

  it("rejects every read tool without authentication", async () => {
    const context = new ToolContext(undefined);
    for (const name of READ_TOOLS) {
      const result = await toolNamed(name).handler({}, context);
      expect(result.isError, name).toBe(true);
      const payload = readPayload(result);
      expect(payload.ok, name).toBe(false);
      expect(payload.error.code, name).toBe("unauthenticated");
      expect(payload.error.hint, name).toBeTruthy();
    }
  });

  it("validates ids and drops unknown fields at the schema boundary", () => {
    const schema = z.object(toolNamed("get_list").inputSchema ?? {});
    expect(schema.safeParse({ list_id: "not-a-uuid" }).success).toBe(false);
    expect(schema.safeParse({ list_id: LIST_A }).success).toBe(true);

    const parsed = schema.parse({ list_id: LIST_A, user_id: USER_B, owner_id: USER_B });
    expect("user_id" in parsed).toBe(false);
    expect("owner_id" in parsed).toBe(false);
    expect((parsed as { list_id: string }).list_id).toBe(LIST_A);
  });

  it("requires an explicit compact limit on search_my_content", () => {
    const schema = z.object(toolNamed("search_my_content").inputSchema ?? {});
    expect(schema.safeParse({ query: "work" }).success).toBe(false);
    expect(schema.safeParse({ query: "work", limit: 5 }).success).toBe(true);
    expect(schema.safeParse({ query: "work", limit: 500 }).success).toBe(false);
    expect(schema.safeParse({ query: "work", limit: 5, types: ["nope"] }).success).toBe(false);
  });

  it("caps pagination parameters in the published schemas", () => {
    const folders = z.object(toolNamed("list_folders").inputSchema ?? {});
    expect(folders.safeParse({ limit: 51 }).success).toBe(false);
    expect(folders.safeParse({ limit: 50 }).success).toBe(true);
    const cards = z.object(toolNamed("get_flashcards").inputSchema ?? {});
    expect(cards.safeParse({ list_id: LIST_A, limit: 101 }).success).toBe(false);
    expect(cards.safeParse({ list_id: LIST_A, limit: 100 }).success).toBe(true);
  });

  it("documents the discovery flow in the server instructions", () => {
    expect(USER_A).not.toBe(USER_B);
    expect(mcp.instructions).toMatch(/get_my_profile/);
    expect(mcp.instructions).toMatch(/never reuse an id/i);
  });
});
