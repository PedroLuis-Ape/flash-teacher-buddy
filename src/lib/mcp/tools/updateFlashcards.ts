import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { CARD_CONTEXT_TAG_MAX, CARD_TEXT_MAX, MAX_BATCH_CARDS, updateCards } from "../domain/cardWrites";
import { createUserScopedDb } from "../domain/client";
import { toolErrorResult, toolSuccess } from "../domain/errors";

const patchSchema = z.object({
  term: z.string().min(1).max(CARD_TEXT_MAX).optional().describe("New front text."),
  translation: z.string().min(1).max(CARD_TEXT_MAX).optional().describe("New back text."),
  hint: z.string().max(CARD_TEXT_MAX).nullable().optional().describe("New hint; null clears it."),
  example_text: z.string().max(CARD_TEXT_MAX).nullable().optional().describe("New example sentence; null clears it."),
  example_translation: z.string().max(CARD_TEXT_MAX).nullable().optional().describe("New example translation; null clears it."),
  context_tag: z.string().max(CARD_CONTEXT_TAG_MAX).nullable().optional().describe("New context label; null clears it."),
  word_hints: z
    .union([z.array(z.unknown()), z.record(z.unknown()), z.null()])
    .optional()
    .describe("New structured word hints; null clears them."),
  image_url_a: z.string().max(CARD_TEXT_MAX).nullable().optional().describe("New image URL for side A; null clears it."),
  image_url_b: z.string().max(CARD_TEXT_MAX).nullable().optional().describe("New image URL for side B; null clears it."),
  layer_index: z.number().int().min(0).max(50).nullable().optional().describe("New layer position."),
});

export default defineTool({
  name: "update_flashcards",
  title: "Edit flashcards in batch",
  description:
    "Edits existing cards of an owned list. Two shapes: card_ids + set applies the SAME values to many cards in one UPDATE (e.g. give every card a context tag), " +
    "while updates applies DIFFERENT values per card (one update per card, run concurrently). " +
    "Cards that are not found (other list, other account, already deleted) are reported in not_found instead of failing the whole batch. " +
    "term/translation/hint/example/context/word_hints/images/layer_index are editable; structural identity (list, owner, parent) is not. Max " + MAX_BATCH_CARDS + " cards per call.",
  inputSchema: {
    list_id: z.string().uuid().describe("List that owns the cards."),
    card_ids: z.array(z.string().uuid()).min(1).max(MAX_BATCH_CARDS).optional().describe("Cards that receive the same values (use together with set)."),
    set: patchSchema.optional().describe("Values applied to every card in card_ids."),
    updates: z
      .array(patchSchema.extend({ card_id: z.string().uuid() }))
      .min(1)
      .max(MAX_BATCH_CARDS)
      .optional()
      .describe("Per-card values: each item needs card_id plus the fields to change."),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: true },
  handler: async (args, ctx) => {
    try {
      const db = createUserScopedDb(ctx);
      const result = await updateCards(db, {
        list_id: args.list_id,
        card_ids: args.card_ids,
        set: args.set,
        updates: args.updates,
      });
      return toolSuccess(result);
    } catch (error) {
      return toolErrorResult(error, "update_flashcards");
    }
  },
});
