import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { createUserScopedDb } from "../domain/client";
import { toolErrorResult, toolSuccess } from "../domain/errors";
import { createList, LIST_DESCRIPTION_MAX, LIST_LABEL_MAX, LIST_TITLE_MAX, PRIMARY_SIDES, STUDY_TYPES } from "../domain/listWrites";
import { folderIdentifierSchema } from "./identifierSchemas";

export default defineTool({
  name: "create_list",
  title: "Create list inside a folder",
  description:
    "Creates a study list inside an owned folder (the folder defines the workspace: personal or institution). " +
    "Study settings default to the product's language mode (en/pt, TTS on, side A primary). " +
    "Not idempotent: resolve the folder first with list_folders and check the list does not already exist.",
  inputSchema: {
    folder_id: folderIdentifierSchema.describe("Destination folder UUID or F-XXXXXX reference (from list_folders)."),
    title: z.string().min(1).max(LIST_TITLE_MAX).describe("List title as the user said it."),
    description: z.string().max(LIST_DESCRIPTION_MAX).optional().describe("Optional description."),
    study_type: z.enum(STUDY_TYPES).optional().describe('language (default) or general. The database CHECK rejects anything else.'),
    lang_a: z.string().max(10).optional().describe('Language of side A, e.g. "en". Default en.'),
    lang_b: z.string().max(10).optional().describe('Language of side B, e.g. "pt". Default pt.'),
    labels_a: z.string().max(LIST_LABEL_MAX).optional().describe("Label shown for side A."),
    labels_b: z.string().max(LIST_LABEL_MAX).optional().describe("Label shown for side B."),
    tts_enabled: z.boolean().optional().describe("Whether study may speak the cards."),
    primary_side: z.enum(PRIMARY_SIDES).optional().describe('Which side is shown first: "a" (default) or "b".'),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: true },
  handler: async (args, ctx) => {
    try {
      const db = createUserScopedDb(ctx);
      const result = await createList(db, {
        folder_id: args.folder_id,
        title: args.title,
        description: args.description,
        study_type: args.study_type,
        lang_a: args.lang_a,
        lang_b: args.lang_b,
        labels_a: args.labels_a,
        labels_b: args.labels_b,
        tts_enabled: args.tts_enabled,
        primary_side: args.primary_side,
      });
      return toolSuccess(result);
    } catch (error) {
      return toolErrorResult(error, "create_list");
    }
  },
});
