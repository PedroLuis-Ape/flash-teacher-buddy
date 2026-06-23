import type {
  GlobalImportDestinationPlan,
  ImportDestinationCatalog,
  ListDestination,
} from "./destination";
import type { GlobalImportList, GlobalImportPackage } from "./schema";

export type GlobalImportDestinationMode = "existing-folder" | "new-folder" | "from-file";
export type ExistingListConflictPolicy = "append" | "replace" | "rename" | "skip";

export interface DestinationModeConfig {
  mode: GlobalImportDestinationMode;
  existingFolderId?: string;
  newFolderName?: string;
  listConflictPolicy?: ExistingListConflictPolicy;
}

export interface PreparedGlobalImport {
  packageValue: GlobalImportPackage | null;
  plan: GlobalImportDestinationPlan | null;
  warnings: string[];
  errors: string[];
  skippedLists: number;
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function nextAvailableName(baseName: string, usedNames: Set<string>): string {
  if (!usedNames.has(normalize(baseName))) return baseName;
  let number = 2;
  while (usedNames.has(normalize(`${baseName} (${number})`))) number += 1;
  return `${baseName} (${number})`;
}

function cloneList(list: GlobalImportList, name = list.name): GlobalImportList {
  return {
    ...list,
    name,
    cards: list.cards.map((card) => ({ ...card })),
    expected_cards: list.cards.length,
  };
}

export function buildCreateAllDestinationPlan(
  packageValue: GlobalImportPackage,
): GlobalImportDestinationPlan {
  const folders: GlobalImportDestinationPlan["folders"] = {};
  packageValue.package.folders.forEach((folder, folderIndex) => {
    const lists: Record<number, ListDestination> = {};
    folder.lists.forEach((list, listIndex) => {
      lists[listIndex] = { mode: "create", name: list.name };
    });
    folders[folderIndex] = {
      folder: { mode: "create", name: folder.name },
      lists,
    };
  });
  return { folders };
}

export function prepareGlobalImportDestination(
  packageValue: GlobalImportPackage,
  catalog: ImportDestinationCatalog,
  config: DestinationModeConfig,
): PreparedGlobalImport {
  if (config.mode === "from-file") {
    return {
      packageValue,
      plan: buildCreateAllDestinationPlan(packageValue),
      warnings: [],
      errors: [],
      skippedLists: 0,
    };
  }

  const warnings = [
    "Os nomes de pasta presentes no conteúdo serão ignorados porque uma pasta única foi escolhida na interface.",
  ];
  const errors: string[] = [];
  const conflictPolicy = config.listConflictPolicy ?? "rename";
  const incomingLists = packageValue.package.folders.flatMap((folder) => folder.lists);

  let folderName = "";
  let folderTarget: GlobalImportDestinationPlan["folders"][number]["folder"];
  let existingLists: ImportDestinationCatalog["lists"] = [];

  if (config.mode === "existing-folder") {
    const selectedFolder = catalog.folders.find((folder) => folder.id === config.existingFolderId);
    if (!selectedFolder) {
      errors.push("Selecione uma pasta existente válida.");
      return { packageValue: null, plan: null, warnings, errors, skippedLists: 0 };
    }
    folderName = selectedFolder.title;
    folderTarget = { mode: "existing", folderId: selectedFolder.id };
    existingLists = catalog.lists.filter((list) => list.folder_id === selectedFolder.id);
  } else {
    folderName = config.newFolderName?.trim() ?? "";
    if (!folderName) {
      errors.push("Informe o nome da nova pasta.");
      return { packageValue: null, plan: null, warnings, errors, skippedLists: 0 };
    }
    folderTarget = { mode: "create", name: folderName };
  }

  const existingByName = new Map(existingLists.map((list) => [normalize(list.title), list]));
  const usedNames = new Set(existingLists.map((list) => normalize(list.title)));
  const incomingNameCount = new Map<string, number>();
  const preparedLists: GlobalImportList[] = [];
  const listPlan: Record<number, ListDestination> = {};
  let skippedLists = 0;

  incomingLists.forEach((incomingList) => {
    const key = normalize(incomingList.name);
    const occurrence = (incomingNameCount.get(key) ?? 0) + 1;
    incomingNameCount.set(key, occurrence);

    let effectiveName = incomingList.name;
    if (occurrence > 1) {
      effectiveName = nextAvailableName(incomingList.name, usedNames);
      warnings.push(`A lista “${incomingList.name}” apareceu mais de uma vez e será criada como “${effectiveName}” para não misturar os cards.`);
    }

    const existingList = existingByName.get(normalize(effectiveName));
    if (existingList && conflictPolicy === "skip") {
      skippedLists += 1;
      warnings.push(`A lista “${effectiveName}” já existe e será ignorada.`);
      return;
    }

    const nextIndex = preparedLists.length;
    if (existingList && conflictPolicy === "append") {
      listPlan[nextIndex] = { mode: "existing", listId: existingList.id, strategy: "append" };
    } else if (existingList && conflictPolicy === "replace") {
      listPlan[nextIndex] = { mode: "existing", listId: existingList.id, strategy: "replace" };
    } else {
      if (existingList && conflictPolicy === "rename") {
        const renamed = nextAvailableName(effectiveName, usedNames);
        warnings.push(`A lista “${effectiveName}” já existe e será criada como “${renamed}”.`);
        effectiveName = renamed;
      }
      listPlan[nextIndex] = { mode: "create", name: effectiveName };
    }

    usedNames.add(normalize(effectiveName));
    preparedLists.push(cloneList(incomingList, effectiveName));
  });

  if (!preparedLists.length) {
    errors.push("Nenhuma lista restou para importar com a política escolhida.");
    return { packageValue: null, plan: null, warnings, errors, skippedLists };
  }

  const destinations = Object.values(listPlan);
  const listsToCreate = destinations.filter((destination) => destination.mode === "create").length;
  const listsToReuse = destinations.filter((destination) => destination.mode === "existing").length;
  warnings.unshift(
    `Resumo do destino: ${incomingLists.length} lista(s) recebidas; ${preparedLists.length} serão importadas separadamente em “${folderName}” (${listsToCreate} nova(s) e ${listsToReuse} existente(s)).`,
  );

  const totalCards = preparedLists.reduce((sum, list) => sum + list.cards.length, 0);
  const preparedPackage: GlobalImportPackage = {
    ...packageValue,
    package: {
      ...packageValue.package,
      folders: [{
        name: folderName,
        expected_cards: totalCards,
        lists: preparedLists,
      }],
    },
  };

  return {
    packageValue: preparedPackage,
    plan: { folders: { 0: { folder: folderTarget, lists: listPlan } } },
    warnings,
    errors,
    skippedLists,
  };
}
