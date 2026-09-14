import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { createUserScopedDb } from "../domain/client";
import { toolErrorResult, toolSuccess } from "../domain/errors";
import { LIST_DESCRIPTION_MAX, LIST_LABEL_MAX, LIST_TITLE_MAX, PRIMARY_SIDES, STUDY_TYPES, updateList } from "../domain/listWrites";

export default defineTool({
  name: "update_list",
  title: "Update list metadata and study settings",
  description:
    "Renames an owned list and/or changes its study settings (study_type, lang_a, lang_b, labels_a, labels_b, tts_enabled, primary_side). " +
    "Only the fields you send change; repeating the same call is safe (idempotent). Card content is not touched by this tool.",
  inputSchema: {
    list_id: z.string().uuid().describe("List uuid discovered with list_lists or get_list."),
    title: z.string().min(1).max(LIST_TITLE_MAX).optional().describe("New list title."),
    description: z.string().max(LIST_DESCRIPTION_MAX).nullable().optional().describe("New description; null clears it."),
    study_type: z.enum(STUDY_TYPES).optional().describe("language or general."),
    lang_a: z.string().max(10).optional().describe('Language of side A, e.g. "en".'),
    lang_b: z.string().max(10).optional().describe('Language of side B, e.g. "pt".'),
    labels_a: z.string().max(LIST_LABEL_MAX).optional().describe("Label for side A."),
    labels_b: z.string().max(LIST_LABEL_MAX).optional().describe("Label for side B."),
    tts_enabled: z.boolean().optional().describe("Whether study may speak the cards."),
    primary_side: z.enum(PRIMARY_SIDES).optional().describe('Which side is shown first: "a" or "b".'),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: true },
  handler: async (args, ctx) => {
    try {
      const db = createUserScopedDb(ctx);
      const result = await updateList(db, {
        list_id: args.list_id,
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
      return toolErrorResult(error, "update_list");
    }
  },
});
