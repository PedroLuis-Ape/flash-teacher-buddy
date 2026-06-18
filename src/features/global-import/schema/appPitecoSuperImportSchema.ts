import { z } from "zod";

export const APP_PITECO_SUPER_IMPORT_SCHEMA = "app-piteco-super-import" as const;
export const APP_PITECO_SUPER_IMPORT_VERSION = "1.0" as const;

export const APP_PITECO_SUPER_IMPORT_LIMITS = {
  maxFileBytes: 10 * 1024 * 1024,
  maxFolders: 200,
  maxLists: 1_000,
  maxCards: 20_000,
  maxListsPerFolder: 500,
  maxCardsPerList: 5_000,
  maxNameLength: 120,
  maxCardSideLength: 2_000,
  maxLanguageCodeLength: 20,
} as const;

const requiredText = (label: string, maxLength: number) =>
  z.string()
    .transform((value) => value.trim())
    .pipe(z.string().min(1, `${label} não pode ficar vazio.`).max(maxLength, `${label} excede ${maxLength} caracteres.`));

export const appPitecoLanguageCodeSchema = z.string()
  .min(2)
  .max(APP_PITECO_SUPER_IMPORT_LIMITS.maxLanguageCodeLength)
  .regex(
    /^[a-z]{2,3}(-[A-Z][a-z]{3})?(-([A-Z]{2}|[0-9]{3}))?$/,
    "Código de idioma BCP 47 inválido.",
  );

export const appPitecoSuperImportCardSchema = z.object({
  front: requiredText("A frente do card", APP_PITECO_SUPER_IMPORT_LIMITS.maxCardSideLength),
  back: requiredText("O verso do card", APP_PITECO_SUPER_IMPORT_LIMITS.maxCardSideLength),
}).strict();

export const appPitecoSuperImportListSchema = z.object({
  name: requiredText("O nome da lista", APP_PITECO_SUPER_IMPORT_LIMITS.maxNameLength),
  front_language: appPitecoLanguageCodeSchema,
  back_language: appPitecoLanguageCodeSchema,
  declared_card_count: z.number().int().min(1).max(APP_PITECO_SUPER_IMPORT_LIMITS.maxCardsPerList),
  cards: z.array(appPitecoSuperImportCardSchema)
    .min(1, "A lista precisa ter pelo menos um card.")
    .max(APP_PITECO_SUPER_IMPORT_LIMITS.maxCardsPerList),
}).strict();

export const appPitecoSuperImportFolderSchema = z.object({
  name: requiredText("O nome da pasta", APP_PITECO_SUPER_IMPORT_LIMITS.maxNameLength),
  declared_totals: z.object({
    lists: z.number().int().min(1).max(APP_PITECO_SUPER_IMPORT_LIMITS.maxListsPerFolder),
    cards: z.number().int().min(1).max(APP_PITECO_SUPER_IMPORT_LIMITS.maxCards),
  }).strict(),
  lists: z.array(appPitecoSuperImportListSchema)
    .min(1, "A pasta precisa ter pelo menos uma lista.")
    .max(APP_PITECO_SUPER_IMPORT_LIMITS.maxListsPerFolder),
}).strict();

export const appPitecoSuperImportSchema = z.object({
  schema: z.literal(APP_PITECO_SUPER_IMPORT_SCHEMA),
  version: z.literal(APP_PITECO_SUPER_IMPORT_VERSION),
  declared_totals: z.object({
    folders: z.number().int().min(1).max(APP_PITECO_SUPER_IMPORT_LIMITS.maxFolders),
    lists: z.number().int().min(1).max(APP_PITECO_SUPER_IMPORT_LIMITS.maxLists),
    cards: z.number().int().min(1).max(APP_PITECO_SUPER_IMPORT_LIMITS.maxCards),
  }).strict(),
  package: z.object({
    name: requiredText("O nome do pacote", APP_PITECO_SUPER_IMPORT_LIMITS.maxNameLength),
    folders: z.array(appPitecoSuperImportFolderSchema)
      .min(1, "O pacote precisa ter pelo menos uma pasta.")
      .max(APP_PITECO_SUPER_IMPORT_LIMITS.maxFolders),
  }).strict(),
}).strict().superRefine((value, context) => {
  const actualFolders = value.package.folders.length;
  let actualLists = 0;
  let actualCards = 0;

  value.package.folders.forEach((folder, folderIndex) => {
    const folderLists = folder.lists.length;
    const folderCards = folder.lists.reduce((sum, list) => sum + list.cards.length, 0);
    actualLists += folderLists;
    actualCards += folderCards;

    if (folder.declared_totals.lists !== folderLists) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["package", "folders", folderIndex, "declared_totals", "lists"],
        message: `[E_COUNT_MISMATCH] A pasta declara ${folder.declared_totals.lists} listas, mas contém ${folderLists}.`,
      });
    }
    if (folder.declared_totals.cards !== folderCards) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["package", "folders", folderIndex, "declared_totals", "cards"],
        message: `[E_COUNT_MISMATCH] A pasta declara ${folder.declared_totals.cards} cards, mas contém ${folderCards}.`,
      });
    }

    folder.lists.forEach((list, listIndex) => {
      if (list.declared_card_count !== list.cards.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["package", "folders", folderIndex, "lists", listIndex, "declared_card_count"],
          message: `[E_COUNT_MISMATCH] A lista declara ${list.declared_card_count} cards, mas contém ${list.cards.length}.`,
        });
      }
    });
  });

  if (value.declared_totals.folders !== actualFolders) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["declared_totals", "folders"],
      message: `[E_COUNT_MISMATCH] O pacote declara ${value.declared_totals.folders} pastas, mas contém ${actualFolders}.`,
    });
  }
  if (value.declared_totals.lists !== actualLists) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["declared_totals", "lists"],
      message: `[E_COUNT_MISMATCH] O pacote declara ${value.declared_totals.lists} listas, mas contém ${actualLists}.`,
    });
  }
  if (value.declared_totals.cards !== actualCards) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["declared_totals", "cards"],
      message: `[E_COUNT_MISMATCH] O pacote declara ${value.declared_totals.cards} cards, mas contém ${actualCards}.`,
    });
  }
});

export type AppPitecoSuperImportCard = z.infer<typeof appPitecoSuperImportCardSchema>;
export type AppPitecoSuperImportList = z.infer<typeof appPitecoSuperImportListSchema>;
export type AppPitecoSuperImportFolder = z.infer<typeof appPitecoSuperImportFolderSchema>;
export type AppPitecoSuperImportPackage = z.infer<typeof appPitecoSuperImportSchema>;

export const APP_PITECO_SUPER_IMPORT_EXAMPLE: AppPitecoSuperImportPackage = appPitecoSuperImportSchema.parse({
  schema: APP_PITECO_SUPER_IMPORT_SCHEMA,
  version: APP_PITECO_SUPER_IMPORT_VERSION,
  declared_totals: { folders: 1, lists: 1, cards: 2 },
  package: {
    name: "Inglês para viagens",
    folders: [{
      name: "Viagens",
      declared_totals: { lists: 1, cards: 2 },
      lists: [{
        name: "Aeroporto",
        front_language: "en",
        back_language: "pt-BR",
        declared_card_count: 2,
        cards: [
          { front: "Where is the boarding gate?", back: "Onde fica o portão de embarque?" },
          { front: "My flight has been delayed.", back: "Meu voo foi atrasado." },
        ],
      }],
    }],
  },
});
