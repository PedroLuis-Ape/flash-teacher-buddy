export interface GlossaryTransferEntry {
  original_text: string;
  translated_text: string;
  note?: string | null;
  side: "A" | "B";
  is_active: boolean;
}

export interface GlossaryTransferParseResult {
  entries: GlossaryTransferEntry[];
  errors: string[];
  format: "json" | "text" | "empty";
}

export type GlossaryExportFormat = "text" | "json";

const GLOSSARY_MARKER = /^[=\-]{2,}\s*GLOSS[AÁ]RIO(?:\s+GLOBAL)?(?:\s+V\d+)?\s*[=\-]{2,}$/i;
const CARDS_MARKER = /^[=\-]{2,}\s*CARDS\s*[=\-]{2,}$/i;
const TEXT_SEPARATORS = [" / ", "\t", " => ", " | "] as const;

export const normalizeGlossaryValue = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLocaleLowerCase();

export function glossaryEntryIdentity(entry: Pick<GlossaryTransferEntry, "side" | "original_text" | "translated_text">) {
  return [
    entry.side,
    normalizeGlossaryValue(entry.original_text),
    normalizeGlossaryValue(entry.translated_text),
  ].join("|");
}

export function isGlossaryOverlap(
  a: Pick<GlossaryTransferEntry, "side" | "original_text">,
  b: Pick<GlossaryTransferEntry, "side" | "original_text">,
) {
  if (a.side !== b.side) return false;
  const left = normalizeGlossaryValue(a.original_text);
  const right = normalizeGlossaryValue(b.original_text);
  if (!left || !right || left === right) return false;
  const longer = left.length >= right.length ? left : right;
  const shorter = left.length >= right.length ? right : left;
  return ` ${longer} `.includes(` ${shorter} `);
}

function normalizeEntry(raw: unknown, defaultSide: "A" | "B" = "A"): GlossaryTransferEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const original = String(value.original_text ?? value.original ?? value.term ?? "").trim();
  const translated = String(value.translated_text ?? value.translation ?? value.definition ?? "").trim();
  if (!original || !translated) return null;

  const rawSide = String(value.side ?? defaultSide).toUpperCase();
  const side = rawSide === "B" ? "B" : "A";
  const noteValue = value.note;
  const note = typeof noteValue === "string" && noteValue.trim() ? noteValue.trim() : null;
  const activeValue = value.is_active ?? value.active;
  const isActive = activeValue === false || String(activeValue).toLowerCase() === "false" ? false : true;

  return {
    original_text: original,
    translated_text: translated,
    note,
    side,
    is_active: isActive,
  };
}

function parseJson(input: string, defaultSide: "A" | "B"): GlossaryTransferParseResult | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const rows = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && Array.isArray((parsed as { entries?: unknown[] }).entries)
        ? (parsed as { entries: unknown[] }).entries
        : null;
    if (!rows) return { entries: [], errors: ["JSON sem uma lista válida de entradas."], format: "json" };

    const entries: GlossaryTransferEntry[] = [];
    const errors: string[] = [];
    rows.forEach((row, index) => {
      const entry = normalizeEntry(row, defaultSide);
      if (entry) entries.push(entry);
      else errors.push(`Entrada JSON ${index + 1} inválida.`);
    });
    return { entries: deduplicateParsed(entries), errors, format: "json" };
  } catch {
    return { entries: [], errors: ["JSON inválido."], format: "json" };
  }
}

function splitNote(line: string) {
  const marker = " || ";
  const noteIndex = line.lastIndexOf(marker);
  if (noteIndex < 0) return { body: line, note: null as string | null };
  const note = line.slice(noteIndex + marker.length).trim();
  return { body: line.slice(0, noteIndex).trim(), note: note || null };
}

function stripMetadataPrefix(line: string, defaultSide: "A" | "B") {
  let remaining = line.trim();
  let side = defaultSide;
  let isActive = true;
  let consumed = true;

  while (consumed) {
    consumed = false;
    const prefix = remaining.match(/^\[([^\]]+)\]\s*/u);
    if (!prefix) break;
    const token = prefix[1].trim().toUpperCase();
    if (token === "A" || token === "B") {
      side = token;
      remaining = remaining.slice(prefix[0].length);
      consumed = true;
    } else if (["OFF", "INATIVO", "INACTIVE"].includes(token)) {
      isActive = false;
      remaining = remaining.slice(prefix[0].length);
      consumed = true;
    } else if (["ON", "ATIVO", "ACTIVE"].includes(token)) {
      isActive = true;
      remaining = remaining.slice(prefix[0].length);
      consumed = true;
    }
  }

  return { remaining, side, isActive };
}

function findSeparator(line: string) {
  for (const separator of TEXT_SEPARATORS) {
    const index = line.indexOf(separator);
    if (index > 0) return { index, separator };
  }
  return null;
}

function deduplicateParsed(entries: GlossaryTransferEntry[]) {
  const byIdentity = new Map<string, GlossaryTransferEntry>();
  for (const entry of entries) byIdentity.set(glossaryEntryIdentity(entry), entry);
  return Array.from(byIdentity.values());
}

function parseText(input: string, defaultSide: "A" | "B"): GlossaryTransferParseResult {
  const lines = input.split(/\r?\n/u);
  const glossaryIndex = lines.findIndex((line) => GLOSSARY_MARKER.test(line.trim()));
  const cardsIndex = lines.findIndex((line) => CARDS_MARKER.test(line.trim()));
  const start = glossaryIndex >= 0 ? glossaryIndex + 1 : 0;
  const end = cardsIndex >= 0 && cardsIndex > start ? cardsIndex : lines.length;
  const entries: GlossaryTransferEntry[] = [];
  const errors: string[] = [];

  for (let index = start; index < end; index += 1) {
    const raw = lines[index].trim();
    if (!raw || raw.startsWith("#") || GLOSSARY_MARKER.test(raw)) continue;

    const metadata = stripMetadataPrefix(raw, defaultSide);
    const withNote = splitNote(metadata.remaining);
    const separator = findSeparator(withNote.body);
    if (!separator) {
      errors.push(`Linha ${index + 1}: separador não encontrado.`);
      continue;
    }

    const original = withNote.body.slice(0, separator.index).trim();
    const translated = withNote.body.slice(separator.index + separator.separator.length).trim();
    if (!original || !translated) {
      errors.push(`Linha ${index + 1}: termo ou tradução vazios.`);
      continue;
    }

    entries.push({
      original_text: original,
      translated_text: translated,
      note: withNote.note,
      side: metadata.side,
      is_active: metadata.isActive,
    });
  }

  return { entries: deduplicateParsed(entries), errors, format: "text" };
}

export function parseGlossaryTransfer(input: string, defaultSide: "A" | "B" = "A"): GlossaryTransferParseResult {
  if (!input.trim()) return { entries: [], errors: [], format: "empty" };
  return parseJson(input, defaultSide) ?? parseText(input, defaultSide);
}

function compatibilityRows(entries: GlossaryTransferEntry[]) {
  const seen = new Set<string>();
  const rows: string[] = [];

  for (const entry of entries) {
    if (!entry.is_active) continue;
    const original = entry.side === "A" ? entry.original_text : entry.translated_text;
    const translated = entry.side === "A" ? entry.translated_text : entry.original_text;
    const key = `${normalizeGlossaryValue(original)}|${normalizeGlossaryValue(translated)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(`${original.replace(/[\r\n]+/g, " ").trim()} / ${translated.replace(/[\r\n]+/g, " ").trim()}`);
  }
  return rows;
}

export function serializeGlossaryTransfer(entries: GlossaryTransferEntry[], format: GlossaryExportFormat) {
  if (format === "json") {
    return JSON.stringify(
      {
        schema: "app-piteco-glossary",
        version: 2,
        exported_at: new Date().toISOString(),
        entries: entries.map((entry) => ({
          original_text: entry.original_text,
          translated_text: entry.translated_text,
          note: entry.note ?? null,
          side: entry.side,
          is_active: entry.is_active,
        })),
      },
      null,
      2,
    );
  }

  const rows = compatibilityRows(entries);
  return ["=== GLOSSÁRIO GLOBAL ===", ...rows, "=== CARDS ==="].join("\n");
}
