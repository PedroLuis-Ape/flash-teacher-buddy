import type { GlobalImportPackage } from "./schema";
import {
  formatImportLanguageMismatch,
  resolveImportLanguageCompatibility,
  resolveIncomingListDirection,
} from "./languageCompatibility";

export interface ExistingImportFolder {
  id: string;
  title: string;
  reference_id?: string | null;
  institution_id?: string | null;
  class_id?: string | null;
  lang_a?: string | null;
  lang_b?: string | null;
  labels_a?: string | null;
  labels_b?: string | null;
  study_type?: string | null;
  tts_enabled?: boolean | null;
}

export interface ExistingImportList {
  id: string;
  title: string;
  folder_id: string;
  reference_id?: string | null;
  class_id?: string | null;
  lang_a?: string | null;
  lang_b?: string | null;
  labels_a?: string | null;
  labels_b?: string | null;
  study_type?: string | null;
  tts_enabled?: boolean | null;
  system_kind?: string | null;
  language_settings_mode?: "explicit" | "inherited" | "legacy" | null;
}

export type FolderDestination =
  | { mode: "create"; name: string }
  | { mode: "existing"; folderId: string };

export type ListDestination =
  | { mode: "create"; name: string }
  | { mode: "existing"; listId: string; strategy?: "append" | "replace"; consolidate?: boolean }
  | { mode: "skip" };

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

export type ImportDestinationContext =
  | { scope: "personal"; institutionId: string | null }
  | { scope: "classroom"; turmaId: string };

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function loadImportDestinationCatalog(
  context: ImportDestinationContext,
): Promise<ImportDestinationCatalog> {
  const module = await import("./destinationCatalog");
  return module.loadImportDestinationCatalog(context);
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
  const folderById = new Map(catalog.folders.map((folder) => [folder.id, folder]));
  const listById = new Map(catalog.lists.map((list) => [list.id, list]));
  const targetedExistingLists = new Map<string, boolean>();
  let importableLists = 0;

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

    folder.lists.forEach((incomingList, listIndex) => {
      const listPlan = folderPlan.lists[listIndex];
      if (!listPlan) {
        errors.push(`package.folders[${folderIndex}].lists[${listIndex}]: destino da lista não definido.`);
        return;
      }
      if (listPlan.mode === "skip") return;
      importableLists += 1;
      if (listPlan.mode === "create" && !listPlan.name.trim()) {
        errors.push(`package.folders[${folderIndex}].lists[${listIndex}]: nome da nova lista vazio.`);
      }
      if (listPlan.mode === "existing") {
        if (listPlan.strategy !== undefined && listPlan.strategy !== "append" && listPlan.strategy !== "replace") {
          errors.push(`package.folders[${folderIndex}].lists[${listIndex}]: ação da lista existente inválida.`);
        }
        const list = listById.get(listPlan.listId);
        if (!list) {
          errors.push(`package.folders[${folderIndex}].lists[${listIndex}]: lista existente inválida.`);
        } else if (folderPlan.folder.mode === "create") {
          errors.push(`package.folders[${folderIndex}].lists[${listIndex}]: não é possível usar lista existente dentro de uma pasta que ainda será criada.`);
        } else if (list.folder_id !== folderPlan.folder.folderId) {
          errors.push(`package.folders[${folderIndex}].lists[${listIndex}]: a lista não pertence à pasta selecionada.`);
        }

        const previousConsolidated = targetedExistingLists.get(listPlan.listId);
        if (previousConsolidated !== undefined && !(previousConsolidated && listPlan.consolidate)) {
          errors.push(`package.folders[${folderIndex}].lists[${listIndex}]: a mesma lista existente não pode receber duas listas importadas sem o modo de consolidação.`);
        }
        targetedExistingLists.set(listPlan.listId, Boolean(listPlan.consolidate));

        // Every path that targets an existing list must obey the same A/B
        // contract. `consolidate` only controls many-lists-to-one semantics; it
        // must never decide whether language compatibility is validated.
        if (list) {
          const direction = resolveIncomingListDirection(incomingList, packageValue);
          if (direction) {
            const targetFolder = folderById.get(list.folder_id);
            const compatibility = resolveImportLanguageCompatibility(
              direction,
              list,
              targetFolder,
            );
            if (!compatibility.compatible) {
              errors.push(formatImportLanguageMismatch(compatibility));
            }
          }
        }
      }
    });
  });

  if (importableLists === 0) errors.push("Escolha pelo menos uma lista para importar.");

  return Array.from(new Set(errors));
}
