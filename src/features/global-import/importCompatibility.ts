import { canonicalizeSmartImportKeys } from "./keyCanonicalizer";

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export function normalizeSmartImportCompatibility(value: unknown): {
  value: unknown;
  warnings: string[];
} {
  const result = canonicalizeSmartImportKeys(value);
  const warnings = [...result.warnings];
  if (!isRecord(result.value)) return result;

  const packageValue = isRecord(result.value.package) ? result.value.package : null;
  const folders = Array.isArray(packageValue?.folders) ? packageValue.folders : [];

  folders.forEach((folderValue, folderIndex) => {
    if (!isRecord(folderValue) || !Array.isArray(folderValue.glossary) || folderValue.glossary.length === 0) return;
    const lists = Array.isArray(folderValue.lists) ? folderValue.lists : [];
    const firstList = lists.find(isRecord);
    if (!firstList) return;
    const existing = Array.isArray(firstList.glossary) ? firstList.glossary : [];
    firstList.glossary = [...folderValue.glossary, ...existing];
    delete folderValue.glossary;
    warnings.push(`package.folders[${folderIndex}].glossary foi consolidado no glossário da pasta.`);
  });

  return { value: result.value, warnings: Array.from(new Set(warnings)) };
}
