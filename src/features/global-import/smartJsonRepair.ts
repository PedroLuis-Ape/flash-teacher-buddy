import { normalizeSmartImportJsonValue } from "@/features/smart-import/jsonNormalizer";

interface SmartJsonRepairResult {
  text: string;
  changed: boolean;
  notes: string[];
}

export function repairSmartImportJsonText(input: string): SmartJsonRepairResult {
  const trimmed = input
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/\s*```$/i, "");

  if (!trimmed.startsWith("{")) return { text: input, changed: false, notes: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { text: input, changed: false, notes: [] };
  }

  const normalized = normalizeSmartImportJsonValue(parsed);
  if (!normalized.changed) return { text: input, changed: false, notes: [] };

  return {
    text: JSON.stringify(normalized.value, null, 2),
    changed: true,
    notes: normalized.notes,
  };
}
