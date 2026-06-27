import { loadGlobalImportManifest } from "./manifest";
import { normalizeSmartImportCompatibility } from "./importCompatibility";
import { requestIdFromUnknown } from "./normalizer";
import { parseGlobalImportText } from "./parser";
import { extractAndRepairJson } from "./resilientParser";
import { APP_PITECO_SUPER_IMPORT_LIMITS } from "./schema/appPitecoSuperImportSchema";
import { validateGlobalImportInput } from "./validation";

export function analyzeGlobalImportText(text: string) {
  const byteSize = new TextEncoder().encode(text).byteLength;
  if (byteSize > APP_PITECO_SUPER_IMPORT_LIMITS.maxFileBytes) {
    throw new Error(`O pacote excede o limite de ${Math.floor(APP_PITECO_SUPER_IMPORT_LIMITS.maxFileBytes / 1024 / 1024)} MB.`);
  }

  const resilient = extractAndRepairJson(text);
  const parsed = resilient ?? parseGlobalImportText(text);
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
