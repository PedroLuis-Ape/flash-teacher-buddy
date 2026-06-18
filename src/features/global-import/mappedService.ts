import { supabase } from "@/integrations/supabase/client";
import type { GlobalImportCard, GlobalImportPackage } from "./schema";
import type {
  GlobalImportDestinationPlan,
  ImportDestinationCatalog,
} from "./destination";
import { GLOBAL_IMPORT_V2_ENABLED } from "./featureFlag";
import {
  globalImportSchema,
  type CanonicalGlobalImportPackage,
  type GlobalImportNormalCard,
} from "./schema/globalImportSchema";
import {
  APP_PITECO_SUPER_IMPORT_SCHEMA,
  APP_PITECO_SUPER_IMPORT_VERSION,
  appPitecoSuperImportSchema,
  type AppPitecoSuperImportPackage,
} from "./schema/appPitecoSuperImportSchema";
import { updateGlobalImportManifestStatus } from "./manifest";

export type CardConflictPolicy = "skip" | "copy" | "error";

export interface ExecuteMappedImportOptions {
  requestId?: string;
  officialPackage?: AppPitecoSuperImportPackage | null;
  canonicalPackage?: CanonicalGlobalImportPackage | null;
  destinationPlan: GlobalImportDestinationPlan;
  catalog: ImportDestinationCatalog;
  cardConflict: CardConflictPolicy;
  institutionId?: string | null;
  onProgress?: (completed: number, total: number, label: string) => void;
}

export interface GlobalImportExecutionReport {
  batch_id: string;
  request_id: string;
  status: "completed" | "undone";
  package_name: string;
  folders_created: number;
  folders_reused: number;
  lists_created: number;
  lists_reused: number;
  lists_replaced?: number;
  lists_skipped?: number;
  cards_created: number;
  cards_skipped: number;
  schema?: "app-piteco-super-import";
  version?: "1.0";
  format?: "ape-global-import";
  schema_version?: 1;
}

const memoryRequestIds = new Map<string, string>();

function countCards(packageValue: GlobalImportPackage): number {
  return packageValue.package.folders.reduce(
    (folderTotal, folder) => folderTotal + folder.lists.reduce(
      (listTotal, list) => listTotal + list.cards.length,
      0,
    ),
    0,
  );
}

function normalizedCardKey(term: string, translation: string): string {
  return `${term.trim().toLocaleLowerCase()}\u0000${translation.trim().toLocaleLowerCase()}`;
}

function directionFromCard(card?: GlobalImportCard): { front: string; back: string } | null {
  const metadata = card?.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  if (metadata.app_piteco_contract !== "1.0") return null;
  const front = metadata.front_language;
  const back = metadata.back_language;
  return typeof front === "string" && typeof back === "string" ? { front, back } : null;
}

function canonicalForEffectivePackage(
  source: CanonicalGlobalImportPackage,
  packageValue: GlobalImportPackage,
): CanonicalGlobalImportPackage {
  const cardPools = new Map<string, GlobalImportNormalCard[]>();
  source.package.folders.forEach((folder) => {
    folder.lists.forEach((list) => {
      list.cards.forEach((card) => {
        const key = normalizedCardKey(card.term, card.translation);
        const pool = cardPools.get(key) ?? [];
        pool.push(card);
        cardPools.set(key, pool);
      });
    });
  });

  const folders = packageValue.package.folders.map((folder, folderIndex) => ({
    title: folder.name,
    description: folder.description ?? null,
    order_index: folderIndex,
    expected_list_count: folder.lists.length,
    expected_card_count: folder.lists.reduce((sum, list) => sum + list.cards.length, 0),
    lists: folder.lists.map((list, listIndex) => ({
      title: list.name,
      description: list.description ?? null,
      order_index: listIndex,
      expected_card_count: list.cards.length,
      cards: list.cards.map((card) => {
        const key = normalizedCardKey(card.front, card.back);
        const original = cardPools.get(key)?.shift();
        return {
          type: "normal" as const,
          term: card.front,
          translation: card.back,
          hint: original?.hint ?? card.hint ?? null,
          example_text: original?.example_text ?? card.example ?? null,
          example_translation: original?.example_translation ?? card.example_translation ?? null,
          detailed_explanation: original?.detailed_explanation ?? null,
          usage_notes: original?.usage_notes ?? null,
          common_mistakes: original?.common_mistakes ?? null,
        };
      }),
    })),
  }));
  const listCount = folders.reduce((sum, folder) => sum + folder.lists.length, 0);
  const cardCount = folders.reduce((sum, folder) => sum + folder.expected_card_count, 0);

  return globalImportSchema.parse({
    format: source.format,
    schema_version: source.schema_version,
    request_id: source.request_id,
    package: {
      title: packageValue.package.name,
      description: source.package.description ?? null,
      study_settings: source.package.study_settings,
      expected_folder_count: folders.length,
      expected_list_count: listCount,
      expected_card_count: cardCount,
      folders,
    },
  });
}

function officialForEffectivePackage(
  source: AppPitecoSuperImportPackage,
  packageValue: GlobalImportPackage,
): AppPitecoSuperImportPackage {
  const directionByCard = new Map<string, Array<{ front: string; back: string }>>();
  source.package.folders.forEach((folder) => {
    folder.lists.forEach((list) => {
      list.cards.forEach((card) => {
        const key = normalizedCardKey(card.front, card.back);
        const pool = directionByCard.get(key) ?? [];
        pool.push({ front: list.front_language, back: list.back_language });
        directionByCard.set(key, pool);
      });
    });
  });
  const fallback = {
    front: source.package.folders[0]?.lists[0]?.front_language ?? "en",
    back: source.package.folders[0]?.lists[0]?.back_language ?? "pt-BR",
  };

  const folders = packageValue.package.folders.map((folder) => {
    const lists = folder.lists.map((list) => {
      const firstCard = list.cards[0];
      const fromMetadata = directionFromCard(firstCard);
      const matched = firstCard
        ? directionByCard.get(normalizedCardKey(firstCard.front, firstCard.back))?.shift()
        : null;
      const direction = fromMetadata ?? matched ?? fallback;
      return {
        name: list.name,
        front_language: direction.front,
        back_language: direction.back,
        declared_card_count: list.cards.length,
        cards: list.cards.map((card) => ({ front: card.front, back: card.back })),
      };
    });
    return {
      name: folder.name,
      declared_totals: {
        lists: lists.length,
        cards: lists.reduce((sum, list) => sum + list.cards.length, 0),
      },
      lists,
    };
  });

  return appPitecoSuperImportSchema.parse({
    schema: APP_PITECO_SUPER_IMPORT_SCHEMA,
    version: APP_PITECO_SUPER_IMPORT_VERSION,
    declared_totals: {
      folders: folders.length,
      lists: folders.reduce((sum, folder) => sum + folder.lists.length, 0),
      cards: folders.reduce((sum, folder) => sum + folder.declared_totals.cards, 0),
    },
    package: {
      name: packageValue.package.name,
      folders,
    },
  });
}

function officialFromInternalPackage(packageValue: GlobalImportPackage): AppPitecoSuperImportPackage | null {
  const folders: AppPitecoSuperImportPackage["package"]["folders"] = [];

  for (const folder of packageValue.package.folders) {
    const lists: AppPitecoSuperImportPackage["package"]["folders"][number]["lists"] = [];
    for (const list of folder.lists) {
      const direction = directionFromCard(list.cards[0]);
      if (!direction) return null;

      lists.push({
        name: list.name,
        front_language: direction.front,
        back_language: direction.back,
        declared_card_count: list.cards.length,
        cards: list.cards.map((card) => ({ front: card.front, back: card.back })),
      });
    }
    folders.push({
      name: folder.name,
      declared_totals: {
        lists: lists.length,
        cards: lists.reduce((sum, list) => sum + list.cards.length, 0),
      },
      lists,
    });
  }

  return appPitecoSuperImportSchema.parse({
    schema: APP_PITECO_SUPER_IMPORT_SCHEMA,
    version: APP_PITECO_SUPER_IMPORT_VERSION,
    declared_totals: {
      folders: folders.length,
      lists: folders.reduce((sum, folder) => sum + folder.lists.length, 0),
      cards: folders.reduce((sum, folder) => sum + folder.declared_totals.cards, 0),
    },
    package: { name: packageValue.package.name, folders },
  });
}

function requestStorageKey(
  packageValue: GlobalImportPackage,
  options: ExecuteMappedImportOptions,
): string {
  const text = JSON.stringify({
    packageValue,
    destinationPlan: options.destinationPlan,
    cardConflict: options.cardConflict,
    institutionId: options.institutionId ?? null,
  });
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `global-import-request:${(hash >>> 0).toString(16)}`;
}

function getOrCreateRequestId(
  packageValue: GlobalImportPackage,
  options: ExecuteMappedImportOptions,
): { requestId: string; storageKey: string } {
  const storageKey = requestStorageKey(packageValue, options);
  if (options.requestId) return { requestId: options.requestId, storageKey };

  const stored = typeof window !== "undefined"
    ? window.sessionStorage.getItem(storageKey)
    : memoryRequestIds.get(storageKey) ?? null;
  if (stored) return { requestId: stored, storageKey };

  const requestId = crypto.randomUUID();
  if (typeof window !== "undefined") window.sessionStorage.setItem(storageKey, requestId);
  else memoryRequestIds.set(storageKey, requestId);
  return { requestId, storageKey };
}

function clearRequestId(storageKey: string): void {
  if (typeof window !== "undefined") window.sessionStorage.removeItem(storageKey);
  memoryRequestIds.delete(storageKey);
}

export async function executeMappedGlobalImport(
  packageValue: GlobalImportPackage,
  options: ExecuteMappedImportOptions,
): Promise<GlobalImportExecutionReport> {
  const totalCards = countCards(packageValue);
  const officialSource = options.officialPackage ?? officialFromInternalPackage(packageValue);
  const official = officialSource
    ? officialForEffectivePackage(officialSource, packageValue)
    : null;
  const canonical = !official && GLOBAL_IMPORT_V2_ENABLED && options.canonicalPackage
    ? canonicalForEffectivePackage(options.canonicalPackage, packageValue)
    : null;
  if (canonical && options.requestId && options.requestId !== canonical.request_id) {
    throw new Error("O request_id informado não corresponde ao pacote canônico.");
  }

  const request = canonical
    ? { requestId: canonical.request_id, storageKey: "" }
    : getOrCreateRequestId(packageValue, options);
  options.onProgress?.(0, totalCards, "Enviando pacote para uma transação segura");

  const functionName = official
    ? "import_app_piteco_super_package_v1"
    : canonical
      ? "import_global_package_v2"
      : "import_global_package_v1";
  const payload = official ?? canonical ?? packageValue;
  const { data, error } = await (supabase.rpc as any)(functionName, {
    _request_id: request.requestId,
    _payload: payload,
    _destination_plan: options.destinationPlan,
    _card_conflict: options.cardConflict,
    _institution_id: options.institutionId ?? null,
  });

  if (error) throw error;
  if (!data || typeof data !== "object") {
    throw new Error("O banco não devolveu o relatório da importação.");
  }

  if (canonical) updateGlobalImportManifestStatus(canonical.request_id, "imported");
  if (!canonical) clearRequestId(request.storageKey);
  options.onProgress?.(totalCards, totalCards, "Importação concluída");
  return data as GlobalImportExecutionReport;
}

export async function undoGlobalImport(batchId: string): Promise<void> {
  const { error } = await (supabase.rpc as any)("undo_global_import_v1", {
    _batch_id: batchId,
  });
  if (error) throw error;
}
