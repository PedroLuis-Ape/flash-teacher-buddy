import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { createUserScopedDb } from "../domain/client";
import { toolErrorResult, toolSuccess } from "../domain/errors";
import { getFlashcards } from "../domain/flashcards";
import { PERSONAL_SCOPE } from "../domain/scope";
import { listIdentifierSchema } from "./identifierSchemas";

export default defineTool({
  name: "get_flashcards",
  title: "Get flashcards of a list",
  description:
    "Returns one bounded page of flashcards of a list owned by the authenticated account, ordered like the study deck (created_at, id). " +
    "Responses are always paginated: read returned/total_count/has_more and continue with offset when the user really asked for more. " +
    "Never use this to dump a whole library into the conversation; for vocabulary analysis prefer search_my_content and narrow queries.",
  inputSchema: {
    list_id: listIdentifierSchema.describe("List UUID or L-XXXXXX reference discovered via list_lists or search_my_content."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Cards per page. Default 25, hard cap 100."),
    offset: z.number().int().min(0).optional().describe("Pagination offset, default 0."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (args, ctx) => {
    try {
      const db = createUserScopedDb(ctx);
      const result = await getFlashcards(db, {
        scope: PERSONAL_SCOPE,
        listId: args.list_id,
        limit: args.limit,
        offset: args.offset,
      });
      return toolSuccess(result as unknown as Record<string, unknown>);
    } catch (error) {
      return toolErrorResult(error, "get_flashcards");
    }
  },
});
