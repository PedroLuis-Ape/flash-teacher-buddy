import type { FolderGlossaryEntry, FolderGlossaryInput } from "./folderGlossaryTypes";

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
  const parsed = JSON.parse(text) as unknown;
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
