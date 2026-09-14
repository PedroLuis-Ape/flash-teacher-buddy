import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { createUserScopedDb } from "../domain/client";
import { McpDomainError, toolErrorResult, toolSuccess } from "../domain/errors";
import { findAccessibleFolder, findAccessibleList } from "../domain/access";
import { inventoryCacheKey } from "../domain/inventoryInvalidation";
import { folderIdentifierSchema, listIdentifierSchema } from "./identifierSchemas";
import { referenceSelector } from "../domain/referenceIds";
import { PERSONAL_SCOPE, requireUuid, scopeName, type LibraryScope } from "../domain/scope";
import { MAX_FILTER_IDS, MAX_TEXT_CHARS, MAX_TEXT_TOKENS, analyzeTextAgainstLibrary } from "../learning/analyze";
import { createSupabaseVocabularySource } from "../learning/supabaseSource";

const scopeSchema = z
  .object({
    kind: z.enum(["personal", "institution"]).describe('Escopo da biblioteca: "personal" (padrao) ou "institution".'),
    institution_id: z
      .string()
      .uuid()
      .optional()
      .describe('Obrigatorio quando kind = "institution"; descubra o id com get_my_profile.'),
  })
  .strict();

function resolveScope(raw: z.infer<typeof scopeSchema> | undefined): LibraryScope {
  if (!raw || raw.kind === "personal") return PERSONAL_SCOPE;
  if (!raw.institution_id) {
    throw new McpDomainError("invalid_input", 'O escopo "institution" exige "institution_id".', {
      hint: "Use get_my_profile para descobrir os escopos disponiveis desta conta.",
    });
  }
  return { kind: "institution", institutionId: requireUuid(raw.institution_id, "institution_id") };
}

const NO_MATCH_ID = "00000000-0000-4000-8000-000000000000";

async function resolveScopedIdentifiers(
  db: ReturnType<typeof createUserScopedDb>,
  scope: LibraryScope,
  values: string[] | undefined,
  kind: "folder" | "list",
): Promise<string[] | undefined> {
  if (!values?.length) return values;

  const resolved: string[] = [];
  for (const value of values) {
    const selector = referenceSelector(value);
    if (selector.kind === "uuid") {
      resolved.push(selector.id);
      continue;
    }

    try {
      const row = kind === "folder"
        ? await findAccessibleFolder(db, value, scope)
        : await findAccessibleList(db, value, scope);
      const id = typeof row.id === "string" ? row.id : null;
      if (id) resolved.push(id);
    } catch (error) {
      // Preserve the analyzer's existing "missing filter" behavior without
      // ever widening a reference-only filter into the whole library.
      if (error instanceof McpDomainError && error.code === "not_found") {
        resolved.push(NO_MATCH_ID);
        continue;
      }
      throw error;
    }
  }
  return resolved;
}

export default defineTool({
  name: "analyze_text_against_library",
  title: "Analyze text against my vocabulary",
  description:
    "Linguistic analysis of a text against the authenticated account's own library: which words/expressions the learner ALREADY has (exact form, spelling variant, inflection/lemma, phrasal verb or multi-word expression) and which are genuinely NEW to this library. " +
    "Normalization is real: casefold, punctuation, contractions, plural/singular, verb inflection, spelling variants and multi-word expressions are compared as whole units, so \"look\", \"look for\", \"look after\" and \"look up to\" are never collapsed into each other. " +
    "Very basic function words (articles, particles, prepositions) are ignored by default, but expressions that contain them are still analyzed; set ignore_basic_function_words=true/false to include them. " +
    "Each candidate is classified as IGNORE_BASIC, KNOWN_EXACT, KNOWN_VARIANT, KNOWN_LEMMA, KNOWN_EXPRESSION, POSSIBLE_DUPLICATE, NEW or AMBIGUOUS, with evidence (matched card, existing senses, context sentence). " +
    "Duplicates are not decided by term alone: translation, definition, example and context are considered, so a second sense of an existing term (\"bank\" as a river margin vs a financial bank) is reported as POSSIBLE_DUPLICATE instead of being silently treated as known. " +
    "This tool ONLY analyzes: it never creates, edits or deletes cards. The heavy work (building the library index with aggregated, paginated queries) runs on the server; the model receives only the candidates that appear in the text. " +
    "Always confirm with the user before creating anything, and never claim a word is new without reading the returned evidence.",
  inputSchema: {
    text: z
      .string()
      .min(1)
      .max(MAX_TEXT_CHARS)
      .describe(
        "Text to analyze (any language). Hard limits: " +
          MAX_TEXT_CHARS +
          " characters and " +
          MAX_TEXT_TOKENS +
          " words per call; split longer texts.",
      ),
    language: z
      .enum(["en", "pt"])
      .optional()
      .describe('Language of the text. Omit to let the engine detect it (the result reports analyzed_language and confidence).'),
    scope: scopeSchema.optional().describe("Library scope to compare against. Default: personal library."),
    folder_ids: z
      .array(folderIdentifierSchema)
      .max(MAX_FILTER_IDS)
      .optional()
      .describe("Restrict the comparison to these folders by UUID or F- reference (max " + MAX_FILTER_IDS + " ids)."),
    list_ids: z
      .array(listIdentifierSchema)
      .max(MAX_FILTER_IDS)
      .optional()
      .describe("Restrict the comparison to these lists by UUID or L- reference (max " + MAX_FILTER_IDS + " ids)."),
    ignore_basic_function_words: z
      .boolean()
      .optional()
      .describe("Default true: basic articles/particles/prepositions are classified IGNORE_BASIC. Set false to treat them as normal candidates."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (args, ctx) => {
    try {
      const db = createUserScopedDb(ctx);
      const scope = resolveScope(args.scope);
      const [folderIds, listIds] = await Promise.all([
        resolveScopedIdentifiers(db, scope, args.folder_ids, "folder"),
        resolveScopedIdentifiers(db, scope, args.list_ids, "list"),
      ]);
      const result = await analyzeTextAgainstLibrary({
        text: args.text,
        language: args.language,
        source: createSupabaseVocabularySource(db, scope),
        filters: { folderIds, listIds },
        ignoreBasicFunctionWords: args.ignore_basic_function_words,
        cacheKey: inventoryCacheKey(db.userId, scope.kind === "institution" ? scope.institutionId : null),
        cacheMode: "use",
        scopeName: scopeName(scope),
      });
      return toolSuccess(result as unknown as Record<string, unknown>);
    } catch (error) {
      return toolErrorResult(error, "analyze_text_against_library");
    }
  },
});
