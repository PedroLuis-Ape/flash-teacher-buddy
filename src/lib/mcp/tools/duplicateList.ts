import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { createUserScopedDb } from "../domain/client";
import { toolErrorResult, toolSuccess } from "../domain/errors";
import { duplicateList, LIST_TITLE_MAX, MAX_DUPLICATE_CARDS } from "../domain/listWrites";

export default defineTool({
  name: "duplicate_list",
  title: "Duplicate a list with its cards",
  description:
    "Copies an owned list (title, description and study settings) plus its active deck into the same folder or another owned folder. " +
    "Layer structure is rebuilt with new card ids and fresh status-group identity, so Favorite/Red List state is never inherited; deleted cards are not copied. " +
    "Cards are copied in batches (one insert per 200 cards, limit " + MAX_DUPLICATE_CARDS + "). If a batch fails, the partially copied list goes to the trash instead of staying as a half-copy. Not idempotent: each call creates a new list.",
  inputSchema: {
    list_id: z.string().uuid().describe("Source list uuid to copy."),
    title: z.string().min(1).max(LIST_TITLE_MAX).optional().describe('Title for the copy. Default: "<original> (cópia)".'),
    folder_id: z.string().uuid().optional().describe("Destination folder uuid. Default: the source list's own folder."),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: true },
  handler: async (args, ctx) => {
    try {
      const db = createUserScopedDb(ctx);
      const result = await duplicateList(db, {
        list_id: args.list_id,
        title: args.title,
        folder_id: args.folder_id,
      });
      return toolSuccess(result);
    } catch (error) {
      return toolErrorResult(error, "duplicate_list");
    }
  },
});
