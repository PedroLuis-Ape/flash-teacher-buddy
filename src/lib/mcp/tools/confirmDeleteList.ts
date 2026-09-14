import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { createToolIdentity } from "../domain/client";
import { toolErrorResult, toolSuccess } from "../domain/errors";
import { confirmListDeletion } from "../domain/trash";

export default defineTool({
  name: "confirm_delete_list",
  title: "Confirm deletion of a list",
  description:
    "Step 2 of deleting a list: requires the confirmation_token from preview_delete_list for this same list. " +
    "The token is bound to the authenticated account and to the card count the preview showed, so a changed list or a stale/expired token fails safely and asks for a new preview. " +
    "The deletion is a soft delete through the product's own trash RPC; deleting an already deleted list returns already_deleted instead of an error.",
  inputSchema: {
    list_id: z.string().uuid().describe("Same list uuid used in the preview."),
    confirmation_token: z.string().min(8).describe("Token returned by preview_delete_list."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (args, ctx) => {
    try {
      const identity = createToolIdentity(ctx);
      const result = await confirmListDeletion(
        identity.db,
        { list_id: args.list_id, confirmation_token: args.confirmation_token },
        identity.confirmationKey,
      );
      return toolSuccess(result);
    } catch (error) {
      return toolErrorResult(error, "confirm_delete_list");
    }
  },
});
