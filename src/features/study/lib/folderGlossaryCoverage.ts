import { supabase } from "@/integrations/supabase/client";
import { findGlossaryOccurrences } from "./glossaryLayers";
import type { FolderGlossaryEntry, GlossarySide } from "./folderGlossaryTypes";

const TOKEN_REGEX = /[\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*/gu;
const QUERY_CHUNK_SIZE = 50;
const PAGE_SIZE = 1_000;
const MAX_EXAMPLES_PER_TERM = 5;

export type FolderGlossaryCoverageStatus =
  | "covered"
  | "expression"
  | "inactive"
  | "wrong_side"
  | "missing";

export interface FolderGlossaryCoverageOccurrence {
  cardId: string;
  listId: string;
  listTitle: string;
  side: GlossarySide;
  text: string;
}

export interface FolderGlossaryCoverageTerm {
  term: string;
  normalized: string;
  side: GlossarySide;
  status: FolderGlossaryCoverageStatus;
  occurrenceCount: number;
  cardCount: number;
  listCount: number;
  examples: FolderGlossaryCoverageOccurrence[];
  matchedGlossaryTerms: string[];
  statusCounts: Record<FolderGlossaryCoverageStatus, number>;
}

export interface FolderGlossaryCoverageReport {
  folderId: string;
  generatedAt: string;
  listsScanned: number;
  cardsScanned: number;
  distinctTerms: number;
  coveredTerms: number;
  expressionTerms: number;
  inactiveTerms: number;
  wrongSideTerms: number;
  missingTerms: number;
  coveredOccurrences: number;
  totalOccurrences: number;
  usedGlossaryEntryIds: string[];
  terms: FolderGlossaryCoverageTerm[];
}

export interface CoverageListRow {
  id: string;
  title: string;
}

export interface CoverageCardRow {
  id: string;
  list_id: string;
  term: string;
  translation: string;
}

export interface FolderGlossaryCoverageAnalysisInput {
  folderId: string;
  lists: CoverageListRow[];
  cards: CoverageCardRow[];
  glossary: FolderGlossaryEntry[];
}

interface MutableCoverageTerm {
  term: string;
  normalized: string;
  side: GlossarySide;
  statusCounts: Record<FolderGlossaryCoverageStatus, number>;
  cardIds: Set<string>;
  listIds: Set<string>;
  examples: FolderGlossaryCoverageOccurrence[];
  matchedGlossaryTerms: Map<string, string>;
}

interface ExpressionSpan {
  startIndex: number;
  endIndex: number;
  entry: FolderGlossaryEntry;
}

interface CoverageWorkerSuccess {
  ok: true;
  report: FolderGlossaryCoverageReport;
}

interface CoverageWorkerFailure {
  ok: false;
  error: string;
}

type CoverageWorkerResponse = CoverageWorkerSuccess | CoverageWorkerFailure;

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function chunk<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function tokenMatches(text: string) {
  return Array.from(text.matchAll(TOKEN_REGEX), (match) => ({
    value: match[0],
    normalized: normalize(match[0]),
    startIndex: match.index ?? 0,
    endIndex: (match.index ?? 0) + match[0].length,
  }));
}

function firstToken(value: string): string {
  return tokenMatches(value)[0]?.normalized ?? normalize(value);
}

function emptyStatusCounts(): Record<FolderGlossaryCoverageStatus, number> {
  return {
    covered: 0,
    expression: 0,
    inactive: 0,
    wrong_side: 0,
    missing: 0,
  };
}

function finalStatus(
  counts: Record<FolderGlossaryCoverageStatus, number>,
): FolderGlossaryCoverageStatus {
  if (counts.missing > 0) return "missing";
  if (counts.inactive > 0) return "inactive";
  if (counts.wrong_side > 0) return "wrong_side";
  if (counts.expression > 0) return "expression";
  return "covered";
}

function mapEntriesBySide(entries: FolderGlossaryEntry[], active: boolean) {
  const maps: Record<GlossarySide, Map<string, FolderGlossaryEntry[]>> = {
    A: new Map(),
    B: new Map(),
  };

  for (const entry of entries) {
    if (entry.is_active !== active) continue;
    const key = normalize(entry.original_text);
    if (!key) continue;
    const bucket = maps[entry.side].get(key) ?? [];
    bucket.push(entry);
    maps[entry.side].set(key, bucket);
  }
  return maps;
}

function buildExpressionIndex(entries: FolderGlossaryEntry[]) {
  const index: Record<GlossarySide, Map<string, FolderGlossaryEntry[]>> = {
    A: new Map(),
    B: new Map(),
  };

  for (const entry of entries) {
    if (!entry.is_active || !/\s/u.test(entry.original_text.trim())) continue;
    const key = firstToken(entry.original_text);
    if (!key) continue;
    const bucket = index[entry.side].get(key) ?? [];
    bucket.push(entry);
    index[entry.side].set(key, bucket);
  }
  return index;
}

function expressionSpansForText(
  text: string,
  side: GlossarySide,
  expressionIndex: Record<GlossarySide, Map<string, FolderGlossaryEntry[]>>,
): ExpressionSpan[] {
  const spans: ExpressionSpan[] = [];
  const candidateEntries = new Map<string, FolderGlossaryEntry>();

  for (const token of tokenMatches(text)) {
    for (const entry of expressionIndex[side].get(token.normalized) ?? []) {
      candidateEntries.set(entry.id, entry);
    }
  }

  for (const entry of candidateEntries.values()) {
    for (const occurrence of findGlossaryOccurrences(text, entry.original_text)) {
      spans.push({ ...occurrence, entry });
    }
  }
  return spans;
}

function classifyOccurrence(input: {
  normalized: string;
  startIndex: number;
  endIndex: number;
  side: GlossarySide;
  activeBySide: Record<GlossarySide, Map<string, FolderGlossaryEntry[]>>;
  inactiveBySide: Record<GlossarySide, Map<string, FolderGlossaryEntry[]>>;
  expressionSpans: ExpressionSpan[];
}): { status: FolderGlossaryCoverageStatus; matches: FolderGlossaryEntry[] } {
  const exactActive = input.activeBySide[input.side].get(input.normalized) ?? [];
  if (exactActive.length > 0) return { status: "covered", matches: exactActive };

  const expressionMatches = input.expressionSpans
    .filter((span) => span.startIndex < input.endIndex && span.endIndex > input.startIndex)
    .map((span) => span.entry);
  if (expressionMatches.length > 0) {
    return { status: "expression", matches: expressionMatches };
  }

  const inactive = input.inactiveBySide[input.side].get(input.normalized) ?? [];
  if (inactive.length > 0) return { status: "inactive", matches: inactive };

  const reverseSide: GlossarySide = input.side === "A" ? "B" : "A";
  const wrongSide = input.activeBySide[reverseSide].get(input.normalized) ?? [];
  if (wrongSide.length > 0) return { status: "wrong_side", matches: wrongSide };

  return { status: "missing", matches: [] };
}

export function analyzeFolderGlossaryCoverageRows(
  input: FolderGlossaryCoverageAnalysisInput,
): FolderGlossaryCoverageReport {
  const listTitles = new Map(input.lists.map((list) => [list.id, list.title]));
  const activeBySide = mapEntriesBySide(input.glossary, true);
  const inactiveBySide = mapEntriesBySide(input.glossary, false);
  const expressionIndex = buildExpressionIndex(input.glossary);
  const terms = new Map<string, MutableCoverageTerm>();
  const usedGlossaryEntryIds = new Set<string>();
  let totalOccurrences = 0;
  let coveredOccurrences = 0;

  const processText = (
    card: CoverageCardRow,
    side: GlossarySide,
    text: string,
  ) => {
    if (!text?.trim()) return;
    const expressionSpans = expressionSpansForText(text, side, expressionIndex);

    for (const token of tokenMatches(text)) {
      if (!token.normalized) continue;
      totalOccurrences += 1;
      const classification = classifyOccurrence({
        normalized: token.normalized,
        startIndex: token.startIndex,
        endIndex: token.endIndex,
        side,
        activeBySide,
        inactiveBySide,
        expressionSpans,
      });
      if (classification.status === "covered" || classification.status === "expression") {
        coveredOccurrences += 1;
      }
      classification.matches.forEach((entry) => usedGlossaryEntryIds.add(entry.id));

      const key = `${side}|${token.normalized}`;
      const current = terms.get(key) ?? {
        term: token.value,
        normalized: token.normalized,
        side,
        statusCounts: emptyStatusCounts(),
        cardIds: new Set<string>(),
        listIds: new Set<string>(),
        examples: [],
        matchedGlossaryTerms: new Map<string, string>(),
      };
      current.statusCounts[classification.status] += 1;
      current.cardIds.add(card.id);
      current.listIds.add(card.list_id);
      for (const entry of classification.matches) {
        current.matchedGlossaryTerms.set(normalize(entry.original_text), entry.original_text);
      }
      if (current.examples.length < MAX_EXAMPLES_PER_TERM) {
        current.examples.push({
          cardId: card.id,
          listId: card.list_id,
          listTitle: listTitles.get(card.list_id) ?? "Lista sem nome",
          side,
          text,
        });
      }
      terms.set(key, current);
    }
  };

  for (const card of input.cards) {
    processText(card, "A", card.term);
    processText(card, "B", card.translation);
  }

  const finalized: FolderGlossaryCoverageTerm[] = Array.from(terms.values()).map((term) => ({
    term: term.term,
    normalized: term.normalized,
    side: term.side,
    status: finalStatus(term.statusCounts),
    occurrenceCount: Object.values(term.statusCounts).reduce((sum, value) => sum + value, 0),
    cardCount: term.cardIds.size,
    listCount: term.listIds.size,
    examples: term.examples,
    matchedGlossaryTerms: Array.from(term.matchedGlossaryTerms.values()),
    statusCounts: term.statusCounts,
  })).sort((left, right) => {
    const statusOrder: Record<FolderGlossaryCoverageStatus, number> = {
      missing: 0,
      inactive: 1,
      wrong_side: 2,
      expression: 3,
      covered: 4,
    };
    return statusOrder[left.status] - statusOrder[right.status]
      || right.occurrenceCount - left.occurrenceCount
      || left.term.localeCompare(right.term);
  });

  const countStatus = (status: FolderGlossaryCoverageStatus) =>
    finalized.filter((term) => term.status === status).length;

  return {
    folderId: input.folderId,
    generatedAt: new Date().toISOString(),
    listsScanned: input.lists.length,
    cardsScanned: input.cards.length,
    distinctTerms: finalized.length,
    coveredTerms: countStatus("covered"),
    expressionTerms: countStatus("expression"),
    inactiveTerms: countStatus("inactive"),
    wrongSideTerms: countStatus("wrong_side"),
    missingTerms: countStatus("missing"),
    coveredOccurrences,
    totalOccurrences,
    usedGlossaryEntryIds: Array.from(usedGlossaryEntryIds),
    terms: finalized,
  };
}

async function loadFolderLists(folderId: string): Promise<CoverageListRow[]> {
  const { data, error } = await supabase
    .from("lists")
    .select("id, title")
    .eq("folder_id", folderId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CoverageListRow[];
}

async function loadFolderCards(listIds: string[]): Promise<CoverageCardRow[]> {
  const result: CoverageCardRow[] = [];
  for (const ids of chunk(listIds, QUERY_CHUNK_SIZE)) {
    let offset = 0;
    while (true) {
      const { data, error } = await supabase
        .from("flashcards")
        .select("id, list_id, term, translation")
        .in("list_id", ids)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw error;
      const page = (data ?? []) as CoverageCardRow[];
      result.push(...page);
      if (page.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
  }
  return result;
}

export function analyzeFolderGlossaryCoverageOffThread(
  input: FolderGlossaryCoverageAnalysisInput,
): Promise<FolderGlossaryCoverageReport> {
  if (typeof Worker === "undefined") {
    return Promise.resolve(analyzeFolderGlossaryCoverageRows(input));
  }

  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("./folderGlossaryCoverage.worker.ts", import.meta.url),
      { type: "module", name: "folder-glossary-coverage" },
    );
    let settled = false;

    const close = () => {
      worker.terminate();
    };

    worker.onmessage = (event: MessageEvent<CoverageWorkerResponse>) => {
      if (settled) return;
      settled = true;
      close();
      if (event.data.ok) {
        resolve(event.data.report);
      } else {
        reject(new Error(event.data.error));
      }
    };

    worker.onerror = (event) => {
      if (settled) return;
      settled = true;
      close();
      reject(new Error(event.message || "Não foi possível iniciar a auditoria em segundo plano."));
    };

    worker.postMessage(input);
  });
}

export async function loadFolderGlossaryCoverage(
  folderId: string,
  glossary: FolderGlossaryEntry[],
): Promise<FolderGlossaryCoverageReport> {
  const lists = await loadFolderLists(folderId);
  const cards = lists.length > 0
    ? await loadFolderCards(lists.map((list) => list.id))
    : [];
  return analyzeFolderGlossaryCoverageOffThread({ folderId, lists, cards, glossary });
}

export function serializeMissingCoverageTerms(input: {
  folderTitle: string;
  report: FolderGlossaryCoverageReport;
}): string {
  const pending = input.report.terms.filter((term) =>
    term.status === "missing" || term.status === "wrong_side" || term.status === "inactive");

  return JSON.stringify({
    schema: "app-piteco-folder-glossary",
    version: "1.0",
    folder: { name: input.folderTitle },
    audit: {
      type: "coverage-gaps",
      generated_at: input.report.generatedAt,
      instructions: [
        "Preencha translation para cada entrada.",
        "Mantenha side exatamente como A ou B.",
        "Não remova term, occurrences nem examples.",
        "Devolva o mesmo objeto como JSON puro, sem Markdown.",
      ],
    },
    entries: pending.map((term) => ({
      term: term.term,
      translation: "",
      alternatives: [],
      note: null,
      side: term.side,
      active: true,
      coverage_status: term.status,
      occurrences: term.occurrenceCount,
      examples: term.examples.map((example) => ({
        list: example.listTitle,
        side: example.side,
        text: example.text,
      })),
    })),
  }, null, 2);
}

export function serializeUsedCoverageEntries(input: {
  folderTitle: string;
  report: FolderGlossaryCoverageReport;
  glossary: FolderGlossaryEntry[];
}): string {
  const used = new Set(input.report.usedGlossaryEntryIds);
  return JSON.stringify({
    schema: "app-piteco-folder-glossary",
    version: "1.0",
    folder: { name: input.folderTitle },
    audit: {
      type: "used-entries",
      generated_at: input.report.generatedAt,
    },
    entries: input.glossary
      .filter((entry) => used.has(entry.id))
      .map((entry) => ({
        term: entry.original_text,
        translation: entry.primary_translation,
        alternatives: entry.alternative_translations,
        note: entry.note,
        side: entry.side,
        source_language: entry.source_language,
        target_language: entry.target_language,
        active: entry.is_active,
      })),
  }, null, 2);
}
