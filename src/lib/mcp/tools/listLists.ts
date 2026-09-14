import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { createUserScopedDb } from "../domain/client";
import { toolErrorResult, toolSuccess } from "../domain/errors";
import { listLists } from "../domain/lists";
import { PERSONAL_SCOPE } from "../domain/scope";

export default defineTool({
  name: "list_lists",
  title: "List my lists",
  description:
    "Lists study lists of the authenticated account's personal library, newest activity first, optionally restricted to one folder. " +
    "Excludes trash, system collections (Reforço / Pontos de atenção) and classroom content. Paginated via limit/offset (returned/total_count/has_more). " +
    "Each item carries folder_id/folder_title so you can navigate without extra calls. Resolve folder_id with list_folders first; never invent ids.",
  inputSchema: {
    folder_id: z
      .string()
      .uuid()
      .optional()
      .describe("Restrict the result to this folder (uuid from list_folders)."),
    search: z
      .string()
      .min(1)
      .max(80)
      .optional()
      .describe("Optional plain-text filter over list title and description."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe("Lists per page. Default 20, hard cap 50."),
    offset: z.number().int().min(0).optional().describe("Pagination offset, default 0."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (args, ctx) => {
    try {
      const db = createUserScopedDb(ctx);
      const result = await listLists(db, {
        scope: PERSONAL_SCOPE,
        folderId: args.folder_id,
        search: args.search,
        limit: args.limit,
        offset: args.offset,
      });
      return toolSuccess(result as unknown as Record<string, unknown>);
    } catch (error) {
      return toolErrorResult(error, "list_lists");
    }
  },
});
