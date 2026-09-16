import { smartImportToLegacyPackage } from "@/features/smart-import/adapters";
import {
  smartImportPackageSchema,
  withSmartDeclaredTotals,
  type SmartGlossaryEntry,
  type SmartImportList,
  type SmartImportPackage,
} from "@/features/smart-import/schema";
import {
  getLangLabel,
  resolveEffectiveListSettings,
  type LanguageSettingsMode,
} from "@/features/study/lib/resolveStudySides";
import type {
  ExistingImportList,
  GlobalImportDestinationPlan,
  ImportDestinationCatalog,
} from "./destination";
import { importDirectionsMatch, type ImportLanguageDirection } from "./languageCompatibility";
import type { GlobalImportPackage } from "./schema";

export type ExistingListImportStrategy = "append" | "replace";

export interface ExistingListImportTarget {
  listId: string;
  folderId: string;
  institutionId: string | null;
  turmaId: string | null;
  listName: string;
  folderName: string;
  frontLanguage: string;
  backLanguage: string;
  labelA: string;
  labelB: string;
  primarySide: "a" | "b";
  studyType: SmartImportList["study_type"];
  ttsEnabled: boolean;
  languageSettingsMode: LanguageSettingsMode;
  rawFrontLanguage: string | null;
  rawBackLanguage: string | null;
  rawLabelA: string | null;
  rawLabelB: string | null;
}

export interface ExistingListSourceGroup {
  folderName: string;
  listName: string;
  cards: number;
  glossaryEntries: number;
  blocked: boolean;
}

export interface ExistingListImportSummary {
  sourceFolders: number;
  sourceLists: number;
  cardsReceived: number;
  cardsCompatible: number;
  cardsBlocked: number;
  glossaryReceived: number;
  glossaryDuplicates: number;
  glossaryToImport: number;
}

export interface ExistingListCardReconciliation {
  cardsReceived: number;
  cardsValid: number;
  cardsDuplicates: number;
  cardsBlocked: number;
  coherent: boolean;
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

function countPlayableCards(list: SmartImportList): number {
  return list.cards.reduce(
    (total, card) => total + (card.type === "normal" ? 1 : card.layers.length),
    0,
  );
}

function playableCards(list: SmartImportList): Array<{ front: string; back: string }> {
  return list.cards.flatMap((card) => card.type === "normal"
    ? [{ front: card.front, back: card.back }]
    : card.layers.map((layer) => ({ front: layer.front, back: layer.back })));
}

function cardIdentity(front: string, back: string): string {
  const clean = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
  return `${clean(front)}\u0000${clean(back)}`;
}

function glossaryIdentity(entry: SmartGlossaryEntry): string {
  const clean = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
  return `${entry.side}\u0000${clean(entry.term)}\u0000${clean(entry.translation)}`;
}

function normalizeStudyType(value: string): SmartImportList["study_type"] {
  return value === "general" || value === "math" || value === "visual" ? value : "language";
}

function smartListDirection(list: SmartImportList): ImportLanguageDirection {
  return { front: list.front_language, back: list.back_language };
}

function effectiveTargetDirection(target: ExistingListImportTarget): ImportLanguageDirection {
  return { front: target.frontLanguage, back: target.backLanguage };
}

function rawTargetDirection(target: ExistingListImportTarget): ImportLanguageDirection | null {
  return target.rawFrontLanguage && target.rawBackLanguage
    ? { front: target.rawFrontLanguage, back: target.rawBackLanguage }
    : null;
}

function sourceLists(source: SmartImportPackage): SmartImportList[] {
  return source.package.folders.flatMap((folder) => folder.lists);
}

function resolveSourceAwareTarget(
  source: SmartImportPackage,
  target: ExistingListImportTarget,
): ExistingListImportTarget {
  const lists = sourceLists(source);
  const effective = effectiveTargetDirection(target);
  if (lists.every((list) => importDirectionsMatch(smartListDirection(list), effective))) {
    return target;
  }

  const raw = rawTargetDirection(target);
  if (
    target.languageSettingsMode === "legacy"
    && raw
    && lists.every((list) => importDirectionsMatch(smartListDirection(list), raw))
  ) {
    return {
      ...target,
      frontLanguage: raw.front,
      backLanguage: raw.back,
      labelA: target.rawLabelA || getLangLabel(raw.front),
      labelB: target.rawLabelB || getLangLabel(raw.back),
    };
  }

  return target;
}

function directionMatches(list: SmartImportList, target: ExistingListImportTarget): boolean {
  return importDirectionsMatch(smartListDirection(list), effectiveTargetDirection(target));
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
    institutionId: folder.institution_id ?? null,
    turmaId: folder.class_id ?? null,
    listName: list.title,
    folderName: folder.title,
    frontLanguage: effective.langA,
    backLanguage: effective.langB,
    labelA: effective.labelsA,
    labelB: effective.labelsB,
    primarySide: "a",
    studyType: normalizeStudyType(effective.studyType),
    ttsEnabled: effective.ttsEnabled,
    languageSettingsMode: effective.languageSettingsMode,
    rawFrontLanguage: list.lang_a ?? null,
    rawBackLanguage: list.lang_b ?? null,
    rawLabelA: list.labels_a ?? null,
    rawLabelB: list.labels_b ?? null,
  };
}

export function reconcileExistingListCards(
  source: SmartImportPackage,
  target: ExistingListImportTarget,
  existingCards: Array<{ term: string; translation: string }>,
): ExistingListCardReconciliation {
  const resolvedTarget = resolveSourceAwareTarget(source, target);
  const seen = new Set(existingCards.map((card) => cardIdentity(card.term, card.translation)));
  let cardsReceived = 0;
  let cardsValid = 0;
  let cardsDuplicates = 0;
  let cardsBlocked = 0;

  for (const folder of source.package.folders) {
    for (const list of folder.lists) {
      const cards = playableCards(list);
      cardsReceived += cards.length;
      if (!directionMatches(list, resolvedTarget)) {
        cardsBlocked += cards.length;
        continue;
      }
      for (const card of cards) {
        const key = cardIdentity(card.front, card.back);
        if (seen.has(key)) cardsDuplicates += 1;
        else {
          seen.add(key);
          cardsValid += 1;
        }
      }
    }
  }

  return {
    cardsReceived,
    cardsValid,
    cardsDuplicates,
    cardsBlocked,
    coherent: cardsReceived === cardsValid + cardsDuplicates + cardsBlocked,
  };
}

export function buildExistingListImportPlan(
  source: SmartImportPackage,
  target: ExistingListImportTarget,
  strategy: ExistingListImportStrategy = "append",
): ExistingListImportPreparation {
  const resolvedTarget = resolveSourceAwareTarget(source, target);
  const cards: SmartImportList["cards"] = [];
  const glossary = new Map<string, SmartGlossaryEntry>();
  const sourceGroups: ExistingListSourceGroup[] = [];
  const errors: string[] = [];
  let cardsReceived = 0;
  let cardsBlocked = 0;
  let glossaryReceived = 0;
  let glossaryDuplicates = 0;

  for (const folder of source.package.folders) {
    for (const list of folder.lists) {
      const listCards = countPlayableCards(list);
      const blocked = !directionMatches(list, resolvedTarget);
      cardsReceived += listCards;
      if (blocked) cardsBlocked += listCards;
      glossaryReceived += list.glossary.length;
      sourceGroups.push({
        folderName: folder.name,
        listName: list.name,
        cards: listCards,
        glossaryEntries: list.glossary.length,
        blocked,
      });

      if (blocked) errors.push(DIRECTION_ERROR);

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
      source_language: resolvedTarget.frontLanguage,
      target_language: resolvedTarget.backLanguage,
      level: source.package.level,
      theme: source.package.theme,
      folders: [{
        name: resolvedTarget.folderName,
        description: null,
        lists: [{
          name: resolvedTarget.listName,
          description: null,
          front_language: resolvedTarget.frontLanguage,
          back_language: resolvedTarget.backLanguage,
          primary_side: resolvedTarget.primarySide,
          study_type: resolvedTarget.studyType,
          label_a: resolvedTarget.labelA,
          label_b: resolvedTarget.labelB,
          tts_enabled: resolvedTarget.ttsEnabled,
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
        folder: { mode: "existing", folderId: resolvedTarget.folderId },
        lists: {
          0: { mode: "existing", listId: resolvedTarget.listId, strategy },
        },
      },
    },
  };

  const usedLegacyRawDirection = resolvedTarget.frontLanguage !== target.frontLanguage
    || resolvedTarget.backLanguage !== target.backLanguage;

  return {
    smartPackage,
    packageValue,
    plan,
    target: resolvedTarget,
    sourceGroups,
    summary: {
      sourceFolders: source.package.folders.length,
      sourceLists: sourceGroups.length,
      cardsReceived,
      cardsCompatible: cardsReceived - cardsBlocked,
      cardsBlocked,
      glossaryReceived,
      glossaryDuplicates,
      glossaryToImport: glossary.size,
    },
    errors: Array.from(new Set(errors)),
    warnings: [
      ...(usedLegacyRawDirection
        ? ["A lista de destino ainda usa compatibilidade antiga. A importação respeitará os idiomas A/B armazenados diretamente na lista; abra Configurações A/B e salve uma autoridade explícita para eliminar a ambiguidade."]
        : []),
      ...(glossaryDuplicates > 0
        ? [`${glossaryDuplicates} entrada(s) repetida(s) de glossário foram consolidadas.`]
        : []),
    ],
  };
}

export function existingListTargetFromRows(
  list: ExistingImportList,
  catalog: ImportDestinationCatalog,
): ExistingListImportTarget | null {
  return existingListTargetFromCatalog(catalog, list.id);
}
