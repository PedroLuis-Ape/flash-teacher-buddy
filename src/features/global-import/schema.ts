import { z } from "zod";

export const GLOBAL_IMPORT_SCHEMA = "appteco-global-import" as const;
export const GLOBAL_IMPORT_VERSION = 1 as const;

export const GLOBAL_IMPORT_LIMITS = {
  maxFileBytes: 50 * 1024 * 1024,
  maxFolders: 200,
  maxLists: 1_000,
  maxCards: 20_000,
  maxNameLength: 160,
  maxTextLength: 250_000,
  maxTagsPerCard: 30,
} as const;

const formatLimit = (value: number) => value.toLocaleString("pt-BR");

const trimmedText = (label: string, max: number) =>
  z.string()
    .transform((value) => value.trim())
    .pipe(z.string().min(1, `${label} não pode ficar vazio.`).max(max, `${label} excede ${formatLimit(max)} caracteres.`));

const optionalTrimmedText = (max: number) =>
  z.string()
    .transform((value) => value.trim())
    .pipe(z.string().max(max))
    .optional();

export const globalImportCardSchema = z.object({
  front: trimmedText("A frente do card", GLOBAL_IMPORT_LIMITS.maxTextLength),
  back: trimmedText("O verso do card", GLOBAL_IMPORT_LIMITS.maxTextLength),
  hint: optionalTrimmedText(GLOBAL_IMPORT_LIMITS.maxTextLength),
  context_tag: optionalTrimmedText(GLOBAL_IMPORT_LIMITS.maxNameLength),
  example: optionalTrimmedText(GLOBAL_IMPORT_LIMITS.maxTextLength),
  example_translation: optionalTrimmedText(GLOBAL_IMPORT_LIMITS.maxTextLength),
  tags: z.array(trimmedText("Tag", GLOBAL_IMPORT_LIMITS.maxNameLength))
    .max(GLOBAL_IMPORT_LIMITS.maxTagsPerCard)
    .optional(),
  metadata: z.record(z.unknown()).optional(),
}).strict();

export const globalImportListSchema = z.object({
  name: trimmedText("O nome da lista", GLOBAL_IMPORT_LIMITS.maxNameLength),
  description: optionalTrimmedText(GLOBAL_IMPORT_LIMITS.maxTextLength),
  expected_cards: z.number().int().nonnegative().optional(),
  cards: z.array(globalImportCardSchema).min(1, "A lista precisa ter pelo menos um card."),
}).strict();

export const globalImportFolderSchema = z.object({
  name: trimmedText("O nome da pasta", GLOBAL_IMPORT_LIMITS.maxNameLength),
  description: optionalTrimmedText(GLOBAL_IMPORT_LIMITS.maxTextLength),
  expected_cards: z.number().int().nonnegative().optional(),
  lists: z.array(globalImportListSchema).min(1, "A pasta precisa ter pelo menos uma lista."),
}).strict();

export const globalImportPackageSchema = z.object({
  schema: z.literal(GLOBAL_IMPORT_SCHEMA),
  version: z.literal(GLOBAL_IMPORT_VERSION),
  package: z.object({
    name: trimmedText("O nome do pacote", GLOBAL_IMPORT_LIMITS.maxNameLength),
    source_language: optionalTrimmedText(GLOBAL_IMPORT_LIMITS.maxNameLength),
    target_language: optionalTrimmedText(GLOBAL_IMPORT_LIMITS.maxNameLength),
    level: optionalTrimmedText(GLOBAL_IMPORT_LIMITS.maxNameLength),
    theme: optionalTrimmedText(GLOBAL_IMPORT_LIMITS.maxTextLength),
    folders: z.array(globalImportFolderSchema)
      .min(1, "O pacote precisa ter pelo menos uma pasta.")
      .max(GLOBAL_IMPORT_LIMITS.maxFolders),
  }).strict(),
}).strict();

export type GlobalImportCard = z.infer<typeof globalImportCardSchema>;
export type GlobalImportList = z.infer<typeof globalImportListSchema>;
export type GlobalImportFolder = z.infer<typeof globalImportFolderSchema>;
export type GlobalImportPackage = z.infer<typeof globalImportPackageSchema>;

export const GLOBAL_IMPORT_EXAMPLE: GlobalImportPackage = {
  schema: GLOBAL_IMPORT_SCHEMA,
  version: GLOBAL_IMPORT_VERSION,
  package: {
    name: "Pacote de exemplo",
    source_language: "idioma de origem",
    target_language: "idioma de tradução",
    folders: [
      {
        name: "Pasta definida pelo usuário",
        expected_cards: 1,
        lists: [
          {
            name: "Lista definida pelo usuário",
            expected_cards: 1,
            cards: [
              {
                front: "Conteúdo da frente",
                back: "Conteúdo do verso",
              },
            ],
          },
        ],
      },
    ],
  },
};
