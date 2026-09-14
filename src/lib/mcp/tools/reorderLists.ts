import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { createUserScopedDb } from "../domain/client";
import { toolErrorResult, toolSuccess } from "../domain/errors";
import { MAX_REORDER_LISTS, reorderLists } from "../domain/listWrites";
import { folderIdentifierSchema, listIdentifierSchema } from "./identifierSchemas";

export default defineTool({
  name: "reorder_lists",
  title: "Reorder lists inside a folder",
  description:
    "Sets the display order of lists inside one owned folder: the array order you send becomes the folder order (first item is 0). " +
    "Send every list you want positioned; lists not sent keep their current order_index. Idempotent: sending the same order twice changes nothing.",
  inputSchema: {
    folder_id: folderIdentifierSchema.describe("Folder UUID or F-XXXXXX whose lists are being ordered."),
    list_ids: z
      .array(listIdentifierSchema)
      .min(1)
      .max(MAX_REORDER_LISTS)
      .describe("List UUIDs or L-XXXXXX references in the exact desired order (first = position 0)."),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: true },
  handler: async (args, ctx) => {
    try {
      const db = createUserScopedDb(ctx);
      const result = await reorderLists(db, { folder_id: args.folder_id, list_ids: args.list_ids });
      return toolSuccess(result);
    } catch (error) {
      return toolErrorResult(error, "reorder_lists");
    }
  },
});
