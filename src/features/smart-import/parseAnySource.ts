import { normalizeGlobalImportValue } from "@/features/global-import/normalizer";
import { legacyPackageToSmartImport } from "./adapters";
import {
  parseSmartImportSource,
  type SmartImportContext,
  type SmartImportSourceResult,
} from "./sourceParser";

function parseJson(value: string): unknown {
  const normalized = value
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/\s*```$/i, "");
  if (!normalized.startsWith("{") && !normalized.startsWith("[")) return null;
  return JSON.parse(normalized);
}

export function parseAnySmartImportSource(
  input: string,
  context: SmartImportContext = {},
): SmartImportSourceResult {
  try {
    return parseSmartImportSource(input, context);
  } catch (primaryError) {
    let parsed: unknown;
    try {
      parsed = parseJson(input);
    } catch {
      throw primaryError;
    }
    if (!parsed) throw primaryError;

    const normalized = normalizeGlobalImportValue(parsed);
    if (!normalized.success) throw primaryError;

    return {
      packageValue: legacyPackageToSmartImport(normalized.data.packageValue),
      format: "json-v2",
      notes: [
        normalized.data.sourceFormat === "official"
          ? "Contrato app-piteco-super-import 1.0 normalizado para o motor 2.0."
          : `Formato ${normalized.data.sourceFormat} normalizado para o motor 2.0.`,
      ],
      warnings: normalized.data.warnings,
    };
  }
}
