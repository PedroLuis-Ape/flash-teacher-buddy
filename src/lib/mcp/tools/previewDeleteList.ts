import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { createToolIdentity } from "../domain/client";
import { toolErrorResult, toolSuccess } from "../domain/errors";
import { previewListDeletion } from "../domain/trash";

export default defineTool({
  name: "preview_delete_list",
  title: "Preview deleting a list",
  description:
    "Step 1 of deleting a list: returns the target, how many cards would go to the trash, the real consequences (soft delete, 7-day retention, restore possible) " +
    "and a short-lived confirmation_token. Show this to the user before confirming. Read-only: it changes nothing.",
  inputSchema: {
    list_id: z.string().uuid().describe("List uuid to be deleted."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (args, ctx) => {
    try {
      const identity = createToolIdentity(ctx);
      const result = await previewListDeletion(identity.db, { list_id: args.list_id }, identity.confirmationKey);
      return toolSuccess(result);
    } catch (error) {
      return toolErrorResult(error, "preview_delete_list");
    }
  },
});
