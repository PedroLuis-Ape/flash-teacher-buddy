import { loadGlobalImportManifest } from "./manifest";
import { normalizeSmartImportCompatibility } from "./importCompatibility";
import { requestIdFromUnknown } from "./normalizer";
import { parseGlobalImportText } from "./parser";
import { validateGlobalImportInput } from "./validation";

export function analyzeGlobalImportText(text: string) {
  const parsed = parseGlobalImportText(text);
  const record = parsed.value && typeof parsed.value === "object" && !Array.isArray(parsed.value)
    ? parsed.value as Record<string, unknown>
    : null;
  const useCompatibility = record?.schema === "app-piteco-super-import"
    && (record.version === "2.0" || record.version === undefined);
  const compatible = useCompatibility
    ? normalizeSmartImportCompatibility(parsed.value)
    : { value: parsed.value, warnings: [] as string[] };
  const requestId = requestIdFromUnknown(compatible.value);
  const manifest = requestId ? loadGlobalImportManifest(requestId) : null;
  return {
    parsed: { ...parsed, value: compatible.value },
    validation: validateGlobalImportInput(compatible.value, manifest),
    compatibilityWarnings: compatible.warnings,
  };
}
