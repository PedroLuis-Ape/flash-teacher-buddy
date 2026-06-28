import type { SmartImportPackage } from "@/features/smart-import/schema";
import {
  buildExistingListImportPlan,
  existingListTargetFromCatalog,
  type ExistingListImportPreparation,
} from "./existingListImportPlan";
import type { GlobalImportDestinationPlan, ImportDestinationCatalog } from "./destination";
import type { GlobalImportPackage } from "./schema";

export type QuickListStrategy = "append" | "replace";

/** Multiple folders and lists are valid: all source lists are consolidated. */
export function quickImportStructureError(_packageValue: GlobalImportPackage | null): string | null {
  return null;
}

export function buildQuickListDestinationPlan(
  packageValue: GlobalImportPackage,
  folderId: string,
  listId: string,
  strategy: QuickListStrategy,
): GlobalImportDestinationPlan | null {
  if (!packageValue || !folderId || !listId) return null;

  let firstSourceList = true;
  const folders: GlobalImportDestinationPlan["folders"] = {};
  packageValue.package.folders.forEach((folder, folderIndex) => {
    const lists: GlobalImportDestinationPlan["folders"][number]["lists"] = {};
    folder.lists.forEach((_, listIndex) => {
      lists[listIndex] = {
        mode: "existing",
        listId,
        strategy: strategy === "replace" && firstSourceList ? "replace" : "append",
        consolidate: true,
      };
      firstSourceList = false;
    });
    folders[folderIndex] = {
      folder: { mode: "existing", folderId },
      lists,
    };
  });

  return { folders };
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
