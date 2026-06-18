import type { ZodIssue } from "zod";
import {
  GLOBAL_IMPORT_LIMITS,
  globalImportPackageSchema,
  type GlobalImportPackage,
} from "./schema";

export type GlobalImportIssueSeverity = "error" | "warning" | "info";

export interface GlobalImportIssue {
  severity: GlobalImportIssueSeverity;
  path: string;
  message: string;
  code: string;
}

export interface GlobalImportSummary {
  folders: number;
  lists: number;
  cards: number;
}

export interface GlobalImportValidationResult {
  valid: boolean;
  package: GlobalImportPackage | null;
  issues: GlobalImportIssue[];
  summary: GlobalImportSummary;
}

function formatPath(path: Array<string | number>): string {
  if (path.length === 0) return "$";
  return path.reduce<string>((result, segment) => {
    if (typeof segment === "number") return `${result}[${segment}]`;
    return result ? `${result}.${segment}` : segment;
  }, "");
}

function fromZodIssue(issue: ZodIssue): GlobalImportIssue {
  return {
    severity: "error",
    path: formatPath(issue.path),
    message: issue.message,
    code: `schema.${issue.code}`,
  };
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function duplicateIssues(
  values: string[],
  pathForIndex: (index: number) => string,
  label: string,
  code: string,
): GlobalImportIssue[] {
  const firstByKey = new Map<string, number>();
  const issues: GlobalImportIssue[] = [];

  values.forEach((value, index) => {
    const key = normalizeKey(value);
    const firstIndex = firstByKey.get(key);
    if (firstIndex === undefined) {
      firstByKey.set(key, index);
      return;
    }
    issues.push({
      severity: "warning",
      path: pathForIndex(index),
      code,
      message: `${label} duplicado. Também aparece em ${pathForIndex(firstIndex)}.`,
    });
  });

  return issues;
}

export function summarizeGlobalImport(packageValue: GlobalImportPackage): GlobalImportSummary {
  let lists = 0;
  let cards = 0;
  for (const folder of packageValue.package.folders) {
    lists += folder.lists.length;
    for (const list of folder.lists) cards += list.cards.length;
  }
  return { folders: packageValue.package.folders.length, lists, cards };
}

export function validateGlobalImportPackage(value: unknown): GlobalImportValidationResult {
  const parsed = globalImportPackageSchema.safeParse(value);
  if (!parsed.success) {
    return {
      valid: false,
      package: null,
      issues: parsed.error.issues.map(fromZodIssue),
      summary: { folders: 0, lists: 0, cards: 0 },
    };
  }

  const packageValue = parsed.data;
  const issues: GlobalImportIssue[] = [];
  const summary = summarizeGlobalImport(packageValue);

  if (summary.lists > GLOBAL_IMPORT_LIMITS.maxLists) {
    issues.push({
      severity: "error",
      path: "package.folders",
      code: "limit.lists",
      message: `O pacote possui ${summary.lists} listas; o limite é ${GLOBAL_IMPORT_LIMITS.maxLists}.`,
    });
  }
  if (summary.cards > GLOBAL_IMPORT_LIMITS.maxCards) {
    issues.push({
      severity: "error",
      path: "package.folders",
      code: "limit.cards",
      message: `O pacote possui ${summary.cards} cards; o limite é ${GLOBAL_IMPORT_LIMITS.maxCards}.`,
    });
  }

  issues.push(...duplicateIssues(
    packageValue.package.folders.map((folder) => folder.name),
    (index) => `package.folders[${index}].name`,
    "Nome de pasta",
    "duplicate.folder",
  ));

  packageValue.package.folders.forEach((folder, folderIndex) => {
    const folderPath = `package.folders[${folderIndex}]`;
    const realFolderCards = folder.lists.reduce((sum, list) => sum + list.cards.length, 0);
    if (folder.expected_cards !== undefined && folder.expected_cards !== realFolderCards) {
      issues.push({
        severity: "error",
        path: `${folderPath}.expected_cards`,
        code: "count.folder",
        message: `A pasta declara ${folder.expected_cards} cards, mas contém ${realFolderCards}.`,
      });
    }

    issues.push(...duplicateIssues(
      folder.lists.map((list) => list.name),
      (index) => `${folderPath}.lists[${index}].name`,
      "Nome de lista",
      "duplicate.list",
    ));

    folder.lists.forEach((list, listIndex) => {
      const listPath = `${folderPath}.lists[${listIndex}]`;
      if (list.expected_cards !== undefined && list.expected_cards !== list.cards.length) {
        issues.push({
          severity: "error",
          path: `${listPath}.expected_cards`,
          code: "count.list",
          message: `A lista declara ${list.expected_cards} cards, mas contém ${list.cards.length}.`,
        });
      }

      const cardKeys = list.cards.map((card) => `${normalizeKey(card.front)}|${normalizeKey(card.back)}`);
      issues.push(...duplicateIssues(
        cardKeys,
        (index) => `${listPath}.cards[${index}]`,
        "Card",
        "duplicate.card",
      ));
    });
  });

  return {
    valid: !issues.some((issue) => issue.severity === "error"),
    package: packageValue,
    issues,
    summary,
  };
}
