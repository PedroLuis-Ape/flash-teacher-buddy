import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { createUserScopedDb } from "../domain/client";
import { toolErrorResult, toolSuccess } from "../domain/errors";
import { FOLDER_DESCRIPTION_MAX, FOLDER_TITLE_MAX, FOLDER_VISIBILITIES, updateFolder } from "../domain/folderWrites";
import { folderIdentifierSchema } from "./identifierSchemas";

export default defineTool({
  name: "update_folder",
  title: "Update or move folder",
  description:
    "Updates an owned folder: title, description, visibility and/or the institution hub it belongs to. " +
    "Send institution_id with a hub id to move the folder into that institution, or null to return it to the personal library. " +
    "Only the fields you send change; repeating the same call is safe (idempotent).",
  inputSchema: {
    folder_id: folderIdentifierSchema.describe("Folder UUID or F-XXXXXX reference discovered with list_folders."),
    title: z.string().min(1).max(FOLDER_TITLE_MAX).optional().describe("New folder title."),
    description: z.string().max(FOLDER_DESCRIPTION_MAX).nullable().optional().describe("New description; null clears it."),
    visibility: z.enum(FOLDER_VISIBILITIES).optional().describe("private or class."),
    institution_id: z
      .string()
      .uuid()
      .nullable()
      .optional()
      .describe("Institution hub id to move the folder into, or null to move it back to the personal library. Omit to leave it where it is."),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: true },
  handler: async (args, ctx) => {
    try {
      const db = createUserScopedDb(ctx);
      const result = await updateFolder(db, {
        folder_id: args.folder_id,
        title: args.title,
        description: args.description,
        visibility: args.visibility,
        institution_id: args.institution_id,
      });
      return toolSuccess(result);
    } catch (error) {
      return toolErrorResult(error, "update_folder");
    }
  },
});
