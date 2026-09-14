import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { createUserScopedDb } from "../domain/client";
import { toolErrorResult, toolSuccess } from "../domain/errors";
import { restoreFromTrash, TRASH_TARGETS } from "../domain/trash";

export default defineTool({
  name: "restore_from_trash",
  title: "Restore a list or folder from the trash",
  description:
    "Undoes a soft delete using the product's own restore RPC: restores the list (and its cards, plus the parent folder when needed) or the folder (with its lists and cards). " +
    "Only objects of the authenticated account can be restored. If the object is already active, returns already_active instead of failing.",
  inputSchema: {
    target: z.enum(TRASH_TARGETS).describe('"list" or "folder".'),
    id: z.string().uuid().describe("Uuid of the trashed list or folder."),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: true },
  handler: async (args, ctx) => {
    try {
      const db = createUserScopedDb(ctx);
      const result = await restoreFromTrash(db, { target: args.target, id: args.id });
      return toolSuccess(result);
    } catch (error) {
      return toolErrorResult(error, "restore_from_trash");
    }
  },
});
