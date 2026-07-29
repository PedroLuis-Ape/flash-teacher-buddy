import type {
  GlobalImportDestinationPlan,
  ImportDestinationCatalog,
} from "./destination";
import type { GlobalImportPackage } from "./schema";

export interface DestinationSummaryItem {
  key: string;
  sourceListName: string;
  destinationFolderName: string;
  destinationListName: string | null;
  action: "create" | "append" | "replace" | "skip";
  cards: number;
}

export interface GlobalImportDestinationSummary {
  items: DestinationSummaryItem[];
  foldersCreated: number;
  listsCreated: number;
  listsUpdated: number;
  listsReplaced: number;
  listsSkipped: number;
  cardsImported: number;
  replacementListNames: string[];
}

export function summarizeDestinationPlan(
  packageValue: GlobalImportPackage,
  catalog: ImportDestinationCatalog,
  plan: GlobalImportDestinationPlan,
): GlobalImportDestinationSummary {
  const folderById = new Map(catalog.folders.map((folder) => [folder.id, folder]));
  const listById = new Map(catalog.lists.map((list) => [list.id, list]));
  const createdFolderIndexes = new Set<number>();
  const replacementListNames = new Set<string>();
  const items: DestinationSummaryItem[] = [];
  let listsCreated = 0;
  let listsUpdated = 0;
  let listsReplaced = 0;
  let listsSkipped = 0;
  let cardsImported = 0;

  packageValue.package.folders.forEach((folder, folderIndex) => {
    const folderPlan = plan.folders[folderIndex];
    if (!folderPlan) return;
    const destinationFolderName = folderPlan.folder.mode === "create"
      ? folderPlan.folder.name
      : folderById.get(folderPlan.folder.folderId)?.title ?? "Pasta indisponível";

    folder.lists.forEach((list, listIndex) => {
      const destination = folderPlan.lists[listIndex];
      if (!destination) return;
      const cards = list.cards.length;
      if (destination.mode === "skip") {
        listsSkipped += 1;
        items.push({
          key: `${folderIndex}:${listIndex}`,
          sourceListName: list.name,
          destinationFolderName,
          destinationListName: null,
          action: "skip",
          cards,
        });
        return;
      }

      cardsImported += cards;
      if (folderPlan.folder.mode === "create") createdFolderIndexes.add(folderIndex);

      if (destination.mode === "create") {
        listsCreated += 1;
        items.push({
          key: `${folderIndex}:${listIndex}`,
          sourceListName: list.name,
          destinationFolderName,
          destinationListName: destination.name,
          action: "create",
          cards,
        });
        return;
      }

      const destinationListName = listById.get(destination.listId)?.title ?? "Lista indisponível";
      const action = destination.strategy === "replace" ? "replace" : "append";
      listsUpdated += 1;
      if (action === "replace") {
        listsReplaced += 1;
        replacementListNames.add(destinationListName);
      }
      items.push({
        key: `${folderIndex}:${listIndex}`,
        sourceListName: list.name,
        destinationFolderName,
        destinationListName,
        action,
        cards,
      });
    });
  });

  return {
    items,
    foldersCreated: createdFolderIndexes.size,
    listsCreated,
    listsUpdated,
    listsReplaced,
    listsSkipped,
    cardsImported,
    replacementListNames: Array.from(replacementListNames),
  };
}
