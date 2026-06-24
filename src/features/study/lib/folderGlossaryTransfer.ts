import type { FolderGlossaryEntry, FolderGlossaryInput } from "./folderGlossaryTypes";

function sanitizeFolderGlossaryJsonText(text: string): string {
  const withoutBom = text.replace(/^\uFEFF/u, "").trim();
  const fenced = withoutBom.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/iu);
  return (fenced?.[1] ?? withoutBom).trim();
}

function describeJsonSyntaxError(error: unknown, text: string): string {
  if (!(error instanceof SyntaxError)) return "JSON inválido.";

  const positionMatch = error.message.match(/position\s+(\d+)/iu);
  const position = positionMatch ? Number(positionMatch[1]) : Number.NaN;
  if (!Number.isFinite(position)) {
    return `JSON inválido: ${error.message}`;
  }

  const beforeError = text.slice(0, position);
  const line = beforeError.split("\n").length;
  const lastLineBreak = beforeError.lastIndexOf("\n");
  const column = position - lastLineBreak;

  return `JSON inválido na linha ${line}, coluna ${column}. Selecione o arquivo .json original ou confira se o conteúdo foi copiado por inteiro.`;
}

export function normalizeFolderGlossaryInput(value: unknown): FolderGlossaryInput | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const term = String(row.term ?? row.original_text ?? "").trim();
  const translation = String(row.translation ?? row.primary_translation ?? "").trim();
  if (!term || !translation) return null;
  const alternativesRaw = row.alternatives ?? row.alternative_translations;
  const alternatives = Array.isArray(alternativesRaw)
    ? alternativesRaw.map(String).map((item) => item.trim()).filter(Boolean)
    : typeof alternativesRaw === "string"
      ? alternativesRaw.split(/[,;]\s*/u).map((item) => item.trim()).filter(Boolean)
      : [];
  return {
    term,
    translation,
    alternatives,
    note: typeof row.note === "string" ? row.note.trim() || null : null,
    side: String(row.side ?? "A").toUpperCase() === "B" ? "B" : "A",
    source_language: typeof row.source_language === "string" ? row.source_language : null,
    target_language: typeof row.target_language === "string" ? row.target_language : null,
    active: row.active === false || row.is_active === false ? false : true,
  };
}

export function parseFolderGlossaryJson(text: string): FolderGlossaryInput[] {
  const normalizedText = sanitizeFolderGlossaryJsonText(text);
  if (!normalizedText) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(normalizedText) as unknown;
  } catch (error) {
    throw new Error(describeJsonSyntaxError(error, normalizedText));
  }

  const container = parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : null;
  const rows = Array.isArray(parsed)
    ? parsed
    : Array.isArray(container?.entries)
      ? container.entries
      : Array.isArray(container?.glossary)
        ? container.glossary
        : [];

  if (rows.length === 0) {
    throw new Error('O arquivo não contém uma lista "entries" ou "glossary" com entradas.');
  }

  return rows.map(normalizeFolderGlossaryInput).filter((entry): entry is FolderGlossaryInput => Boolean(entry));
}

export function serializeFolderGlossary(
  folder: { id: string; title: string },
  entries: FolderGlossaryEntry[],
): string {
  return JSON.stringify({
    schema: "app-piteco-folder-glossary",
    version: "1.0",
    folder: { id: folder.id, name: folder.title },
    entries: entries.map((entry) => ({
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
