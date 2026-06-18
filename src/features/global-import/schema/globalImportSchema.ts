import { z } from "zod";

export const GLOBAL_IMPORT_FORMAT = "ape-global-import" as const;
export const GLOBAL_IMPORT_SCHEMA_VERSION = 1 as const;

export const GLOBAL_IMPORT_LIMITS = {
  maxFileBytes: 5 * 1024 * 1024,
  maxFolders: 100,
  maxLists: 500,
  maxCards: 5_000,
  maxTitleLength: 160,
  maxTermLength: 8_000,
  maxTranslationLength: 8_000,
  maxExplanationLength: 16_000,
  maxDescriptionLength: 8_000,
  maxLanguageLength: 80,
  maxLabelLength: 120,
} as const;

const requiredText = (label: string, max: number) =>
  z.string()
    .trim()
    .min(1, `${label} não pode ficar vazio.`)
    .max(max, `${label} excede ${max} caracteres.`);

const nullableText = (label: string, max: number) =>
  z.union([
    z.string().trim().max(max, `${label} excede ${max} caracteres.`),
    z.null(),
  ]).optional().default(null);

export const globalImportStudySettingsSchema = z.object({
  study_type: z.enum(["language", "general", "math", "visual"]),
  lang_a: requiredText("O idioma do lado A", GLOBAL_IMPORT_LIMITS.maxLanguageLength),
  lang_b: requiredText("O idioma do lado B", GLOBAL_IMPORT_LIMITS.maxLanguageLength),
  labels_a: requiredText("O rótulo do lado A", GLOBAL_IMPORT_LIMITS.maxLabelLength),
  labels_b: requiredText("O rótulo do lado B", GLOBAL_IMPORT_LIMITS.maxLabelLength),
  tts_enabled: z.boolean(),
}).strict();

export const globalImportNormalCardSchema = z.object({
  type: z.literal("normal"),
  term: requiredText("O termo", GLOBAL_IMPORT_LIMITS.maxTermLength),
  translation: requiredText("A tradução", GLOBAL_IMPORT_LIMITS.maxTranslationLength),
  hint: nullableText("A dica", GLOBAL_IMPORT_LIMITS.maxExplanationLength),
  example_text: nullableText("O exemplo", GLOBAL_IMPORT_LIMITS.maxExplanationLength),
  example_translation: nullableText("A tradução do exemplo", GLOBAL_IMPORT_LIMITS.maxExplanationLength),
  detailed_explanation: nullableText("A explicação detalhada", GLOBAL_IMPORT_LIMITS.maxExplanationLength),
  usage_notes: nullableText("As notas de uso", GLOBAL_IMPORT_LIMITS.maxExplanationLength),
  common_mistakes: nullableText("Os erros comuns", GLOBAL_IMPORT_LIMITS.maxExplanationLength),
}).strict();

export const globalImportCardSchema = z.discriminatedUnion("type", [
  globalImportNormalCardSchema,
]);

export const globalImportListSchema = z.object({
  title: requiredText("O título da lista", GLOBAL_IMPORT_LIMITS.maxTitleLength),
  description: nullableText("A descrição da lista", GLOBAL_IMPORT_LIMITS.maxDescriptionLength),
  order_index: z.number().int().nonnegative(),
  expected_card_count: z.number().int().positive(),
  cards: z.array(globalImportCardSchema).min(1, "A lista precisa ter pelo menos um card."),
}).strict();

export const globalImportFolderSchema = z.object({
  title: requiredText("O título da pasta", GLOBAL_IMPORT_LIMITS.maxTitleLength),
  description: nullableText("A descrição da pasta", GLOBAL_IMPORT_LIMITS.maxDescriptionLength),
  order_index: z.number().int().nonnegative(),
  expected_list_count: z.number().int().positive(),
  expected_card_count: z.number().int().positive(),
  lists: z.array(globalImportListSchema).min(1, "A pasta precisa ter pelo menos uma lista."),
}).strict();

export const globalImportSchema = z.object({
  format: z.literal(GLOBAL_IMPORT_FORMAT),
  schema_version: z.literal(GLOBAL_IMPORT_SCHEMA_VERSION),
  request_id: z.string().uuid("request_id precisa ser um UUID válido."),
  package: z.object({
    title: requiredText("O título do pacote", GLOBAL_IMPORT_LIMITS.maxTitleLength),
    description: nullableText("A descrição do pacote", GLOBAL_IMPORT_LIMITS.maxDescriptionLength),
    study_settings: globalImportStudySettingsSchema,
    expected_folder_count: z.number().int().positive(),
    expected_list_count: z.number().int().positive(),
    expected_card_count: z.number().int().positive(),
    folders: z.array(globalImportFolderSchema)
      .min(1, "O pacote precisa ter pelo menos uma pasta.")
      .max(GLOBAL_IMPORT_LIMITS.maxFolders),
  }).strict(),
}).strict().superRefine((value, context) => {
  const folders = value.package.folders;
  const listCount = folders.reduce((sum, folder) => sum + folder.lists.length, 0);
  const cardCount = folders.reduce(
    (sum, folder) => sum + folder.lists.reduce((listSum, list) => listSum + list.cards.length, 0),
    0,
  );

  if (value.package.expected_folder_count !== folders.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["package", "expected_folder_count"],
      message: `O pacote declara ${value.package.expected_folder_count} pastas, mas contém ${folders.length}.`,
    });
  }
  if (value.package.expected_list_count !== listCount) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["package", "expected_list_count"],
      message: `O pacote declara ${value.package.expected_list_count} listas, mas contém ${listCount}.`,
    });
  }
  if (value.package.expected_card_count !== cardCount) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["package", "expected_card_count"],
      message: `O pacote declara ${value.package.expected_card_count} cards, mas contém ${cardCount}.`,
    });
  }
  if (listCount > GLOBAL_IMPORT_LIMITS.maxLists) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["package", "folders"],
      message: `O pacote contém ${listCount} listas; o limite é ${GLOBAL_IMPORT_LIMITS.maxLists}.`,
    });
  }
  if (cardCount > GLOBAL_IMPORT_LIMITS.maxCards) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["package", "folders"],
      message: `O pacote contém ${cardCount} cards; o limite é ${GLOBAL_IMPORT_LIMITS.maxCards}.`,
    });
  }

  folders.forEach((folder, folderIndex) => {
    const folderCardCount = folder.lists.reduce((sum, list) => sum + list.cards.length, 0);
    if (folder.order_index !== folderIndex) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["package", "folders", folderIndex, "order_index"],
        message: `A ordem esperada é ${folderIndex}, mas foi recebido ${folder.order_index}.`,
      });
    }
    if (folder.expected_list_count !== folder.lists.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["package", "folders", folderIndex, "expected_list_count"],
        message: `A pasta declara ${folder.expected_list_count} listas, mas contém ${folder.lists.length}.`,
      });
    }
    if (folder.expected_card_count !== folderCardCount) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["package", "folders", folderIndex, "expected_card_count"],
        message: `A pasta declara ${folder.expected_card_count} cards, mas contém ${folderCardCount}.`,
      });
    }

    folder.lists.forEach((list, listIndex) => {
      if (list.order_index !== listIndex) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["package", "folders", folderIndex, "lists", listIndex, "order_index"],
          message: `A ordem esperada é ${listIndex}, mas foi recebido ${list.order_index}.`,
        });
      }
      if (list.expected_card_count !== list.cards.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["package", "folders", folderIndex, "lists", listIndex, "expected_card_count"],
          message: `A lista declara ${list.expected_card_count} cards, mas contém ${list.cards.length}.`,
        });
      }
    });
  });
});

export type GlobalImportStudySettings = z.infer<typeof globalImportStudySettingsSchema>;
export type GlobalImportNormalCard = z.infer<typeof globalImportNormalCardSchema>;
export type CanonicalGlobalImportCard = z.infer<typeof globalImportCardSchema>;
export type CanonicalGlobalImportList = z.infer<typeof globalImportListSchema>;
export type CanonicalGlobalImportFolder = z.infer<typeof globalImportFolderSchema>;
export type CanonicalGlobalImportPackage = z.infer<typeof globalImportSchema>;

export const DANGEROUS_IMPORT_KEYS = new Set(["__proto__", "prototype", "constructor"]);

export function findDangerousImportKey(value: unknown, path = "$", seen = new WeakSet<object>()): string | null {
  if (!value || typeof value !== "object") return null;
  if (seen.has(value as object)) return null;
  seen.add(value as object);

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findDangerousImportKey(value[index], `${path}[${index}]`, seen);
      if (found) return found;
    }
    return null;
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (DANGEROUS_IMPORT_KEYS.has(key)) return `${path}.${key}`;
    const found = findDangerousImportKey(child, `${path}.${key}`, seen);
    if (found) return found;
  }
  return null;
}

export function createOfficialGlobalImportExample(requestId = "00000000-0000-4000-8000-000000000001"): CanonicalGlobalImportPackage {
  return globalImportSchema.parse({
    format: GLOBAL_IMPORT_FORMAT,
    schema_version: GLOBAL_IMPORT_SCHEMA_VERSION,
    request_id: requestId,
    package: {
      title: "Pacote de exemplo",
      description: null,
      study_settings: {
        study_type: "language",
        lang_a: "en",
        lang_b: "pt-BR",
        labels_a: "English",
        labels_b: "Português",
        tts_enabled: true,
      },
      expected_folder_count: 1,
      expected_list_count: 1,
      expected_card_count: 1,
      folders: [{
        title: "Pasta definida pelo usuário",
        description: null,
        order_index: 0,
        expected_list_count: 1,
        expected_card_count: 1,
        lists: [{
          title: "Lista definida pelo usuário",
          description: null,
          order_index: 0,
          expected_card_count: 1,
          cards: [{
            type: "normal",
            term: "Content on side A",
            translation: "Conteúdo do lado B",
            hint: null,
            example_text: null,
            example_translation: null,
            detailed_explanation: null,
            usage_notes: null,
            common_mistakes: null,
          }],
        }],
      }],
    },
  });
}

export const GLOBAL_IMPORT_EXAMPLE = createOfficialGlobalImportExample();
