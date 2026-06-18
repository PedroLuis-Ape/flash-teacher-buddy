import {
  findDangerousImportKey,
  globalImportSchema,
  type CanonicalGlobalImportPackage,
} from "./schema/globalImportSchema";
import {
  GLOBAL_IMPORT_SCHEMA,
  GLOBAL_IMPORT_VERSION,
  globalImportPackageSchema,
  type GlobalImportPackage,
} from "./schema";

export type GlobalImportSourceFormat = "canonical" | "legacy";

export interface NormalizedGlobalImportResult {
  sourceFormat: GlobalImportSourceFormat;
  packageValue: GlobalImportPackage;
  canonicalPackage: CanonicalGlobalImportPackage | null;
  warnings: string[];
}

export interface NormalizeGlobalImportFailure {
  sourceFormat: GlobalImportSourceFormat | "unknown";
  canonicalResult: ReturnType<typeof globalImportSchema.safeParse>;
  legacyResult: ReturnType<typeof globalImportPackageSchema.safeParse>;
  dangerousPath: string | null;
}

function canonicalToInternal(value: CanonicalGlobalImportPackage): GlobalImportPackage {
  return {
    schema: GLOBAL_IMPORT_SCHEMA,
    version: GLOBAL_IMPORT_VERSION,
    package: {
      name: value.package.title,
      source_language: value.package.study_settings.lang_a,
      target_language: value.package.study_settings.lang_b,
      folders: value.package.folders.map((folder) => ({
        name: folder.title,
        description: folder.description ?? undefined,
        expected_cards: folder.expected_card_count,
        lists: folder.lists.map((list) => ({
          name: list.title,
          description: list.description ?? undefined,
          expected_cards: list.expected_card_count,
          cards: list.cards.map((card) => ({
            front: card.term,
            back: card.translation,
            hint: card.hint ?? undefined,
            example: card.example_text ?? undefined,
            example_translation: card.example_translation ?? undefined,
          })),
        })),
      })),
    },
  };
}

export function normalizeGlobalImportValue(
  value: unknown,
): { success: true; data: NormalizedGlobalImportResult } | { success: false; error: NormalizeGlobalImportFailure } {
  const dangerousPath = findDangerousImportKey(value);
  const canonicalResult = globalImportSchema.safeParse(value);
  const legacyResult = globalImportPackageSchema.safeParse(value);

  if (dangerousPath) {
    return { success: false, error: { sourceFormat: "unknown", canonicalResult, legacyResult, dangerousPath } };
  }

  if (canonicalResult.success) {
    return {
      success: true,
      data: {
        sourceFormat: "canonical",
        packageValue: canonicalToInternal(canonicalResult.data),
        canonicalPackage: canonicalResult.data,
        warnings: [],
      },
    };
  }

  if (legacyResult.success) {
    return {
      success: true,
      data: {
        sourceFormat: "legacy",
        packageValue: legacyResult.data,
        canonicalPackage: null,
        warnings: [
          "Pacote no formato legado appteco-global-import. Ele continua aceito por compatibilidade, mas novos prompts usam ape-global-import.",
        ],
      },
    };
  }

  const record = value && typeof value === "object" ? value as Record<string, unknown> : null;
  const sourceFormat = record?.format === "ape-global-import"
    ? "canonical"
    : record?.schema === GLOBAL_IMPORT_SCHEMA
      ? "legacy"
      : "unknown";

  return { success: false, error: { sourceFormat, canonicalResult, legacyResult, dangerousPath: null } };
}

export function requestIdFromUnknown(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const requestId = (value as Record<string, unknown>).request_id;
  return typeof requestId === "string" ? requestId : null;
}
