import {
  withSmartDeclaredTotals,
  type SmartImportPackage,
  type SmartNormalCard,
} from "@/features/smart-import/schema";

export interface FlattenSuperImportLayersResult {
  packageValue: SmartImportPackage;
  groupsFlattened: number;
  cardsCreated: number;
}

/**
 * The Super Importer no longer creates layered groups automatically.
 * Legacy/generated layered payloads are converted into independent normal
 * cards so the user can review and merge them manually from the list screen.
 */
export function flattenSuperImportLayers(
  value: SmartImportPackage,
): FlattenSuperImportLayersResult {
  let groupsFlattened = 0;
  let cardsCreated = 0;

  const folders = value.package.folders.map((folder) => {
    let folderChanged = false;
    const lists = folder.lists.map((list) => {
      if (!list.cards.some((card) => card.type === "layered")) return list;

      folderChanged = true;
      const cards = list.cards.flatMap<SmartNormalCard>((card) => {
        if (card.type === "normal") return [card];

        groupsFlattened += 1;
        cardsCreated += card.layers.length;

        return card.layers.map((layer) => ({
          ...layer,
          type: "normal" as const,
          context_tag: layer.context_tag ?? card.group_title,
        }));
      });

      return { ...list, cards };
    });

    return folderChanged ? { ...folder, lists } : folder;
  });

  if (groupsFlattened === 0) {
    return { packageValue: value, groupsFlattened: 0, cardsCreated: 0 };
  }

  const { declared_totals: staleTotals, ...withoutTotals } = value;
  void staleTotals;
  const packageValue = withSmartDeclaredTotals({
    ...withoutTotals,
    package: {
      ...value.package,
      folders,
    },
  });

  return { packageValue, groupsFlattened, cardsCreated };
}
