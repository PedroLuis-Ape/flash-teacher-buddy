import type { GlobalImportPackage } from "./schema";

export interface ExistingImportFolder {
  id: string;
  title: string;
}

export interface ExistingImportList {
  id: string;
  title: string;
  folder_id: string;
}

export type FolderDestination =
  | { mode: "create"; name: string }
  | { mode: "existing"; folderId: string };

export type ListDestination =
  | { mode: "create"; name: string }
  | { mode: "existing"; listId: string };

export interface FolderDestinationPlan {
  folder: FolderDestination;
  lists: Record<number, ListDestination>;
}

export interface GlobalImportDestinationPlan {
  folders: Record<number, FolderDestinationPlan>;
}

export interface ImportDestinationCatalog {
  folders: ExistingImportFolder[];
  lists: ExistingImportList[];
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function loadImportDestinationCatalog(): Promise<ImportDestinationCatalog> {
  const module = await import("./destinationCatalog");
  return module.loadImportDestinationCatalog();
}

export function buildDefaultDestinationPlan(
  packageValue: GlobalImportPackage,
  catalog: ImportDestinationCatalog,
): GlobalImportDestinationPlan {
  const folderByName = new Map(catalog.folders.map((folder) => [normalize(folder.title), folder]));
  const listsByFolder = new Map<string, ExistingImportList[]>();
  for (const list of catalog.lists) {
    const current = listsByFolder.get(list.folder_id) ?? [];
    current.push(list);
    listsByFolder.set(list.folder_id, current);
  }

  const folders: Record<number, FolderDestinationPlan> = {};

  packageValue.package.folders.forEach((incomingFolder, folderIndex) => {
    const exactFolder = folderByName.get(normalize(incomingFolder.name));
    const folderTarget: FolderDestination = exactFolder
      ? { mode: "existing", folderId: exactFolder.id }
      : { mode: "create", name: incomingFolder.name };

    const lists: Record<number, ListDestination> = {};
    incomingFolder.lists.forEach((incomingList, listIndex) => {
      if (!exactFolder) {
        lists[listIndex] = { mode: "create", name: incomingList.name };
        return;
      }
      const exactList = (listsByFolder.get(exactFolder.id) ?? [])
        .find((list) => normalize(list.title) === normalize(incomingList.name));
      lists[listIndex] = exactList
        ? { mode: "existing", listId: exactList.id }
        : { mode: "create", name: incomingList.name };
    });

    folders[folderIndex] = { folder: folderTarget, lists };
  });

  return { folders };
}

export function validateDestinationPlan(
  packageValue: GlobalImportPackage,
  catalog: ImportDestinationCatalog,
  plan: GlobalImportDestinationPlan,
): string[] {
  const errors: string[] = [];
  const folderIds = new Set(catalog.folders.map((folder) => folder.id));
  const listById = new Map(catalog.lists.map((list) => [list.id, list]));

  packageValue.package.folders.forEach((folder, folderIndex) => {
    const folderPlan = plan.folders[folderIndex];
    if (!folderPlan) {
      errors.push(`package.folders[${folderIndex}]: destino da pasta não definido.`);
      return;
    }

    if (folderPlan.folder.mode === "existing" && !folderIds.has(folderPlan.folder.folderId)) {
      errors.push(`package.folders[${folderIndex}]: pasta existente inválida.`);
    }
    if (folderPlan.folder.mode === "create" && !folderPlan.folder.name.trim()) {
      errors.push(`package.folders[${folderIndex}]: nome da nova pasta vazio.`);
    }

    folder.lists.forEach((_, listIndex) => {
      const listPlan = folderPlan.lists[listIndex];
      if (!listPlan) {
        errors.push(`package.folders[${folderIndex}].lists[${listIndex}]: destino da lista não definido.`);
        return;
      }
      if (listPlan.mode === "create" && !listPlan.name.trim()) {
        errors.push(`package.folders[${folderIndex}].lists[${listIndex}]: nome da nova lista vazio.`);
      }
      if (listPlan.mode === "existing") {
        const list = listById.get(listPlan.listId);
        if (!list) {
          errors.push(`package.folders[${folderIndex}].lists[${listIndex}]: lista existente inválida.`);
        } else if (folderPlan.folder.mode === "create") {
          errors.push(`package.folders[${folderIndex}].lists[${listIndex}]: não é possível usar lista existente dentro de uma pasta que ainda será criada.`);
        } else if (list.folder_id !== folderPlan.folder.folderId) {
          errors.push(`package.folders[${folderIndex}].lists[${listIndex}]: a lista não pertence à pasta selecionada.`);
        }
      }
    });
  });

  return errors;
}
