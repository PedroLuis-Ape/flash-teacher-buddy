/**
 * Layered import parser.
 *
 * Recognizes input where a single "main word" has multiple meaning layers.
 * Two formats accepted (mutually compatible — parser detects both):
 *
 * Format A — header + indented children:
 *   get
 *     pegar / conseguir | I got a new phone. | Eu consegui um celular novo.
 *     entender | I get it. | Eu entendi.
 *     chegar | I got home late. | Eu cheguei em casa tarde.
 *
 * Format B — repeated term in column A (consecutive lines):
 *   get / pegar / conseguir | I got a new phone. | Eu consegui um celular novo.
 *   get / entender | I get it. | Eu entendi.
 *   get / chegar | I got home late. | Eu cheguei em casa tarde.
 *
 * Each child line uses " | " (or " / ") as inner separator and may carry
 * up to 3 fields:  translation | example | example_translation
 *
 * Pure function. Safe to call always — when no layered structure is detected
 * it returns an empty `groups` array and the caller falls back to the legacy
 * flat parser.
 */

export interface LayerInput {
  translation: string;
  example?: string;
  exampleTranslation?: string;
  contextTag?: string;
  shortExplanation?: string;
}

export interface LayeredGroup {
  /** Term shared by all layers (the "main word"). */
  term: string;
  layers: LayerInput[];
}

export interface LayeredParseResult {
  groups: LayeredGroup[];
  /** Raw lines that did NOT belong to any group (for fallback to flat parser). */
  leftover: string[];
}

export interface CamadasBlockResult {
  /** Original input with the `[CAMADAS] ... ` block removed. */
  cleanedInput: string;
  /** Layered groups extracted from inside `[CAMADAS]`. */
  groups: LayeredGroup[];
  /** Lines whose left side looks like a full sentence (≥ 4 words). */
  sentenceWarnings: string[];
  /**
   * Terms that appeared only once inside `[CAMADAS]` and were therefore
   * moved back into the normal-cards stream (a layered card requires ≥ 2
   * meanings for the same term). Useful for showing a clear preview hint.
   */
  singletonWarnings: string[];
  /** Whether a `[CAMADAS]` marker was found. */
  found: boolean;
}

const INNER_SEPS = [" | ", " / ", "\t"];

function splitInner(line: string): string[] {
  for (const sep of INNER_SEPS) {
    if (line.includes(sep)) {
      return line.split(sep).map((s) => s.trim()).filter(Boolean);
    }
  }
  return [line.trim()];
}

function buildLayer(parts: string[]): LayerInput | null {
  const [translation, example, exampleTranslation] = parts;
  if (!translation) return null;
  return {
    translation: translation.trim(),
    example: example?.trim() || undefined,
    exampleTranslation: exampleTranslation?.trim() || undefined,
  };
}

/** Detect leading whitespace count. */
function indent(line: string): number {
  const m = line.match(/^(\s*)/);
  return m ? m[1].replace(/\t/g, "  ").length : 0;
}

export function parseLayeredInput(input: string): LayeredParseResult {
  const rawLines = input.split(/\r?\n/);
  const groups: LayeredGroup[] = [];
  const leftover: string[] = [];

  let current: LayeredGroup | null = null;
  let baseIndent = 0;

  // Pass 1 — detect Format A (header + indented).
  for (const raw of rawLines) {
    if (!raw.trim()) {
      // Blank line closes a group.
      if (current && current.layers.length > 0) groups.push(current);
      current = null;
      continue;
    }
    const ind = indent(raw);
    const trimmed = raw.trim();

    if (ind === 0) {
      // Potential header: must NOT contain an inner separator (otherwise it's
      // a flat card line). Then next non-empty line must be indented.
      const looksLikeHeader =
        !trimmed.includes(" | ") &&
        !trimmed.includes(" / ") &&
        !trimmed.includes("\t") &&
        trimmed.length <= 80;
      if (current && current.layers.length > 0) groups.push(current);
      if (looksLikeHeader) {
        current = { term: trimmed, layers: [] };
        baseIndent = 0;
      } else {
        current = null;
        leftover.push(raw);
      }
    } else {
      // Indented line — child of current header.
      if (!current) {
        leftover.push(raw);
        continue;
      }
      if (baseIndent === 0) baseIndent = ind;
      const parts = splitInner(trimmed);
      const layer = buildLayer(parts);
      if (layer) current.layers.push(layer);
    }
  }
  if (current && current.layers.length > 0) groups.push(current);

  // Pass 2 — detect Format B (repeated term in flat lines from leftover).
  // Group consecutive lines that share the same first segment.
  const flatGroups = groupRepeatedTerms(leftover);
  for (const g of flatGroups.groups) groups.push(g);

  return { groups, leftover: flatGroups.leftover };
}

function groupRepeatedTerms(lines: string[]): LayeredParseResult {
  const groups: LayeredGroup[] = [];
  const leftover: string[] = [];

  type Parsed = { term: string; rest: string[] };
  const parsed: Parsed[] = lines
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const parts = splitInner(l);
      if (parts.length < 2) return null;
      return { term: parts[0], rest: parts.slice(1) };
    })
    .filter((p): p is Parsed => !!p);

  let i = 0;
  while (i < parsed.length) {
    const term = parsed[i].term;
    let j = i + 1;
    while (j < parsed.length && parsed[j].term.toLowerCase() === term.toLowerCase()) j++;
    if (j - i >= 2) {
      // Group of repeats.
      const layers: LayerInput[] = [];
      for (let k = i; k < j; k++) {
        const layer = buildLayer(parsed[k].rest);
        if (layer) layers.push(layer);
      }
      if (layers.length >= 2) groups.push({ term, layers });
      else for (let k = i; k < j; k++) leftover.push(lines[k]);
    } else {
      leftover.push(lines[i] ?? "");
    }
    i = j;
  }

  return { groups, leftover };
}

/** Heuristic for the merge-suggestion title: longest common prefix of terms. */
export function suggestMainTitle(terms: string[]): string {
  if (terms.length === 0) return "";
  if (terms.length === 1) return terms[0];
  const sorted = [...terms].map((t) => t.trim()).sort();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  let i = 0;
  while (i < first.length && first[i] === last[i]) i++;
  const common = first.slice(0, i).trim();
  return common.length >= 2 ? common : terms[0];
}

/**
 * Extract the `[CAMADAS]` block from a CARDS section.
 *
 * Block format:
 *   [CAMADAS]
 *   work / trabalhar
 *   work / funcionar
 *   look up / pesquisar
 *
 * Lines are parsed as `term / translation`. Lines sharing the same `term`
 * (case-insensitive) are grouped into a single layered card. Single-occurrence
 * terms also become valid layered cards (1 layer).
 *
 * The block ends at the next `=== ... ===` marker, the next `[XYZ]`-style
 * marker, or end-of-input.
 *
 * Returns the input with the block removed so the caller can run its normal
 * flat parser on the remainder.
 */
export function extractCamadasBlock(input: string): CamadasBlockResult {
  const lines = input.split(/\r?\n/);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*\[CAMADAS\]\s*$/i.test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start === -1) {
    return {
      cleanedInput: input,
      groups: [],
      sentenceWarnings: [],
      singletonWarnings: [],
      found: false,
    };
  }

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (/^===.*===$/.test(t) || /^\[[^\]]+\]$/.test(t)) {
      end = i;
      break;
    }
  }

  const blockLines = lines.slice(start + 1, end);

  // Preserve insertion order while collecting per-term layers + the raw lines
  // they came from (so we can re-emit singletons as normal cards).
  type Bucket = { term: string; layers: LayerInput[]; rawLines: string[] };
  const map = new Map<string, Bucket>();
  const sentenceWarnings: string[] = [];

  for (const raw of blockLines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const parts = splitInner(trimmed);
    if (parts.length < 2) continue;
    const term = parts[0];
    const layer = buildLayer(parts.slice(1));
    if (!term || !layer) continue;

    // Heuristic: warn if "term" is a full sentence (≥ 4 words). Phrasal verbs
    // and short expressions are allowed.
    if (term.split(/\s+/).length >= 4) {
      sentenceWarnings.push(trimmed);
    }

    const key = term.toLowerCase();
    const existing = map.get(key);
    if (existing) {
      existing.layers.push(layer);
      existing.rawLines.push(trimmed);
    } else {
      map.set(key, { term, layers: [layer], rawLines: [trimmed] });
    }
  }

  // Enforce: a layered card REQUIRES ≥ 2 layers. Singletons fall back to
  // normal cards (re-appended to the cleaned input) and are reported via
  // `singletonWarnings` so the UI can explain what happened.
  const groups: LayeredGroup[] = [];
  const singletonWarnings: string[] = [];
  const singletonLines: string[] = [];
  for (const bucket of map.values()) {
    if (bucket.layers.length >= 2) {
      groups.push({ term: bucket.term, layers: bucket.layers });
    } else {
      singletonWarnings.push(bucket.term);
      singletonLines.push(...bucket.rawLines);
    }
  }

  const before = lines.slice(0, start);
  const after = lines.slice(end);
  const cleanedInput = [...before, ...singletonLines, ...after].join("\n");

  return {
    cleanedInput,
    groups,
    sentenceWarnings,
    singletonWarnings,
    found: true,
  };
}