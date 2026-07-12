import type { SmartImportPackage } from "@/features/smart-import/schema";

const ENRICHED_CARD_FIELDS = [
  "hint",
  "context_tag",
  "example",
  "example_translation",
  "detailed_explanation",
  "usage_notes",
  "common_mistakes",
  "short_observation",
  "word_hints",
  "tags",
] as const;

function hasMeaningfulValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
}

export function richImportRequirements(packageValue: SmartImportPackage): string[] {
  let hasLayers = false;
  let hasGlossary = false;
  let hasEnrichedFields = false;

  for (const folder of packageValue.package.folders) {
    for (const list of folder.lists) {
      if (list.glossary.length > 0) hasGlossary = true;
      for (const card of list.cards) {
        if (card.type === "layered") {
          hasLayers = true;
          for (const layer of card.layers) {
            if (ENRICHED_CARD_FIELDS.some((field) => hasMeaningfulValue(layer[field]))) {
              hasEnrichedFields = true;
            }
          }
          continue;
        }
        if (ENRICHED_CARD_FIELDS.some((field) => hasMeaningfulValue(card[field]))) {
          hasEnrichedFields = true;
        }
      }
    }
  }

  return [
    hasLayers ? "cards em camadas" : null,
    hasGlossary ? "glossário" : null,
    hasEnrichedFields ? "campos enriquecidos" : null,
  ].filter((value): value is string => Boolean(value));
}
