import { smartImportToLegacyPackage } from "@/features/smart-import/adapters";
import {
  smartImportPackageSchema,
  withSmartDeclaredTotals,
  type SmartGlossaryEntry,
  type SmartImportList,
  type SmartImportPackage,
} from "@/features/smart-import/schema";
import { resolveEffectiveListSettings } from "@/features/study/lib/resolveStudySides";
import type {
  ExistingImportList,
  GlobalImportDestinationPlan,
  ImportDestinationCatalog,
} from "./destination";
import type { GlobalImportPackage } from "./schema";

export type ExistingListImportStrategy = "append" | "replace";

export interface ExistingListImportTarget {
  listId: string;
  folderId: string;
  listName: string;
  folderName: string;
  frontLanguage: string;
  backLanguage: string;
  labelA: string;
  labelB: string;
  primarySide: "a" | "b";
  studyType: SmartImportList["study_type"];
  ttsEnabled: boolean;
}

export interface ExistingListSourceGroup {
  folderName: string;
  listName: string;
  cards: number;
  glossaryEntries: number;
}

export interface ExistingListImportSummary {
  sourceFolders: number;
  sourceLists: number;
  cardsReceived: number;
  glossaryReceived: number;
  glossaryDuplicates: number;
  glossaryToImport: number;
}

export interface ExistingListImportPreparation {
  smartPackage: SmartImportPackage;
  packageValue: GlobalImportPackage;
  plan: GlobalImportDestinationPlan;
  target: ExistingListImportTarget;
  sourceGroups: ExistingListSourceGroup[];
  summary: ExistingListImportSummary;
  errors: string[];
  warnings: string[];
}

const DIRECTION_ERROR = "Os lados do pacote não correspondem aos lados da lista escolhida. Revise o mapeamento antes de importar.";

function normalizeLanguage(value: string): string {
  const normalized = value
    .trim()
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/_/g, "-");
  const aliases: Record<string, string> = {
    english: "en",
    ingles: "en",
    portugues: "pt",
    portuguese: "pt",
    espanhol: "es",
    spanish: "es",
    frances: "fr",
    french: "fr",
    alemao: "de",
    german: "de",
    italiano: "it",
    italian: "it",
  };
  return aliases[normalized] ?? normalized.split("-")[0];
}

function countPlayableCards(list: SmartImportList): number {
  return list.cards.reduce(
    (total, card) => total + (card.type === "normal" ? 1 : card.layers.length),
    0,
  );
}

function glossaryIdentity(entry: SmartGlossaryEntry): string {
  const clean = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
  return `${entry.side}\u0000${clean(entry.term)}\u0000${clean(entry.translation)}`;
}

function normalizeStudyType(value: string): SmartImportList["study_type"] {
  return value === "general" || value === "math" || value === "visual" ? value : "language";
}

export function existingListTargetFromCatalog(
  catalog: ImportDestinationCatalog,
  listId: string,
): ExistingListImportTarget | null {
  const list = catalog.lists.find((item) => item.id === listId);
  if (!list) return null;
  const folder = catalog.folders.find((item) => item.id === list.folder_id);
  if (!folder) return null;
  const effective = resolveEffectiveListSettings(list, folder);

  return {
    listId: list.id,
    folderId: folder.id,
    listName: list.title,
    folderName: folder.title,
    frontLanguage: effective.langA,
    backLanguage: effective.langB,
    labelA: effective.labelsA,
    labelB: effective.labelsB,
    primarySide: "a",
    studyType: normalizeStudyType(effective.studyType),
    ttsEnabled: effective.ttsEnabled,
  };
}

export function buildExistingListImportPlan(
  source: SmartImportPackage,
  target: ExistingListImportTarget,
  strategy: ExistingListImportStrategy = "append",
): ExistingListImportPreparation {
  const cards: SmartImportList["cards"] = [];
  const glossary = new Map<string, SmartGlossaryEntry>();
  const sourceGroups: ExistingListSourceGroup[] = [];
  const errors: string[] = [];
  let cardsReceived = 0;
  let glossaryReceived = 0;
  let glossaryDuplicates = 0;

  const targetFront = normalizeLanguage(target.frontLanguage);
  const targetBack = normalizeLanguage(target.backLanguage);

  for (const folder of source.package.folders) {
    for (const list of folder.lists) {
      const listCards = countPlayableCards(list);
      cardsReceived += listCards;
      glossaryReceived += list.glossary.length;
      sourceGroups.push({
        folderName: folder.name,
        listName: list.name,
        cards: listCards,
        glossaryEntries: list.glossary.length,
      });

      if (
        normalizeLanguage(list.front_language) !== targetFront
        || normalizeLanguage(list.back_language) !== targetBack
      ) {
        errors.push(DIRECTION_ERROR);
      }

      cards.push(...list.cards);
      for (const entry of list.glossary) {
        const key = glossaryIdentity(entry);
        if (glossary.has(key)) glossaryDuplicates += 1;
        else glossary.set(key, entry);
      }
    }
  }

  const smartPackage = smartImportPackageSchema.parse(withSmartDeclaredTotals({
    schema: "app-piteco-super-import",
    version: "2.0",
    package: {
      name: source.package.name,
      description: source.package.description,
      source_language: target.frontLanguage,
      target_language: target.backLanguage,
      level: source.package.level,
      theme: source.package.theme,
      folders: [{
        name: target.folderName,
        description: null,
        lists: [{
          name: target.listName,
          description: null,
          front_language: target.frontLanguage,
          back_language: target.backLanguage,
          primary_side: target.primarySide,
          study_type: target.studyType,
          label_a: target.labelA,
          label_b: target.labelB,
          tts_enabled: target.ttsEnabled,
          glossary: Array.from(glossary.values()),
          cards,
        }],
      }],
    },
  }));

  const packageValue = smartImportToLegacyPackage(smartPackage);
  const plan: GlobalImportDestinationPlan = {
    folders: {
      0: {
        folder: { mode: "existing", folderId: target.folderId },
        lists: {
          0: { mode: "existing", listId: target.listId, strategy },
        },
      },
    },
  };

  return {
    smartPackage,
    packageValue,
    plan,
    target,
    sourceGroups,
    summary: {
      sourceFolders: source.package.folders.length,
      sourceLists: sourceGroups.length,
      cardsReceived,
      glossaryReceived,
      glossaryDuplicates,
      glossaryToImport: glossary.size,
    },
    errors: Array.from(new Set(errors)),
    warnings: glossaryDuplicates > 0
      ? [`${glossaryDuplicates} entrada(s) repetida(s) de glossário foram consolidadas.`]
      : [],
  };
}

export function existingListTargetFromRows(
  list: ExistingImportList,
  catalog: ImportDestinationCatalog,
): ExistingListImportTarget | null {
  return existingListTargetFromCatalog(catalog, list.id);
}
