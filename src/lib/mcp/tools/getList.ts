import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { createUserScopedDb } from "../domain/client";
import { toolErrorResult, toolSuccess } from "../domain/errors";
import { getList } from "../domain/lists";
import { PERSONAL_SCOPE } from "../domain/scope";
import { listIdentifierSchema } from "./identifierSchemas";

export default defineTool({
  name: "get_list",
  title: "Get one list",
  description:
    "Returns one list of the authenticated account: metadata, owning folder, and the exact card_count. " +
    "Cards are returned only when include_cards is true, and then as one bounded page (cards_limit, cards_offset). " +
    "Calling it with an id that is not in this account returns a controlled not_found — do not retry the same id, resolve it with list_lists or search_my_content instead.",
  inputSchema: {
    list_id: listIdentifierSchema.describe("List UUID or L-XXXXXX reference, discovered via list_lists or search_my_content."),
    include_cards: z
      .boolean()
      .optional()
      .describe("When true, also returns a page of cards. Default false keeps the response small."),
    cards_limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Cards per page when include_cards is true. Default 25, hard cap 100."),
    cards_offset: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Card pagination offset when include_cards is true. Default 0."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (args, ctx) => {
    try {
      const db = createUserScopedDb(ctx);
      const result = await getList(db, {
        scope: PERSONAL_SCOPE,
        listId: args.list_id,
        includeCards: args.include_cards,
        cardsLimit: args.cards_limit,
        cardsOffset: args.cards_offset,
      });
      return toolSuccess(result);
    } catch (error) {
      return toolErrorResult(error, "get_list");
    }
  },
});
