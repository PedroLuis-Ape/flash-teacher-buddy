import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { createUserScopedDb } from "../domain/client";
import { toolErrorResult, toolSuccess } from "../domain/errors";
import { MAX_BATCH_CARDS, CARD_CONTEXT_TAG_MAX, CARD_TEXT_MAX } from "../domain/cardWrites";
import { createStudyMaterial } from "../domain/studyMaterialWrites";

const selectorSchema = z
  .object({
    id: z.string().uuid().optional().describe("Current object uuid discovered from a list tool."),
    name: z.string().min(1).max(120).optional().describe("Exact object name; ambiguity returns current candidates."),
  })
  .strict()
  .refine((value) => Boolean(value.id) !== Boolean(value.name), "Informe exatamente um id ou name.");

const cardSchema = z.object({
  term: z.string().min(1).max(CARD_TEXT_MAX).describe("Card term/front."),
  translation: z.string().min(1).max(CARD_TEXT_MAX).describe("Card translation/back."),
  hint: z.string().max(CARD_TEXT_MAX).optional(),
  example_text: z.string().max(CARD_TEXT_MAX).optional(),
  example_translation: z.string().max(CARD_TEXT_MAX).optional(),
  context_tag: z.string().max(CARD_CONTEXT_TAG_MAX).optional(),
  word_hints: z.union([z.array(z.unknown()), z.record(z.unknown())]).optional(),
  image_url_a: z.string().max(CARD_TEXT_MAX).optional(),
  image_url_b: z.string().max(CARD_TEXT_MAX).optional(),
  layer_index: z.number().int().min(0).max(50).optional(),
  parent_card_id: z.string().uuid().optional(),
});

export default defineTool({
  name: "create_study_material",
  title: "Create study material by name or id",
  description:
    "Creates or reuses a folder and list inside the authenticated account's personal or institution scope, then inserts all supplied cards in one batch. " +
    "Resolve names at call time: an ambiguous name fails with candidate ids and paths. dry_run or preview only plans the operation and performs no writes. " +
    "This tool creates material only when explicitly called with cards; for analysis without creation use analyze_text_against_library, which is read-only. " +
    "The owner is always derived from the verified token, never from model input; repeated cards are skipped safely.",
  inputSchema: {
    scope: z.enum(["personal", "institution"]).describe("Library scope to use."),
    institution_id: z.string().uuid().optional().describe("Required for institution scope; discover with get_my_profile."),
    folder: selectorSchema.describe("Folder selected by its current id or exact name."),
    list: selectorSchema.describe("List selected by its current id or exact name within the folder."),
    cards: z.array(cardSchema).min(1).max(MAX_BATCH_CARDS).describe("Cards inserted in one multi-row batch."),
    dry_run: z.boolean().optional().describe("Preview the resolved targets and planned counts without writing."),
    preview: z.boolean().optional().describe("Alias for dry_run; no folder, list or card is created."),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, destructiveHint: false, openWorldHint: true },
  handler: async (args, ctx) => {
    try {
      const db = createUserScopedDb(ctx);
      const result = await createStudyMaterial(db, args);
      return toolSuccess(result);
    } catch (error) {
      return toolErrorResult(error, "create_study_material");
    }
  },
});
