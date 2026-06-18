import { loadGlobalImportManifest } from "./manifest";
import { requestIdFromUnknown } from "./normalizer";
import { parseGlobalImportText } from "./parser";
import { validateGlobalImportInput } from "./validation";

export function analyzeGlobalImportText(text: string) {
  const parsed = parseGlobalImportText(text);
  const requestId = requestIdFromUnknown(parsed.value);
  const manifest = requestId ? loadGlobalImportManifest(requestId) : null;
  return {
    parsed,
    validation: validateGlobalImportInput(parsed.value, manifest),
  };
}
