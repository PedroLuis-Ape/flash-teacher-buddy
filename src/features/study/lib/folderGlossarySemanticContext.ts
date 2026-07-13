import { folderGlossaryIdentity } from "./folderGlossaryCompact";
import type {
  FolderGlossaryCoverageReport,
  FolderGlossaryCoverageTerm,
} from "./folderGlossaryCoverage";
import type { FolderGlossaryEntry, GlossarySide } from "./folderGlossaryTypes";
import { findGlossaryOccurrences } from "./glossaryLayers";

const TOKEN_REGEX = /[\p{L}\p{M}\p{N}_]+(?:['‘’‛′＇\-‐‑‒–—−][\p{L}\p{M}\p{N}_]+)*/gu;

function tokens(value: string): string[] {
  return Array.from(value.matchAll(TOKEN_REGEX), (match) =>
    folderGlossaryIdentity(match[0]));
}

function firstToken(value: string): string {
  return tokens(value)[0] ?? folderGlossaryIdentity(value);
}

function expressionIndex(entries: FolderGlossaryEntry[]) {
  const index = new Map<string, FolderGlossaryEntry[]>();
  for (const entry of entries) {
    if (!entry.is_active || !/\s/u.test(entry.original_text.trim())) continue;
    const token = firstToken(entry.original_text);
    if (!token) continue;
    const key = `${entry.side}|${token}`;
    const bucket = index.get(key) ?? [];
    bucket.push(entry);
    index.set(key, bucket);
  }
  return index;
}

function expressionsInTermExamples(
  term: FolderGlossaryCoverageTerm,
  index: Map<string, FolderGlossaryEntry[]>,
): FolderGlossaryEntry[] {
  const candidates = new Map<string, FolderGlossaryEntry>();
  const matched = new Map<string, FolderGlossaryEntry>();

  for (const example of term.examples) {
    if (example.side !== term.side) continue;
    for (const token of new Set(tokens(example.text))) {
      for (const entry of index.get(`${term.side}|${token}`) ?? []) {
        candidates.set(entry.id, entry);
      }
    }

    for (const entry of candidates.values()) {
      if (matched.has(entry.id)) continue;
      if (findGlossaryOccurrences(example.text, entry.original_text).length > 0) {
        matched.set(entry.id, entry);
      }
    }
  }

  return Array.from(matched.values());
}

/**
 * A cobertura exata classifica primeiro a palavra individual. Por isso, uma
 * expressão sobreposta pode não entrar em usedGlossaryEntryIds quando todas as
 * palavras dela também existem. A revisão semântica precisa enxergar as duas
 * camadas. Este enriquecimento é somente em memória e não altera percentuais,
 * status, cards ou dados do banco.
 */
export function enrichSemanticCoverageReport(
  report: FolderGlossaryCoverageReport,
  glossary: FolderGlossaryEntry[],
): FolderGlossaryCoverageReport {
  const index = expressionIndex(glossary);
  if (index.size === 0) return report;

  const usedEntryIds = new Set(report.usedGlossaryEntryIds);
  let changed = false;
  const enrichedTerms = report.terms.map((term) => {
    const expressions = expressionsInTermExamples(term, index);
    if (expressions.length === 0) return term;

    const matchedTerms = new Map(
      term.matchedGlossaryTerms.map((value) => [folderGlossaryIdentity(value), value]),
    );
    for (const entry of expressions) {
      usedEntryIds.add(entry.id);
      const identity = folderGlossaryIdentity(entry.original_text);
      if (!matchedTerms.has(identity)) {
        matchedTerms.set(identity, entry.original_text);
        changed = true;
      }
    }

    return {
      ...term,
      matchedGlossaryTerms: Array.from(matchedTerms.values()),
    };
  });

  if (!changed && usedEntryIds.size === report.usedGlossaryEntryIds.length) {
    return report;
  }

  return {
    ...report,
    usedGlossaryEntryIds: Array.from(usedEntryIds),
    terms: enrichedTerms,
  };
}

export function semanticContextKey(side: GlossarySide, value: string): string {
  return `${side}|${folderGlossaryIdentity(value)}`;
}
