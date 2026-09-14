import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { createToolIdentity } from "../domain/client";
import { toolErrorResult, toolSuccess } from "../domain/errors";
import { previewFolderDeletion } from "../domain/trash";

export default defineTool({
  name: "preview_delete_folder",
  title: "Preview deleting a folder",
  description:
    "Step 1 of deleting a folder: returns how many owned lists and cards would go to the trash, the cascading consequences (soft delete, 7-day retention, restore possible) " +
    "and a short-lived confirmation_token. Show this to the user before confirming. Read-only: it changes nothing.",
  inputSchema: {
    folder_id: z.string().uuid().describe("Folder uuid to be deleted."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (args, ctx) => {
    try {
      const identity = createToolIdentity(ctx);
      const result = await previewFolderDeletion(identity.db, { folder_id: args.folder_id }, identity.confirmationKey);
      return toolSuccess(result);
    } catch (error) {
      return toolErrorResult(error, "preview_delete_folder");
    }
  },
});
