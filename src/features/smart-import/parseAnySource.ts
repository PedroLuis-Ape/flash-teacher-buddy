import { normalizeGlobalImportValue } from "@/features/global-import/normalizer";
import { legacyPackageToSmartImport } from "./adapters";
import { normalizeSmartImportJsonValue } from "./jsonNormalizer";
import {
  parseSmartImportSource,
  type SmartImportContext,
  type SmartImportSourceResult,
} from "./sourceParser";

function normalizedJsonText(value: string): { text: string; notes: string[] } {
  const normalized = value
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/\s*```$/i, "");
  if (!normalized.startsWith("{") && !normalized.startsWith("[")) {
    return { text: value, notes: [] };
  }

  const parsed = JSON.parse(normalized);
  const repaired = normalizeSmartImportJsonValue(parsed);
  return {
    text: repaired.changed ? JSON.stringify(repaired.value) : normalized,
    notes: repaired.notes,
  };
}

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
  let repairNotes: string[] = [];
  let effectiveInput = input;
  try {
    const repaired = normalizedJsonText(input);
    effectiveInput = repaired.text;
    repairNotes = repaired.notes;
  } catch {
    // The regular parser will return the canonical invalid/incomplete JSON error.
  }

  try {
    const parsed = parseSmartImportSource(effectiveInput, context);
    return repairNotes.length
      ? { ...parsed, notes: [...repairNotes, ...parsed.notes] }
      : parsed;
  } catch (primaryError) {
    let parsed: unknown;
    try {
      parsed = parseJson(effectiveInput);
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
        ...repairNotes,
        normalized.data.sourceFormat === "official"
          ? "Contrato app-piteco-super-import 1.0 normalizado para o motor 2.0."
          : `Formato ${normalized.data.sourceFormat} normalizado para o motor 2.0.`,
      ],
      warnings: normalized.data.warnings,
    };
  }
}
