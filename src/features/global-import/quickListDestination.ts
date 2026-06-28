import type { SmartImportPackage } from "@/features/smart-import/schema";
import {
  buildExistingListImportPlan,
  existingListTargetFromCatalog,
  type ExistingListImportPreparation,
} from "./existingListImportPlan";
import type { GlobalImportDestinationPlan, ImportDestinationCatalog } from "./destination";
import type { GlobalImportPackage } from "./schema";

export type QuickListStrategy = "append" | "replace";

/**
 * Kept for backwards compatibility with older callers. Multiple folders and
 * lists are now valid because they are consolidated before execution.
 */
export function quickImportStructureError(_packageValue: GlobalImportPackage | null): string | null {
  return null;
}

/**
 * Legacy single-list mapper. New code should use
 * buildQuickExistingListPreparation so no source list can be discarded.
 */
export function buildQuickListDestinationPlan(
  packageValue: GlobalImportPackage,
  folderId: string,
  listId: string,
  strategy: QuickListStrategy,
): GlobalImportDestinationPlan | null {
  if (!packageValue || !folderId || !listId) return null;
  const folders = packageValue.package.folders;
  const lists = folders.reduce((total, folder) => total + folder.lists.length, 0);
  if (folders.length !== 1 || lists !== 1) return null;
  return {
    folders: {
      0: {
        folder: { mode: "existing", folderId },
        lists: {
          0: { mode: "existing", listId, strategy },
        },
      },
    },
  };
}

export function buildQuickExistingListPreparation(
  source: SmartImportPackage,
  catalog: ImportDestinationCatalog,
  listId: string,
  strategy: QuickListStrategy,
): ExistingListImportPreparation | null {
  const target = existingListTargetFromCatalog(catalog, listId);
  return target ? buildExistingListImportPlan(source, target, strategy) : null;
}
