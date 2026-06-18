import { validateGlobalImportPackage as validateLegacyPackage } from "./checks";
import { comparePackageWithManifest, type GlobalImportManifest } from "./manifest";
import { normalizeGlobalImportValue, type GlobalImportSourceFormat } from "./normalizer";
import { GLOBAL_IMPORT_LIMITS, type CanonicalGlobalImportPackage } from "./schema/globalImportSchema";
import type { GlobalImportIssue, GlobalImportSummary } from "./checks";
import type { GlobalImportPackage } from "./schema";

export interface GlobalImportV2ValidationResult {
  valid: boolean;
  package: GlobalImportPackage | null;
  canonicalPackage: CanonicalGlobalImportPackage | null;
  sourceFormat: GlobalImportSourceFormat | "unknown";
  requestId: string | null;
  issues: GlobalImportIssue[];
  summary: GlobalImportSummary;
}

function pathOf(parts: Array<string | number>): string {
  return parts.reduce<string>((result, part) => (
    typeof part === "number" ? `${result}[${part}]` : result ? `${result}.${part}` : part
  ), "") || "$";
}

function duplicateAndOptionalIssues(value: CanonicalGlobalImportPackage): GlobalImportIssue[] {
  const issues: GlobalImportIssue[] = [];
  const firstCardPath = new Map<string, string>();
  let cardsWithoutExamples = 0;
  let cardsWithoutExplanations = 0;

  value.package.folders.forEach((folder, folderIndex) => {
    folder.lists.forEach((list, listIndex) => {
      list.cards.forEach((card, cardIndex) => {
        const path = `package.folders[${folderIndex}].lists[${listIndex}].cards[${cardIndex}]`;
        const key = `${card.term.trim().toLocaleLowerCase()}\u0000${card.translation.trim().toLocaleLowerCase()}`;
        const firstPath = firstCardPath.get(key);
        if (firstPath) {
          issues.push({
            severity: "error",
            path,
            message: `Card duplicado no pacote. A primeira ocorrência está em ${firstPath}.`,
            code: "duplicate.card.package",
          });
        } else {
          firstCardPath.set(key, path);
        }

        if (!card.example_text && !card.example_translation) cardsWithoutExamples += 1;
        if (!card.detailed_explanation && !card.usage_notes && !card.common_mistakes) {
          cardsWithoutExplanations += 1;
        }
      });
    });
  });

  if (cardsWithoutExamples > 0) {
    issues.push({
      severity: "info",
      path: "package.folders",
      message: `${cardsWithoutExamples} card(s) não possuem exemplo. O campo é opcional.`,
      code: "optional.examples_missing",
    });
  }
  if (cardsWithoutExplanations > 0) {
    issues.push({
      severity: "info",
      path: "package.folders",
      message: `${cardsWithoutExplanations} card(s) não possuem explicações ou notas. Esses campos são opcionais.`,
      code: "optional.explanations_missing",
    });
  }
  return issues;
}

export function validateGlobalImportInput(
  value: unknown,
  manifest?: GlobalImportManifest | null,
): GlobalImportV2ValidationResult {
  const normalized = normalizeGlobalImportValue(value);
  if (!normalized.success) {
    const parsed = normalized.error.sourceFormat === "legacy"
      ? normalized.error.legacyResult
      : normalized.error.canonicalResult;
    const issues: GlobalImportIssue[] = normalized.error.dangerousPath
      ? [{ severity: "error", path: normalized.error.dangerousPath, message: "Chave não permitida.", code: "input.key" }]
      : parsed.success
        ? [{ severity: "error", path: "$", message: "Formato não reconhecido.", code: "schema.unsupported" }]
        : parsed.error.issues.map((issue) => ({
          severity: "error" as const,
          path: pathOf(issue.path),
          message: issue.message,
          code: `schema.${issue.code}`,
        }));
    return {
      valid: false,
      package: null,
      canonicalPackage: null,
      sourceFormat: normalized.error.sourceFormat,
      requestId: null,
      issues,
      summary: { folders: 0, lists: 0, cards: 0 },
    };
  }

  const base = validateLegacyPackage(normalized.data.packageValue);
  const issues: GlobalImportIssue[] = [
    ...base.issues,
    ...normalized.data.warnings.map((message) => ({
      severity: "warning" as const,
      path: "$",
      message,
      code: "compatibility.legacy",
    })),
  ];
  const canonical = normalized.data.canonicalPackage;

  if (base.summary.cards > GLOBAL_IMPORT_LIMITS.maxCards) {
    issues.push({
      severity: "error",
      path: "package.folders",
      message: `O pacote possui ${base.summary.cards} cards; o limite é ${GLOBAL_IMPORT_LIMITS.maxCards}.`,
      code: "limit.cards",
    });
  }

  if (canonical) issues.push(...duplicateAndOptionalIssues(canonical));

  if (canonical && !manifest) {
    issues.push({
      severity: "error",
      path: "request_id",
      message: "Manifesto local não encontrado. Gere novamente o prompt neste dispositivo.",
      code: "manifest.missing",
    });
  } else if (canonical && manifest) {
    issues.push(...comparePackageWithManifest(canonical, manifest).map((issue) => ({
      severity: "error" as const,
      ...issue,
    })));
  }

  return {
    valid: !issues.some((issue) => issue.severity === "error"),
    package: normalized.data.packageValue,
    canonicalPackage: canonical,
    sourceFormat: normalized.data.sourceFormat,
    requestId: canonical?.request_id ?? null,
    issues,
    summary: base.summary,
  };
}
