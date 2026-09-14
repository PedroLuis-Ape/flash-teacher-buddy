import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { createUserScopedDb } from "../domain/client";
import { toolErrorResult, toolSuccess } from "../domain/errors";
import { createFolder, FOLDER_DESCRIPTION_MAX, FOLDER_TITLE_MAX, FOLDER_VISIBILITIES } from "../domain/folderWrites";

export default defineTool({
  name: "create_folder",
  title: "Create folder",
  description:
    "Creates a folder in the authenticated account's library (personal by default, or inside an institution hub the account owns). " +
    "The owner always comes from the verified token, so this tool cannot create content for anyone else. Creating twice creates two folders: this tool is NOT idempotent, so confirm the folder does not exist yet with list_folders.",
  inputSchema: {
    title: z.string().min(1).max(FOLDER_TITLE_MAX).describe("Folder title as the user said it."),
    description: z
      .string()
      .max(FOLDER_DESCRIPTION_MAX)
      .optional()
      .describe("Optional folder description; empty clears it."),
    visibility: z
      .enum(FOLDER_VISIBILITIES)
      .optional()
      .describe('private (default) or class. "class" is visible to the teacher portal rules, not to other accounts in general.'),
    institution_id: z
      .string()
      .uuid()
      .optional()
      .describe("Institution hub id (from get_my_profile scopes) to create the folder inside. Omit for the personal library."),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: true },
  handler: async (args, ctx) => {
    try {
      const db = createUserScopedDb(ctx);
      const result = await createFolder(db, {
        title: args.title,
        description: args.description,
        visibility: args.visibility,
        institution_id: args.institution_id,
      });
      return toolSuccess(result);
    } catch (error) {
      return toolErrorResult(error, "create_folder");
    }
  },
});
