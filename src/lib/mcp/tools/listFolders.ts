import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { createUserScopedDb } from "../domain/client";
import { toolErrorResult, toolSuccess } from "../domain/errors";
import { listFolders } from "../domain/folders";
import { PERSONAL_SCOPE } from "../domain/scope";

export default defineTool({
  name: "list_folders",
  title: "List my folders",
  description:
    "Lists folders of the authenticated account's personal library (newest activity first), with the number of user lists inside each folder. " +
    "Excludes trash, system collections (Reforço / Pontos de atenção) and classroom content. Paginated: use limit/offset and read returned/total_count/has_more. " +
    "Use this to resolve a folder name spoken by the user into a folder_id; never invent or reuse ids from memory.",
  inputSchema: {
    search: z
      .string()
      .min(1)
      .max(80)
      .optional()
      .describe("Optional plain-text filter over folder title and description. Wildcards are ignored."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe("Folders per page. Default 20, hard cap 50."),
    offset: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Pagination offset, default 0. Combine with has_more/total_count."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (args, ctx) => {
    try {
      const db = createUserScopedDb(ctx);
      const result = await listFolders(db, {
        scope: PERSONAL_SCOPE,
        search: args.search,
        limit: args.limit,
        offset: args.offset,
      });
      return toolSuccess(result as unknown as Record<string, unknown>);
    } catch (error) {
      return toolErrorResult(error, "list_folders");
    }
  },
});
