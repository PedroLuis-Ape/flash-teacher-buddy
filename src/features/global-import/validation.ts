import { validateGlobalImportPackage as validateLegacyPackage } from "./checks";
import { comparePackageWithManifest, type GlobalImportManifest } from "./manifest";
import { normalizeGlobalImportValue, type GlobalImportSourceFormat } from "./normalizer";
import type { CanonicalGlobalImportPackage } from "./schema/globalImportSchema";
import type { AppPitecoSuperImportPackage } from "./schema/appPitecoSuperImportSchema";
import type { GlobalImportIssue, GlobalImportSummary } from "./checks";
import type { GlobalImportPackage } from "./schema";
import { smartImportToLegacyPackage } from "@/features/smart-import/adapters";
import { smartImportPackageSchema, type SmartImportPackage } from "@/features/smart-import/schema";

export interface GlobalImportV2ValidationResult {
  valid: boolean;
  package: GlobalImportPackage | null;
  officialPackage: AppPitecoSuperImportPackage | null;
  canonicalPackage: CanonicalGlobalImportPackage | null;
  smartPackage: SmartImportPackage | null;
  sourceFormat: GlobalImportSourceFormat | "smart" | "unknown";
  requestId: string | null;
  issues: GlobalImportIssue[];
  summary: GlobalImportSummary;
}

function pathOf(parts: Array<string | number>): string {
  return parts.reduce<string>((result, part) => (
    typeof part === "number" ? `${result}[${part}]` : result ? `${result}.${part}` : part
  ), "") || "$";
}

function issueCode(path: string, message: string, sourceFormat: GlobalImportSourceFormat | "smart" | "unknown"): string {
  if (message.includes("[E_COUNT_MISMATCH]") || message.includes("Contagem declarada")) return "E_COUNT_MISMATCH";
  if ((sourceFormat === "official" || sourceFormat === "smart") && path === "version") return "E_VERSION";
  if (path.endsWith("front_language") || path.endsWith("back_language")) return "E_LANGUAGE";
  if (path.endsWith(".front") || path.endsWith(".back")) return "E_EMPTY_CARD_SIDE";
  if (path.endsWith(".name") || path === "package.name") return "E_EMPTY_NAME";
  return "E_SCHEMA";
}

function schemaIssues(
  normalized: Extract<ReturnType<typeof normalizeGlobalImportValue>, { success: false }>["error"],
): GlobalImportIssue[] {
  const parsed = normalized.sourceFormat === "official"
    ? normalized.officialResult
    : normalized.sourceFormat === "legacy"
      ? normalized.legacyResult
      : normalized.canonicalResult;

  if (normalized.dangerousPath) {
    return [{ severity: "error", path: normalized.dangerousPath, message: "Chave não permitida.", code: "E_SCHEMA" }];
  }
  if (parsed.success) return [{ severity: "error", path: "$", message: "Formato não reconhecido.", code: "E_SCHEMA" }];

  return parsed.error.issues.map((issue) => {
    const path = pathOf(issue.path);
    return {
      severity: "error" as const,
      path,
      message: issue.message.replace("[E_COUNT_MISMATCH] ", ""),
      code: issueCode(path, issue.message, normalized.sourceFormat),
    };
  });
}

function smartSchemaIssues(result: ReturnType<typeof smartImportPackageSchema.safeParse>): GlobalImportIssue[] {
  if (result.success) return [];
  return result.error.issues.map((issue) => {
    const path = pathOf(issue.path);
    return { severity: "error" as const, path, message: issue.message, code: issueCode(path, issue.message, "smart") };
  });
}

function duplicateAndOptionalIssues(value: CanonicalGlobalImportPackage): GlobalImportIssue[] {
  const issues: GlobalImportIssue[] = [];
  let cardsWithoutExamples = 0;
  let cardsWithoutExplanations = 0;
  value.package.folders.forEach((folder, folderIndex) => {
    folder.lists.forEach((list, listIndex) => {
      const firstCardPath = new Map<string, string>();
      list.cards.forEach((card, cardIndex) => {
        const path = `package.folders[${folderIndex}].lists[${listIndex}].cards[${cardIndex}]`;
        const key = `${card.term.trim().toLocaleLowerCase()}\u0000${card.translation.trim().toLocaleLowerCase()}`;
        const firstPath = firstCardPath.get(key);
        if (firstPath) issues.push({ severity: "error", path, message: `Card duplicado na mesma lista. A primeira ocorrência está em ${firstPath}.`, code: "E_DUPLICATE_CARD" });
        else firstCardPath.set(key, path);
        if (!card.example_text && !card.example_translation) cardsWithoutExamples += 1;
        if (!card.detailed_explanation && !card.usage_notes && !card.common_mistakes) cardsWithoutExplanations += 1;
      });
    });
  });
  if (cardsWithoutExamples > 0) issues.push({ severity: "info", path: "package.folders", message: `${cardsWithoutExamples} card(s) não possuem exemplo. O campo é opcional no formato antigo.`, code: "optional.examples_missing" });
  if (cardsWithoutExplanations > 0) issues.push({ severity: "info", path: "package.folders", message: `${cardsWithoutExplanations} card(s) não possuem explicações ou notas. Esses campos são opcionais no formato antigo.`, code: "optional.explanations_missing" });
  return issues;
}

function officialDuplicateIssues(value: AppPitecoSuperImportPackage): GlobalImportIssue[] {
  const issues: GlobalImportIssue[] = [];
  value.package.folders.forEach((folder, folderIndex) => {
    folder.lists.forEach((list, listIndex) => {
      const firstByKey = new Map<string, number>();
      list.cards.forEach((card, cardIndex) => {
        const key = `${card.front.trim().toLocaleLowerCase()}\u0000${card.back.trim().toLocaleLowerCase()}`;
        const firstIndex = firstByKey.get(key);
        if (firstIndex === undefined) firstByKey.set(key, cardIndex);
        else issues.push({ severity: "error", path: `package.folders[${folderIndex}].lists[${listIndex}].cards[${cardIndex}]`, message: `Card duplicado na mesma lista. A primeira ocorrência está no índice ${firstIndex}.`, code: "E_DUPLICATE_CARD" });
      });
    });
  });
  return issues;
}

function smartDuplicateIssues(value: SmartImportPackage): GlobalImportIssue[] {
  const issues: GlobalImportIssue[] = [];
  value.package.folders.forEach((folder, folderIndex) => folder.lists.forEach((list, listIndex) => {
    const cards = new Map<string, string>();
    list.cards.forEach((card, cardIndex) => {
      const playable = card.type === "normal" ? [card] : card.layers;
      playable.forEach((item, layerIndex) => {
        const path = card.type === "normal"
          ? `package.folders[${folderIndex}].lists[${listIndex}].cards[${cardIndex}]`
          : `package.folders[${folderIndex}].lists[${listIndex}].cards[${cardIndex}].layers[${layerIndex}]`;
        const key = `${item.front.trim().toLocaleLowerCase()}\u0000${item.back.trim().toLocaleLowerCase()}`;
        const first = cards.get(key);
        if (first) issues.push({ severity: "error", path, message: `Card duplicado na mesma lista. A primeira ocorrência está em ${first}.`, code: "E_DUPLICATE_CARD" });
        else cards.set(key, path);
      });
    });
  }));
  return issues;
}

export function validateGlobalImportInput(value: unknown, manifest?: GlobalImportManifest | null): GlobalImportV2ValidationResult {
  const smartResult = smartImportPackageSchema.safeParse(value);
  if (smartResult.success) {
    const packageValue = smartImportToLegacyPackage(smartResult.data);
    const base = validateLegacyPackage(packageValue);
    const issues = [...base.issues, ...smartDuplicateIssues(smartResult.data)];
    return {
      valid: !issues.some((issue) => issue.severity === "error"),
      package: packageValue,
      officialPackage: null,
      canonicalPackage: null,
      smartPackage: smartResult.data,
      sourceFormat: "smart",
      requestId: null,
      issues,
      summary: base.summary,
    };
  }

  const record = value && typeof value === "object" ? value as Record<string, unknown> : null;
  if (record?.schema === "app-piteco-super-import" && record?.version === "2.0") {
    return {
      valid: false,
      package: null,
      officialPackage: null,
      canonicalPackage: null,
      smartPackage: null,
      sourceFormat: "smart",
      requestId: null,
      issues: smartSchemaIssues(smartResult),
      summary: { folders: 0, lists: 0, cards: 0 },
    };
  }

  const normalized = normalizeGlobalImportValue(value);
  if (!normalized.success) {
    return {
      valid: false,
      package: null,
      officialPackage: null,
      canonicalPackage: null,
      smartPackage: null,
      sourceFormat: normalized.error.sourceFormat,
      requestId: null,
      issues: schemaIssues(normalized.error),
      summary: { folders: 0, lists: 0, cards: 0 },
    };
  }

  const base = validateLegacyPackage(normalized.data.packageValue);
  const issues: GlobalImportIssue[] = [
    ...base.issues,
    ...normalized.data.warnings.map((message) => ({ severity: "warning" as const, path: "$", message, code: "compatibility.legacy" })),
  ];
  const canonical = normalized.data.canonicalPackage;
  const official = normalized.data.officialPackage;
  if (official) issues.push(...officialDuplicateIssues(official));
  if (canonical) issues.push(...duplicateAndOptionalIssues(canonical));

  if (canonical && !manifest) {
    issues.push({ severity: "error", path: "request_id", message: "Manifesto local não encontrado. Gere novamente o prompt neste dispositivo.", code: "manifest.missing" });
  } else if (canonical && manifest) {
    issues.push(...comparePackageWithManifest(canonical, manifest).map((issue) => ({ severity: "error" as const, ...issue })));
  }

  return {
    valid: !issues.some((issue) => issue.severity === "error"),
    package: normalized.data.packageValue,
    officialPackage: official,
    canonicalPackage: canonical,
    smartPackage: null,
    sourceFormat: normalized.data.sourceFormat,
    requestId: canonical?.request_id ?? null,
    issues,
    summary: base.summary,
  };
}
