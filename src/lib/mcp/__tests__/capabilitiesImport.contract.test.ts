import { describe, expect, it } from "vitest";
import { ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import mcp from "../index";

function toolNamed(name: string) {
  const tool = mcp.tools.find((candidate) => candidate.name === name);
  if (!tool) throw new Error("tool not registered: " + name);
  return tool;
}

function validSmartPackage() {
  return {
    schema: "app-piteco-super-import",
    version: "2.0",
    package: {
      name: "Lote de teste",
      folders: [{
        name: "Inglês",
        lists: [{
          name: "Trabalho",
          front_language: "en",
          back_language: "pt-BR",
          primary_side: "a",
          study_type: "language",
          glossary: [{ term: "work", translation: "trabalho", side: "A", active: true }],
          cards: [{
            type: "layered",
            group_title: "work",
            layers: [
              { front: "work", back: "trabalho", context_tag: "emprego", detailed_explanation: "Uso profissional" },
              { front: "work", back: "funcionar", context_tag: "máquina" },
            ],
          }],
        }],
      }],
    },
  };
}

describe("MCP capability and official importer surface", () => {
  it("publishes a read-only capability map and explicit preferred routes", () => {
    const tool = toolNamed("get_piteco_capabilities");
    expect(tool.annotations).toMatchObject({ readOnlyHint: true, idempotentHint: true, destructiveHint: false });
    expect(tool.description).toMatch(/capabil/i);
    expect(tool.description).toMatch(/importador oficial/i);
  });

  it("accepts the rich Smart Import 2.0 contract in preview and execution", () => {
    for (const name of ["preview_content_import", "execute_content_import"]) {
      const schema = z.object(toolNamed(name).inputSchema ?? {});
      const parsed = schema.safeParse({
        package: validSmartPackage(),
        destination: { folder: { reference_id: "F-K7M2Q9" }, list: { reference_id: "L-7M2Q9K" } },
        card_conflict: "skip",
        request_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        confirm: name === "execute_content_import",
      });
      expect(parsed.success, name).toBe(true);
    }
  });

  it("requires explicit confirmation for execute and offers dry-run for folder glossary", () => {
    const execute = z.object(toolNamed("execute_glossary_import").inputSchema ?? {});
    expect(execute.safeParse({
      folder: { reference_id: "F-K7M2Q9" },
      entries: [{ term: "work", translation: "trabalho" }],
      mode: "merge",
      confirm: false,
    }).success).toBe(false);
    expect(execute.safeParse({
      folder: { reference_id: "F-K7M2Q9" },
      entries: [{ term: "work", translation: "trabalho" }],
      mode: "merge",
      confirm: true,
    }).success).toBe(true);

    const preview = z.object(toolNamed("preview_glossary_import").inputSchema ?? {});
    expect(preview.safeParse({
      folder: { reference_id: "F-K7M2Q9" },
      entries: [{ term: "work", translation: "trabalho" }],
      mode: "replace",
    }).success).toBe(true);
  });

  it("keeps the new tools behind the authenticated boundary", async () => {
    const context = new ToolContext(undefined);
    for (const name of [
      "get_piteco_capabilities",
      "preview_content_import",
      "execute_content_import",
      "preview_glossary_import",
      "execute_glossary_import",
    ]) {
      const result = await toolNamed(name).handler({}, context);
      expect(result.isError, name).toBe(true);
      const text = result.content?.[0]?.type === "text" ? result.content[0].text : "";
      expect(text).toContain("unauthenticated");
    }
  });
});
