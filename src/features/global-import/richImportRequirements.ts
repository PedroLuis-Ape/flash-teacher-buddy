import type { SmartImportPackage } from "@/features/smart-import/schema";
import { detectFlashcardPackageFeatures } from "@/features/smart-import/packageFeatures";

/**
 * Requirements that must be present before a legacy/basic gateway can be used.
 * Embedded glossary is intentionally not returned: it is auxiliary and must
 * never turn `glossary: []` into a blocking capability requirement.
 */
export function richImportRequirements(packageValue: SmartImportPackage): string[] {
  const features = detectFlashcardPackageFeatures(packageValue);
  return [
    features.hasLayeredCards ? "cards em camadas" : null,
    features.hasEnrichedFields ? "campos enriquecidos" : null,
  ].filter((value): value is string => Boolean(value));
}
