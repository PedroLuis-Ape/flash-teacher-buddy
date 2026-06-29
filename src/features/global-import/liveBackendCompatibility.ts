import { flattenSmartCards } from "@/features/smart-import/adapters";
import type { SmartImportPackage } from "@/features/smart-import/schema";
import {
  appPitecoSuperImportSchema,
  type AppPitecoSuperImportPackage,
} from "./schema/appPitecoSuperImportSchema";

function duplicateKey(front: string, back: string): string {
  return `${front.trim().toLocaleLowerCase()}\u0000${back.trim().toLocaleLowerCase()}`;
}

/**
 * Converts the rich 2.0 package into the strict official 1.0 contract exposed
 * by the current live backend. Rich metadata and glossary entries are kept in
 * the source package for newer engines, but the compatibility RPC receives
 * only the front/back card pairs accepted by v1.
 */
export function smartImportToOfficialV1Package(
  value: SmartImportPackage,
): AppPitecoSuperImportPackage {
  let totalLists = 0;
  let totalCards = 0;

  const folders = value.package.folders.map((folder) => {
    const lists = folder.lists.map((list) => {
      const seen = new Set<string>();
      const cards = flattenSmartCards(list.cards).flatMap((card) => {
        const front = card.front.trim();
        const back = card.back.trim();
        const key = duplicateKey(front, back);
        if (seen.has(key)) return [];
        seen.add(key);
        return [{ front, back }];
      });

      if (!cards.length) {
        throw new Error(`A lista “${list.name}” não possui cards compatíveis com o motor 1.0.`);
      }

      totalLists += 1;
      totalCards += cards.length;
      return {
        name: list.name,
        front_language: list.front_language,
        back_language: list.back_language,
        declared_card_count: cards.length,
        cards,
      };
    });

    const folderCards = lists.reduce((sum, list) => sum + list.cards.length, 0);
    return {
      name: folder.name,
      declared_totals: {
        lists: lists.length,
        cards: folderCards,
      },
      lists,
    };
  });

  return appPitecoSuperImportSchema.parse({
    schema: "app-piteco-super-import",
    version: "1.0",
    declared_totals: {
      folders: folders.length,
      lists: totalLists,
      cards: totalCards,
    },
    package: {
      name: value.package.name,
      folders,
    },
  });
}
