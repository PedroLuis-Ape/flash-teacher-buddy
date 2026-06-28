import { resolveEffectiveListSettings } from "@/features/study/lib/resolveStudySides";
import type { GlobalImportPackage } from "./schema";

export interface ExistingImportFolder {
  id: string;
  title: string;
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
  lang_a?: string | null;
  lang_b?: string | null;
  labels_a?: string | null;
  labels_b?: string | null;
  study_type?: string | null;
  tts_enabled?: boolean | null;
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

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeLanguage(value: string): string {
  const normalized = value
    .trim()
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/_/g, "-");
  const aliases: Record<string, string> = {
    english: "en", ingles: "en",
    portuguese: "pt", portugues: "pt",
    spanish: "es", espanhol: "es",
    french: "fr", frances: "fr",
    german: "de", alemao: "de",
    italian: "it", italiano: "it",
  };
  return aliases[normalized] ?? normalized.split("-")[0];
}

export async function loadImportDestinationCatalog(
  turmaId?: string | null,
): Promise<ImportDestinationCatalog> {
  const module = await import("./destinationCatalog");
  return module.loadImportDestinationCatalog(turmaId);
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
      if (listPlan.mode === "skip") return;
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

        const previousConsolidated = targetedExistingLists.get(listPlan.listId);
        if (previousConsolidated !== undefined && !(previousConsolidated && listPlan.consolidate)) {
          errors.push(`package.folders[${folderIndex}].lists[${listIndex}]: a mesma lista existente não pode receber duas listas importadas sem o modo de consolidação.`);
        }
        targetedExistingLists.set(listPlan.listId, Boolean(listPlan.consolidate));

        if (list && listPlan.consolidate && packageValue.package.source_language && packageValue.package.target_language) {
          const targetFolder = folderById.get(list.folder_id);
          const effective = resolveEffectiveListSettings(list, targetFolder);
          const incompatible = normalizeLanguage(packageValue.package.source_language) !== normalizeLanguage(effective.langA)
            || normalizeLanguage(packageValue.package.target_language) !== normalizeLanguage(effective.langB);
          if (incompatible) {
            errors.push("Os lados do pacote não correspondem aos lados da lista escolhida. Revise o mapeamento antes de importar.");
          }
        }
      }
    });
  });

  return Array.from(new Set(errors));
}
