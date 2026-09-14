import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { addCards, CARD_CONTEXT_TAG_MAX, CARD_TEXT_MAX, MAX_BATCH_CARDS } from "../domain/cardWrites";
import { createUserScopedDb } from "../domain/client";
import { toolErrorResult, toolSuccess } from "../domain/errors";

const cardSchema = z.object({
  term: z.string().min(1).max(CARD_TEXT_MAX).describe("Front of the card (the term, word or question)."),
  translation: z.string().min(1).max(CARD_TEXT_MAX).describe("Back of the card (the translation or answer)."),
  hint: z.string().max(CARD_TEXT_MAX).optional().describe("Optional hint shown in study."),
  example_text: z.string().max(CARD_TEXT_MAX).optional().describe("Optional example sentence."),
  example_translation: z.string().max(CARD_TEXT_MAX).optional().describe("Optional translation of the example."),
  context_tag: z.string().max(CARD_CONTEXT_TAG_MAX).optional().describe("Optional short context label."),
  word_hints: z
    .union([z.array(z.unknown()), z.record(z.unknown())])
    .optional()
    .describe("Optional structured word hints (same JSON the app stores)."),
  image_url_a: z.string().max(CARD_TEXT_MAX).optional().describe("Optional image URL for side A."),
  image_url_b: z.string().max(CARD_TEXT_MAX).optional().describe("Optional image URL for side B."),
  layer_index: z.number().int().min(0).max(50).optional().describe("Optional layer position when building a layered card."),
  parent_card_id: z
    .string()
    .uuid()
    .optional()
    .describe("Optional parent card id (same list) to create this card as a layer."),
});

export default defineTool({
  name: "add_flashcards",
  title: "Add flashcards to a list (batch)",
  description:
    "Adds a batch of flashcards to an owned list in ONE request (multi-row insert), so 30 cards do not need 30 calls. " +
    "Default on_duplicate=skip makes retries safe: a card whose term+translation already exists in that list is reported in skipped_existing instead of being inserted again. " +
    "Use on_duplicate=insert only when the user explicitly wants repeated terms (same word, different meaning). Max " + MAX_BATCH_CARDS + " cards per call.",
  inputSchema: {
    list_id: z.string().uuid().describe("Destination list uuid (from list_lists or get_list)."),
    cards: z.array(cardSchema).min(1).max(MAX_BATCH_CARDS).describe("Cards to insert, in the order they should appear."),
    on_duplicate: z
      .enum(["skip", "insert"])
      .optional()
      .describe('skip (default) avoids duplicating the same term+translation in the list; insert forces the insert.'),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: true },
  handler: async (args, ctx) => {
    try {
      const db = createUserScopedDb(ctx);
      const result = await addCards(db, {
        list_id: args.list_id,
        cards: args.cards,
        on_duplicate: args.on_duplicate,
      });
      return toolSuccess(result);
    } catch (error) {
      return toolErrorResult(error, "add_flashcards");
    }
  },
});
