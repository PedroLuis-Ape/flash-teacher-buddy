import type { SmartImportPackage } from "@/features/smart-import/schema";
import type { GlobalImportIssue } from "./checks";

function hasJoinedAlternatives(value: string): boolean {
  return value.includes(" / ") || value.includes(" | ");
}

function checkSides(
  card: { front: string; back: string },
  path: string,
): GlobalImportIssue[] {
  const issues: GlobalImportIssue[] = [];

  if (hasJoinedAlternatives(card.front)) {
    issues.push({
      severity: "warning",
      path: `${path}.front`,
      code: "W_JOINED_OPTIONS",
      message: "O lado A contém alternativas unidas. Use uma resposta principal e short_observation, ou camadas para sentidos diferentes.",
    });
  }

  if (hasJoinedAlternatives(card.back)) {
    issues.push({
      severity: "warning",
      path: `${path}.back`,
      code: "W_JOINED_OPTIONS",
      message: "O lado B contém alternativas unidas. Use uma resposta principal e short_observation, ou camadas para sentidos diferentes.",
    });
  }

  return issues;
}

function cardPath(folder: number, list: number, card: number, layer?: number): string {
  const base = `package.folders[${folder}].lists[${list}].cards[${card}]`;
  return layer === undefined ? base : `${base}.layers[${layer}]`;
}

export function buildLayerChecks(value: SmartImportPackage): GlobalImportIssue[] {
  const issues: GlobalImportIssue[] = [];
  const reservedTitles = ["português", "inglês", "afirmativo", "negativo", "interrogativo"];

  value.package.folders.forEach((folder, folderIndex) => {
    folder.lists.forEach((list, listIndex) => {
      list.cards.forEach((card, cardIndex) => {
        if (card.type === "normal") {
          issues.push(...checkSides(card, cardPath(folderIndex, listIndex, cardIndex)));
          return;
        }

        const basePath = cardPath(folderIndex, listIndex, cardIndex);
        const title = card.group_title.trim().toLowerCase();
        if (title.split(/\s+/).length > 6 || reservedTitles.includes(title)) {
          issues.push({
            severity: "warning",
            path: `${basePath}.group_title`,
            code: "W_LAYER_TITLE",
            message: "O título do grupo deve ser o termo-base estudado, como turn up, get ou may.",
          });
        }

        card.layers.forEach((layer, layerIndex) => {
          issues.push(...checkSides(layer, cardPath(folderIndex, listIndex, cardIndex, layerIndex)));
        });
      });
    });
  });

  return issues;
}
