import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { createUserScopedDb } from "../domain/client";
import { toolErrorResult, toolSuccess } from "../domain/errors";
import { moveList } from "../domain/listWrites";
import { folderIdentifierSchema, listIdentifierSchema } from "./identifierSchemas";

export default defineTool({
  name: "move_list",
  title: "Move list to another folder",
  description:
    "Moves an owned list to another owned folder - including a folder of another institution hub, when the user asked for that. " +
    "The list mirrors the destination folder's workspace, so list and folder never disagree about the scope. Idempotent: moving to the folder it already is in changes nothing.",
  inputSchema: {
    list_id: listIdentifierSchema.describe("List UUID or L-XXXXXX reference to move."),
    folder_id: folderIdentifierSchema.describe("Destination folder UUID or F-XXXXXX reference (owned by the same account)."),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: true },
  handler: async (args, ctx) => {
    try {
      const db = createUserScopedDb(ctx);
      const result = await moveList(db, { list_id: args.list_id, folder_id: args.folder_id });
      return toolSuccess(result);
    } catch (error) {
      return toolErrorResult(error, "move_list");
    }
  },
});
