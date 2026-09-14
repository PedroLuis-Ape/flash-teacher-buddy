import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { createToolIdentity } from "../domain/client";
import { toolErrorResult, toolSuccess } from "../domain/errors";
import { folderIdentifierSchema } from "./identifierSchemas";
import { confirmFolderDeletion } from "../domain/trash";

export default defineTool({
  name: "confirm_delete_folder",
  title: "Confirm deletion of a folder",
  description:
    "Step 2 of deleting a folder: requires the confirmation_token from preview_delete_folder for this same folder. " +
    "The token is bound to the authenticated account and to the list count the preview showed, so a changed folder or a stale/expired token fails safely. " +
    "Deletion is a soft delete through the product's own trash RPC (folder + its lists + their cards, never hard delete).",
  inputSchema: {
    folder_id: folderIdentifierSchema.describe("Same folder UUID or F-XXXXXX used in the preview."),
    confirmation_token: z.string().min(8).describe("Token returned by preview_delete_folder."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (args, ctx) => {
    try {
      const identity = createToolIdentity(ctx);
      const result = await confirmFolderDeletion(
        identity.db,
        { folder_id: args.folder_id, confirmation_token: args.confirmation_token },
        identity.confirmationKey,
      );
      return toolSuccess(result);
    } catch (error) {
      return toolErrorResult(error, "confirm_delete_folder");
    }
  },
});
