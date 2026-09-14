import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { createUserScopedDb } from "../domain/client";
import { toolErrorResult, toolSuccess } from "../domain/errors";
import { SEARCH_TYPES, searchMyContent } from "../domain/search";
import { PERSONAL_SCOPE } from "../domain/scope";
import { listIdentifierSchema } from "./identifierSchemas";

export default defineTool({
  name: "search_my_content",
  title: "Search my library",
  description:
    "Literal, case-insensitive search across the authenticated account's own content: folders, lists and flashcards (term, translation and example). " +
    "Results are compact and hard-capped by limit: the response reports per-type counts and truncated=true when more matched. " +
    "This is discovery, not linguistic analysis: it never decides whether a word is genuinely new vocabulary, and it never touches other accounts, classroom content or system collections. " +
    "When list_id is given, the search is confined to that list's cards.",
  inputSchema: {
    query: z
      .string()
      .min(1)
      .max(80)
      .describe("Plain-text term to look for (accents are significant). Wildcards are ignored."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(25)
      .describe("Required. Hard budget of returned items, 1-25. Use a small value first and narrow with types."),
    types: z
      .array(z.enum(SEARCH_TYPES))
      .optional()
      .describe('Restrict to any of "folders", "lists", "flashcards". Default: all three.'),
    list_id: z
      .string()
      .min(1)
      .refine((value) => listIdentifierSchema.safeParse(value).success, "Use um UUID ou uma referência L-XXXXXX.")
      .optional()
      .describe("Optional list UUID or L-XXXXXX reference to confine the search to one list's cards."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (args, ctx) => {
    try {
      const db = createUserScopedDb(ctx);
      const result = await searchMyContent(db, {
        scope: PERSONAL_SCOPE,
        query: args.query,
        limit: args.limit,
        types: args.types,
        listId: args.list_id,
      });
      return toolSuccess(result as unknown as Record<string, unknown>);
    } catch (error) {
      return toolErrorResult(error, "search_my_content");
    }
  },
});
