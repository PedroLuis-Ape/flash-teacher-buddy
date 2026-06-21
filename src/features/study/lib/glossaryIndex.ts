import type { GlossaryItem } from "./glossaryMerge";

export interface IndexedGlossaryMatch {
  matchText: string;
  translationText: string;
  note?: string | null;
}

type GlossaryIndex = Map<string, IndexedGlossaryMatch[]>;

const WORD_TOKEN_REGEX = /[\p{L}\p{M}\p{N}_]+(?:['’\-][\p{L}\p{M}\p{N}_]+)*/gu;
const indexCache = new WeakMap<GlossaryItem[], GlossaryIndex>();

const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase();

function firstToken(value: string) {
  return normalize(value).match(WORD_TOKEN_REGEX)?.[0] ?? normalize(value);
}

function splitAlternatives(value: string) {
  const unique = new Map<string, string>();
  value.split(/\s*[,;]\s*/u).forEach((part) => {
    const clean = part.trim();
    const key = normalize(clean);
    if (clean && !unique.has(key)) unique.set(key, clean);
  });
  return Array.from(unique.values());
}

function addMatch(index: GlossaryIndex, side: "A" | "B", match: IndexedGlossaryMatch) {
  const token = firstToken(match.matchText);
  if (!token) return;
  const key = `${side}|${token}`;
  const bucket = index.get(key) ?? [];
  bucket.push(match);
  index.set(key, bucket);
}

export function buildGlossaryIndex(glossary: GlossaryItem[]): GlossaryIndex {
  const cached = indexCache.get(glossary);
  if (cached) return cached;

  const index: GlossaryIndex = new Map();
  for (const entry of glossary) {
    if (!entry.is_active) continue;

    addMatch(index, entry.side, {
      matchText: entry.original_text,
      translationText: entry.translated_text,
      note: entry.note,
    });

    const reverseSide = entry.side === "A" ? "B" : "A";
    for (const alternative of splitAlternatives(entry.translated_text)) {
      addMatch(index, reverseSide, {
        matchText: alternative,
        translationText: entry.original_text,
        note: entry.note,
      });
    }
  }

  indexCache.set(glossary, index);
  return index;
}

export function findRelevantGlossaryMatches(
  text: string,
  side: "A" | "B",
  glossary: GlossaryItem[],
): IndexedGlossaryMatch[] {
  const index = buildGlossaryIndex(glossary);
  const tokens = new Set(
    Array.from(text.matchAll(WORD_TOKEN_REGEX), (match) => normalize(match[0])),
  );
  const result: IndexedGlossaryMatch[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    for (const candidate of index.get(`${side}|${token}`) ?? []) {
      const key = [
        normalize(candidate.matchText),
        normalize(candidate.translationText),
        candidate.note ?? "",
      ].join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(candidate);
    }
  }

  return result;
}
