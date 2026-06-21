import {
  findDangerousImportKey,
  globalImportSchema,
  type CanonicalGlobalImportPackage,
} from "./schema/globalImportSchema";
import {
  APP_PITECO_SUPER_IMPORT_SCHEMA,
  appPitecoSuperImportSchema,
  type AppPitecoSuperImportPackage,
} from "./schema/appPitecoSuperImportSchema";
import {
  GLOBAL_IMPORT_SCHEMA,
  GLOBAL_IMPORT_VERSION,
  globalImportPackageSchema,
  type GlobalImportPackage,
} from "./schema";

export type GlobalImportSourceFormat = "official" | "canonical" | "legacy";

export interface NormalizedGlobalImportResult {
  sourceFormat: GlobalImportSourceFormat;
  packageValue: GlobalImportPackage;
  officialPackage: AppPitecoSuperImportPackage | null;
  canonicalPackage: CanonicalGlobalImportPackage | null;
  warnings: string[];
}

export interface NormalizeGlobalImportFailure {
  sourceFormat: GlobalImportSourceFormat | "unknown";
  officialResult: ReturnType<typeof appPitecoSuperImportSchema.safeParse>;
  canonicalResult: ReturnType<typeof globalImportSchema.safeParse>;
  legacyResult: ReturnType<typeof globalImportPackageSchema.safeParse>;
  dangerousPath: string | null;
}

function firstDirection(value: AppPitecoSuperImportPackage): { front: string; back: string } {
  const firstList = value.package.folders[0]?.lists[0];
  return {
    front: firstList?.front_language ?? "",
    back: firstList?.back_language ?? "",
  };
}

function officialToInternal(value: AppPitecoSuperImportPackage): GlobalImportPackage {
  const direction = firstDirection(value);
  return {
    schema: GLOBAL_IMPORT_SCHEMA,
    version: GLOBAL_IMPORT_VERSION,
    package: {
      name: value.package.name,
      source_language: direction.front,
      target_language: direction.back,
      folders: value.package.folders.map((folder) => ({
        name: folder.name,
        expected_cards: folder.declared_totals.cards,
        lists: folder.lists.map((list) => ({
          name: list.name,
          expected_cards: list.declared_card_count,
          cards: list.cards.map((card) => ({
            front: card.front,
            back: card.back,
            metadata: {
              app_piteco_contract: "1.0",
              front_language: list.front_language,
              back_language: list.back_language,
            },
          })),
        })),
      })),
    },
  };
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

export type NormalizeGlobalImportResult =
  | { success: true; data: NormalizedGlobalImportResult }
  | { success: false; error: NormalizeGlobalImportFailure };

export function normalizeGlobalImportValue(
  value: unknown,
): NormalizeGlobalImportResult {
  const dangerousPath = findDangerousImportKey(value);
  const officialResult = appPitecoSuperImportSchema.safeParse(value);
  const canonicalResult = globalImportSchema.safeParse(value);
  const legacyResult = globalImportPackageSchema.safeParse(value);

  if (dangerousPath) {
    return {
      success: false,
      error: { sourceFormat: "unknown", officialResult, canonicalResult, legacyResult, dangerousPath },
    };
  }

  if (officialResult.success) {
    return {
      success: true,
      data: {
        sourceFormat: "official",
        packageValue: officialToInternal(officialResult.data),
        officialPackage: officialResult.data,
        canonicalPackage: null,
        warnings: [],
      },
    };
  }

  if (canonicalResult.success) {
    return {
      success: true,
      data: {
        sourceFormat: "canonical",
        packageValue: canonicalToInternal(canonicalResult.data),
        officialPackage: null,
        canonicalPackage: canonicalResult.data,
        warnings: [
          "Pacote ape-global-import aceito por compatibilidade. Novos pacotes devem usar app-piteco-super-import 1.0.",
        ],
      },
    };
  }

  if (legacyResult.success) {
    return {
      success: true,
      data: {
        sourceFormat: "legacy",
        packageValue: legacyResult.data,
        officialPackage: null,
        canonicalPackage: null,
        warnings: [
          "Pacote appteco-global-import aceito por compatibilidade. Novos pacotes devem usar app-piteco-super-import 1.0.",
        ],
      },
    };
  }

  const record = value && typeof value === "object" ? value as Record<string, unknown> : null;
  const sourceFormat = record?.schema === APP_PITECO_SUPER_IMPORT_SCHEMA
    ? "official"
    : record?.format === "ape-global-import"
      ? "canonical"
      : record?.schema === GLOBAL_IMPORT_SCHEMA
        ? "legacy"
        : "unknown";

  return {
    success: false,
    error: { sourceFormat, officialResult, canonicalResult, legacyResult, dangerousPath: null },
  };
}

export function requestIdFromUnknown(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const requestId = (value as Record<string, unknown>).request_id;
  return typeof requestId === "string" ? requestId : null;
}
