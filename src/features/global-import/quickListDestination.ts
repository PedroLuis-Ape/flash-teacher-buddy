import type { GlobalImportDestinationPlan } from "./destination";
import type { GlobalImportPackage } from "./schema";

export type QuickListStrategy = "append" | "replace";

export function quickImportStructureError(packageValue: GlobalImportPackage | null): string | null {
  if (!packageValue) return null;
  const folders = packageValue.package.folders;
  const lists = folders.reduce((total, folder) => total + folder.lists.length, 0);
  if (folders.length !== 1 || lists !== 1) {
    return `A importação rápida aceita exatamente uma pasta e uma lista. Este pacote possui ${folders.length} pasta(s) e ${lists} lista(s). Use a importação estruturada.`;
  }
  return null;
}

export function buildQuickListDestinationPlan(
  packageValue: GlobalImportPackage,
  folderId: string,
  listId: string,
  strategy: QuickListStrategy,
): GlobalImportDestinationPlan | null {
  if (quickImportStructureError(packageValue) || !folderId || !listId) return null;
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
