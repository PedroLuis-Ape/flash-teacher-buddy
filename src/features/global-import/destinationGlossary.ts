import {
  summarizeSmartImport,
  type SmartImportPackage,
} from "@/features/smart-import/schema";
import type { GlobalImportDestinationPlan } from "./destination";

/**
 * Keeps the glossary transaction aligned with the same per-list decision used
 * by the card transaction. Lists remain in place so folder/list indexes still
 * match the persisted destination plan.
 */
export function glossaryPackageForDestinationPlan(
  packageValue: SmartImportPackage,
  destinationPlan: GlobalImportDestinationPlan,
): SmartImportPackage {
  const filtered = JSON.parse(JSON.stringify(packageValue)) as SmartImportPackage;

  filtered.package.folders.forEach((folder, folderIndex) => {
    folder.lists.forEach((list, listIndex) => {
      if (destinationPlan.folders[folderIndex]?.lists[listIndex]?.mode === "skip") {
        list.glossary = [];
      }
    });
  });

  if (filtered.declared_totals) {
    filtered.declared_totals.glossary_entries = summarizeSmartImport(filtered).glossaryEntries;
  }

  return filtered;
}
