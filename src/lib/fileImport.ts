/**
 * File import helpers for BulkImportDialog.
 *
 * Converts uploaded .txt / .csv / .tsv files into the textual format the
 * existing importer already understands ("Lado A / Lado B" lines,
 * optionally wrapped in === CARDS ===).
 *
 * This module is intentionally small and pure — no React, no DOM.
 */

export const MAX_IMPORT_FILE_BYTES = 2 * 1024 * 1024; // 2 MB

export type SupportedKind = "txt" | "csv" | "tsv";

export function detectKindFromName(name: string): SupportedKind | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".tsv")) return "tsv";
  if (lower.endsWith(".txt")) return "txt";
  return null;
}

/** Headers recognized as "skip the first row". */
const HEADER_TOKENS = new Set([
  "lado a", "lado b", "lado_a", "lado_b",
  "português", "portugues", "inglês", "ingles",
  "pt", "en", "front", "back",
  "term", "translation", "pergunta", "resposta",
  "termo", "tradução", "traducao",
]);

function isHeaderRow(cells: string[]): boolean {
  if (cells.length < 2) return false;
  const a = cells[0].trim().toLowerCase();
  const b = cells[1].trim().toLowerCase();
  return HEADER_TOKENS.has(a) && HEADER_TOKENS.has(b);
}

/**
 * Detect the most likely CSV separator by counting occurrences on the
 * first non-empty lines. Supports comma, semicolon and tab.
 */
export function detectSeparator(text: string): "," | ";" | "\t" {
  const sample = text.split(/\r?\n/).filter(l => l.trim()).slice(0, 10).join("\n");
  const counts = {
    ",": (sample.match(/,/g) || []).length,
    ";": (sample.match(/;/g) || []).length,
    "\t": (sample.match(/\t/g) || []).length,
  };
  // Tab wins if present; otherwise pick the most common.
  if (counts["\t"] > 0 && counts["\t"] >= counts[","] && counts["\t"] >= counts[";"]) return "\t";
  if (counts[";"] > counts[","]) return ";";
  return ",";
}

/**
 * Minimal CSV/TSV row parser. Handles quoted cells, escaped quotes ("")
 * and embedded separators inside quotes. Does NOT handle multi-line
 * cells (rare in flashcard exports and out of scope for v1).
 */
export function parseDelimitedLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuotes = false; }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === sep) { out.push(cur); cur = ""; }
      else { cur += ch; }
    }
  }
  out.push(cur);
  return out;
}

/**
 * Convert raw file content into the textual format the existing
 * importer understands. Returns the converted text plus a count of
 * cards detected (for the toast).
 */
export function convertFileToImportText(
  kind: SupportedKind,
  content: string,
): { text: string; cardCount: number } {
  // TXT: pass through as-is. The existing parser handles === markers,
  // [CAMADAS], and plain "A / B" lines.
  if (kind === "txt") {
    const trimmed = content.replace(/^\uFEFF/, ""); // strip BOM
    const hasMarker = /===\s*CARDS\s*===/i.test(trimmed) || /\[CAMADAS\]/i.test(trimmed);
    if (hasMarker) return { text: trimmed, cardCount: countSlashLines(trimmed) };
    // Pure line-based TXT: prepend === CARDS === so users see the structure.
    return { text: `=== CARDS ===\n${trimmed.trim()}`, cardCount: countSlashLines(trimmed) };
  }

  const sep = kind === "tsv" ? "\t" : detectSeparator(content);
  const rawLines = content.replace(/^\uFEFF/, "").split(/\r?\n/);
  const rows: string[][] = [];
  for (const line of rawLines) {
    if (!line.trim()) continue;
    const cells = parseDelimitedLine(line, sep).map(c => c.trim());
    if (cells.length < 2) continue;
    rows.push(cells);
  }
  if (rows.length === 0) return { text: "=== CARDS ===\n", cardCount: 0 };

  // Skip header row if it looks like one.
  const startIdx = isHeaderRow(rows[0]) ? 1 : 0;
  const out: string[] = ["=== CARDS ==="];
  let count = 0;
  for (let i = startIdx; i < rows.length; i++) {
    const [a, b] = rows[i];
    if (!a || !b) continue;
    out.push(`${a} / ${b}`);
    count++;
  }
  return { text: out.join("\n"), cardCount: count };
}

function countSlashLines(text: string): number {
  let n = 0;
  for (const l of text.split(/\r?\n/)) {
    if (l.includes(" / ")) n++;
  }
  return n;
}
