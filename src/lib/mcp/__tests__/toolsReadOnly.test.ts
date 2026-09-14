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
  "analyze_text_against_library",
];

const WRITE_TOOLS = [
  "create_folder",
  "update_folder",
  "create_list",
  "update_list",
  "move_list",
  "reorder_lists",
  "duplicate_list",
  "add_flashcards",
  "update_flashcards",
  "remove_flashcards",
  "preview_delete_list",
  "confirm_delete_list",
  "preview_delete_folder",
  "confirm_delete_folder",
  "restore_from_trash",
  "create_study_material",
];

const AUTHENTICATED_TOOLS = [...READ_TOOLS, ...WRITE_TOOLS];
/** Previews read the library and mint a token, but change nothing. */
const READ_ONLY_TOOLS = [...READ_TOOLS, "preview_delete_list", "preview_delete_folder"];
const DESTRUCTIVE_TOOLS = ["remove_flashcards", "confirm_delete_list", "confirm_delete_folder"];

function toolNamed(name: string) {
  const tool = mcp.tools.find((candidate) => candidate.name === name);
  if (!tool) throw new Error("tool not registered: " + name);
  return tool;
}

function readPayload(result: { content?: Array<{ type: string; text?: string }> }) {
  return JSON.parse(String(result.content?.[0]?.text ?? "{}"));
}

function readText(result: { content?: Array<{ type: string; text?: string }> }): string {
  return String(result.content?.[0]?.text ?? "");
}

describe("MCP tool surface", () => {
  it("registers the read tools and the phase 3/4 write tools", () => {
    expect(mcp.tools.map((tool) => tool.name)).toEqual(["echo", ...READ_TOOLS, ...WRITE_TOOLS]);
    expect(mcp.name).toBe("ape-piteco-mcp");
    expect(mcp.version).toBe("0.3.0");
    expect(mcp.instructions).toMatch(/preview_delete_list/);
    expect(mcp.instructions).toMatch(/restore_from_trash/);
    expect(mcp.instructions).toMatch(/batches/i);
  });

  it("marks previews and reads as read-only and removals as destructive", () => {
    for (const name of READ_ONLY_TOOLS) {
      const tool = toolNamed(name);
      expect(tool.annotations?.readOnlyHint, name).toBe(true);
      expect(tool.annotations?.idempotentHint, name).toBe(true);
      expect(tool.annotations?.destructiveHint, name).toBe(false);
    }
    for (const name of DESTRUCTIVE_TOOLS) {
      const tool = toolNamed(name);
      expect(tool.annotations?.readOnlyHint, name).toBe(false);
      expect(tool.annotations?.destructiveHint, name).toBe(true);
      expect(tool.annotations?.idempotentHint, name).toBe(true);
    }
    for (const name of WRITE_TOOLS.filter(
      (tool) => !DESTRUCTIVE_TOOLS.includes(tool) && !READ_ONLY_TOOLS.includes(tool),
    )) {
      const tool = toolNamed(name);
      expect(tool.annotations?.readOnlyHint, name).toBe(false);
      expect(tool.annotations?.destructiveHint, name).toBe(false);
      expect(typeof tool.annotations?.idempotentHint, name).toBe("boolean");
      expect(tool.annotations?.openWorldHint, name).toBe(true);
    }
  });

  it("documents every tool well enough for an agent to choose it", () => {
    for (const tool of mcp.tools) {
      expect(tool.title.length, tool.name).toBeGreaterThan(3);
      expect(tool.description.length, tool.name).toBeGreaterThan(60);
    }
    for (const name of [...READ_TOOLS, ...DESTRUCTIVE_TOOLS]) {
      expect(toolNamed(name).description.length, name).toBeGreaterThan(200);
    }
  });

  it("never declares an identity field in any input schema", () => {
    const forbidden = ["user_id", "owner_id", "userId", "token", "access_token", "role", "service_role"];
    for (const tool of mcp.tools) {
      const keys = Object.keys(tool.inputSchema ?? {});
      for (const key of forbidden) {
        expect(keys, tool.name).not.toContain(key);
      }
    }
  });

  it("rejects every authenticated tool without authentication", async () => {
    const context = new ToolContext(undefined);
    for (const name of AUTHENTICATED_TOOLS) {
      const result = await toolNamed(name).handler({}, context);
      expect(result.isError, name).toBe(true);
      const payload = readPayload(result);
      expect(payload.ok, name).toBe(false);
      expect(payload.error.code, name).toBe("unauthenticated");
      expect(payload.error.hint, name).toBeTruthy();
    }
  });

  it("keeps echo as the only unauthenticated tool", async () => {
    const result = await toolNamed("echo").handler({ text: "pong" }, new ToolContext(undefined));
    expect(result.isError).toBeUndefined();
    expect(readText(result)).toBe("pong");
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

  it("caps pagination and batch sizes in the published schemas", () => {
    const folders = z.object(toolNamed("list_folders").inputSchema ?? {});
    expect(folders.safeParse({ limit: 51 }).success).toBe(false);
    expect(folders.safeParse({ limit: 50 }).success).toBe(true);

    const cards = z.object(toolNamed("get_flashcards").inputSchema ?? {});
    expect(cards.safeParse({ list_id: LIST_A, limit: 101 }).success).toBe(false);
    expect(cards.safeParse({ list_id: LIST_A, limit: 100 }).success).toBe(true);

    const add = z.object(toolNamed("add_flashcards").inputSchema ?? {});
    expect(add.safeParse({ list_id: LIST_A, cards: [] }).success).toBe(false);
    expect(add.safeParse({ list_id: LIST_A, cards: Array.from({ length: 201 }, () => ({ term: "a", translation: "b" })) }).success).toBe(false);
    expect(add.safeParse({ list_id: LIST_A, cards: [{ term: "a", translation: "b" }] }).success).toBe(true);
  });

  it("requires a confirmation token shape on the destructive confirmations", () => {
    const confirmList = z.object(toolNamed("confirm_delete_list").inputSchema ?? {});
    expect(confirmList.safeParse({ list_id: LIST_A }).success).toBe(false);
    expect(confirmList.safeParse({ list_id: LIST_A, confirmation_token: "curto" }).success).toBe(false);
    expect(confirmList.safeParse({ list_id: LIST_A, confirmation_token: "abcdefgh.1234567890" }).success).toBe(true);

    const previewFolder = z.object(toolNamed("preview_delete_folder").inputSchema ?? {});
    expect(previewFolder.safeParse({ folder_id: "nope" }).success).toBe(false);
    expect(previewFolder.safeParse({ folder_id: USER_A }).success).toBe(true);

    const restore = z.object(toolNamed("restore_from_trash").inputSchema ?? {});
    expect(restore.safeParse({ target: "card", id: LIST_A }).success).toBe(false);
    expect(restore.safeParse({ target: "list", id: LIST_A }).success).toBe(true);

    const remove = z.object(toolNamed("remove_flashcards").inputSchema ?? {});
    expect(remove.safeParse({ list_id: LIST_A, card_ids: [] }).success).toBe(false);
    expect(remove.safeParse({ list_id: LIST_A, card_ids: [LIST_A], dry_run: true }).success).toBe(true);
  });
});
