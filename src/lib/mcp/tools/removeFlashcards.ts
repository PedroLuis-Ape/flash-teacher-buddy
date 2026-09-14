import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { MAX_BATCH_CARDS, MAX_REMOVAL_WITHOUT_CONFIRMATION, removeCards } from "../domain/cardWrites";
import { createToolIdentity } from "../domain/client";
import { toolErrorResult, toolSuccess } from "../domain/errors";
import { listIdentifierSchema } from "./identifierSchemas";

export default defineTool({
  name: "remove_flashcards",
  title: "Remove flashcards (soft delete)",
  description:
    "Removes cards from an owned list. This is a SOFT delete: the card and its child layers receive deleted_at exactly like the app's own removal, stay " +
    "recoverable in the trash and are purged by the product after 7 days - this tool never hard deletes. " +
    "Removals of " + MAX_REMOVAL_WITHOUT_CONFIRMATION + " or more rows are material: they need the two-step flow, so call with dry_run=true first, show the " +
    "preview to the user and then repeat with the returned confirmation_token. Repeating a removal is safe (already removed cards are reported, not an error).",
  inputSchema: {
    list_id: listIdentifierSchema.describe("List UUID or L-XXXXXX that owns the cards."),
    card_ids: z
      .array(z.string().uuid())
      .min(1)
      .max(MAX_BATCH_CARDS)
      .describe("Cards to remove; their layers (cards with parent_card_id pointing at them) go too."),
    dry_run: z.boolean().optional().describe("true returns what would be removed plus the confirmation_token when confirmation is required."),
    confirmation_token: z.string().min(8).optional().describe("Token from the dry_run preview of this same removal."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (args, ctx) => {
    try {
      const identity = createToolIdentity(ctx);
      const result = await removeCards(
        identity.db,
        {
          list_id: args.list_id,
          card_ids: args.card_ids,
          dry_run: args.dry_run,
          confirmation_token: args.confirmation_token,
        },
        identity.confirmationKey,
      );
      return toolSuccess(result);
    } catch (error) {
      return toolErrorResult(error, "remove_flashcards");
    }
  },
});
