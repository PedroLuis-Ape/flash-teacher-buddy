import { z } from "zod";

export const SMART_IMPORT_SCHEMA = "app-piteco-super-import" as const;
export const SMART_IMPORT_VERSION = "2.0" as const;

export const SMART_IMPORT_LIMITS = {
  maxFileBytes: 50 * 1024 * 1024,
  maxFolders: 200,
  maxLists: 1_000,
  maxCards: 20_000,
  maxGlossaryEntries: 20_000,
  maxTextLength: 250_000,
  maxNameLength: 160,
  maxWordHintsPerCard: 200,
  maxLayersPerGroup: 500,
} as const;

const formatLimit = (value: number) => value.toLocaleString("pt-BR");

const trimmed = (label: string, max: number = SMART_IMPORT_LIMITS.maxTextLength) =>
  z.string()
    .transform((value) => value.trim())
    .pipe(z.string().min(1, `${label} não pode ficar vazio.`).max(max, `${label} excede ${formatLimit(max)} caracteres.`));

const optionalTrimmed = (max: number = SMART_IMPORT_LIMITS.maxTextLength) =>
  z.string()
    .transform((value) => value.trim())
    .pipe(z.string().max(max))
    .optional()
    .nullable();

export const smartWordHintSchema = z.object({
  side: z.enum(["A", "B"]).default("A"),
  text: trimmed("O trecho do glossário contextual"),
  translation: trimmed("A tradução do glossário contextual"),
  note: optionalTrimmed(),
  occurrence: z.union([z.literal("all"), z.number().int().nonnegative()]).default("all"),
  start_index: z.number().int().nonnegative().optional(),
  end_index: z.number().int().positive().optional(),
}).strict().superRefine((value, ctx) => {
  if ((value.start_index === undefined) !== (value.end_index === undefined)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "start_index e end_index precisam ser informados juntos." });
  }
  if (value.start_index !== undefined && value.end_index !== undefined && value.end_index <= value.start_index) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "end_index precisa ser maior que start_index." });
  }
});

const smartCardContentShape = {
  front: trimmed("O lado A do card"),
  back: trimmed("O lado B do card"),
  key: optionalTrimmed(SMART_IMPORT_LIMITS.maxNameLength),
  hint: optionalTrimmed(),
  short_observation: optionalTrimmed(),
  detailed_explanation: optionalTrimmed(),
  usage_notes: optionalTrimmed(),
  common_mistakes: optionalTrimmed(),
  example: optionalTrimmed(),
  example_translation: optionalTrimmed(),
  context_tag: optionalTrimmed(SMART_IMPORT_LIMITS.maxNameLength),
  tags: z.array(trimmed("Tag", SMART_IMPORT_LIMITS.maxNameLength)).max(50).optional(),
  word_hints: z.array(smartWordHintSchema).max(SMART_IMPORT_LIMITS.maxWordHintsPerCard).optional(),
} as const;

export const smartNormalCardSchema = z.object({
  type: z.literal("normal").default("normal"),
  ...smartCardContentShape,
}).strict();

export const smartLayerSchema = z.object({
  ...smartCardContentShape,
}).strict();

export const smartLayeredCardSchema = z.object({
  type: z.literal("layered"),
  key: optionalTrimmed(SMART_IMPORT_LIMITS.maxNameLength),
  group_title: trimmed("O título do grupo", SMART_IMPORT_LIMITS.maxNameLength),
  layers: z.array(smartLayerSchema)
    .min(2, "Um grupo precisa ter pelo menos duas camadas jogáveis.")
    .max(SMART_IMPORT_LIMITS.maxLayersPerGroup),
}).strict();

export const smartCardSchema = z.discriminatedUnion("type", [
  smartNormalCardSchema,
  smartLayeredCardSchema,
]);

export const smartGlossaryEntrySchema = z.object({
  term: trimmed("O termo do glossário"),
  translation: trimmed("A tradução do glossário"),
  side: z.enum(["A", "B"]).default("A"),
  note: optionalTrimmed(),
  active: z.boolean().default(true),
}).strict();

export const smartImportListSchema = z.object({
  name: trimmed("O nome da lista", SMART_IMPORT_LIMITS.maxNameLength),
  description: optionalTrimmed(),
  front_language: trimmed("O idioma do lado A", SMART_IMPORT_LIMITS.maxNameLength),
  back_language: trimmed("O idioma do lado B", SMART_IMPORT_LIMITS.maxNameLength),
  primary_side: z.enum(["a", "b"]).default("a"),
  study_type: z.enum(["language", "general", "math", "visual"]).default("language"),
  label_a: optionalTrimmed(SMART_IMPORT_LIMITS.maxNameLength),
  label_b: optionalTrimmed(SMART_IMPORT_LIMITS.maxNameLength),
  tts_enabled: z.boolean().default(true),
  glossary: z.array(smartGlossaryEntrySchema).max(SMART_IMPORT_LIMITS.maxGlossaryEntries).default([]),
  cards: z.array(smartCardSchema).default([]),
}).strict().superRefine((value, ctx) => {
  if (value.cards.length === 0 && value.glossary.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A lista precisa ter cards ou entradas de glossário." });
  }
});

export const smartImportFolderSchema = z.object({
  name: trimmed("O nome da pasta", SMART_IMPORT_LIMITS.maxNameLength),
  description: optionalTrimmed(),
  lists: z.array(smartImportListSchema).min(1).max(SMART_IMPORT_LIMITS.maxLists),
}).strict();

export const smartImportPackageSchema = z.object({
  schema: z.literal(SMART_IMPORT_SCHEMA),
  version: z.literal(SMART_IMPORT_VERSION),
  declared_totals: z.object({
    folders: z.number().int().nonnegative(),
    lists: z.number().int().nonnegative(),
    cards: z.number().int().nonnegative(),
    glossary_entries: z.number().int().nonnegative().default(0),
    layered_groups: z.number().int().nonnegative().default(0),
  }).strict().optional(),
  package: z.object({
    name: trimmed("O nome do pacote", SMART_IMPORT_LIMITS.maxNameLength),
    description: optionalTrimmed(),
    source_language: optionalTrimmed(SMART_IMPORT_LIMITS.maxNameLength),
    target_language: optionalTrimmed(SMART_IMPORT_LIMITS.maxNameLength),
    level: optionalTrimmed(SMART_IMPORT_LIMITS.maxNameLength),
    theme: optionalTrimmed(),
    folders: z.array(smartImportFolderSchema).min(1).max(SMART_IMPORT_LIMITS.maxFolders),
  }).strict(),
}).strict().superRefine((value, ctx) => {
  const summary = summarizeSmartImport(value);
  if (summary.lists > SMART_IMPORT_LIMITS.maxLists) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["package", "folders"], message: `O pacote excede ${SMART_IMPORT_LIMITS.maxLists} listas.` });
  }
  if (summary.cards > SMART_IMPORT_LIMITS.maxCards) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["package", "folders"], message: `O pacote excede ${SMART_IMPORT_LIMITS.maxCards} cards jogáveis.` });
  }
  if (summary.glossaryEntries > SMART_IMPORT_LIMITS.maxGlossaryEntries) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["package", "folders"], message: `O pacote excede ${SMART_IMPORT_LIMITS.maxGlossaryEntries} entradas de glossário.` });
  }
  if (value.declared_totals) {
    const declared = value.declared_totals;
    const comparisons: Array<[keyof typeof declared, number]> = [
      ["folders", summary.folders],
      ["lists", summary.lists],
      ["cards", summary.cards],
      ["glossary_entries", summary.glossaryEntries],
      ["layered_groups", summary.layeredGroups],
    ];
    comparisons.forEach(([key, actual]) => {
      if (declared[key] !== actual) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["declared_totals", key], message: `Contagem declarada ${declared[key]} difere da contagem real ${actual}.` });
      }
    });
  }
});

export type SmartWordHint = z.infer<typeof smartWordHintSchema>;
export type SmartNormalCard = z.infer<typeof smartNormalCardSchema>;
export type SmartLayer = z.infer<typeof smartLayerSchema>;
export type SmartLayeredCard = z.infer<typeof smartLayeredCardSchema>;
export type SmartCard = z.infer<typeof smartCardSchema>;
export type SmartGlossaryEntry = z.infer<typeof smartGlossaryEntrySchema>;
export type SmartImportList = z.infer<typeof smartImportListSchema>;
export type SmartImportFolder = z.infer<typeof smartImportFolderSchema>;
export type SmartImportPackage = z.infer<typeof smartImportPackageSchema>;

export interface SmartImportSummary {
  folders: number;
  lists: number;
  cards: number;
  normalCards: number;
  layeredGroups: number;
  glossaryEntries: number;
  wordHints: number;
  detailedCards: number;
}

export function summarizeSmartImport(value: Pick<SmartImportPackage, "package">): SmartImportSummary {
  const summary: SmartImportSummary = {
    folders: value.package.folders.length,
    lists: 0,
    cards: 0,
    normalCards: 0,
    layeredGroups: 0,
    glossaryEntries: 0,
    wordHints: 0,
    detailedCards: 0,
  };

  for (const folder of value.package.folders) {
    summary.lists += folder.lists.length;
    for (const list of folder.lists) {
      summary.glossaryEntries += list.glossary.length;
      for (const card of list.cards) {
        if (card.type === "normal") {
          summary.cards += 1;
          summary.normalCards += 1;
          summary.wordHints += card.word_hints?.length ?? 0;
          if (card.detailed_explanation || card.usage_notes || card.common_mistakes) summary.detailedCards += 1;
        } else {
          summary.layeredGroups += 1;
          summary.cards += card.layers.length;
          for (const layer of card.layers) {
            summary.wordHints += layer.word_hints?.length ?? 0;
            if (layer.detailed_explanation || layer.usage_notes || layer.common_mistakes) summary.detailedCards += 1;
          }
        }
      }
    }
  }
  return summary;
}

export function withSmartDeclaredTotals(value: Omit<SmartImportPackage, "declared_totals">): SmartImportPackage {
  const summary = summarizeSmartImport(value as SmartImportPackage);
  return {
    ...value,
    declared_totals: {
      folders: summary.folders,
      lists: summary.lists,
      cards: summary.cards,
      glossary_entries: summary.glossaryEntries,
      layered_groups: summary.layeredGroups,
    },
  };
}
