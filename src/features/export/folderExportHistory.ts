import type { FolderExportSource, FolderExportSummary } from "./folderExport";

const STORAGE_KEY = "app-piteco-folder-export-history-v1";
const MAX_ENTRIES = 12;

export type FolderExportFormat = "txt" | "json" | "copy-txt" | "copy-json";

export interface FolderExportHistoryEntry {
  id: string;
  exportedAt: string;
  format: FolderExportFormat;
  fileName: string;
  folders: Array<{ id: string; title: string }>;
  summary: FolderExportSummary;
}

function isHistoryEntry(value: unknown): value is FolderExportHistoryEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<FolderExportHistoryEntry>;
  return typeof entry.id === "string"
    && typeof entry.exportedAt === "string"
    && typeof entry.format === "string"
    && typeof entry.fileName === "string"
    && Array.isArray(entry.folders)
    && Boolean(entry.summary && typeof entry.summary === "object");
}

export function readFolderExportHistory(): FolderExportHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isHistoryEntry).slice(0, MAX_ENTRIES) : [];
  } catch {
    return [];
  }
}

export function recordFolderExport(input: {
  format: FolderExportFormat;
  fileName: string;
  sources: FolderExportSource[];
  summary: FolderExportSummary;
}): FolderExportHistoryEntry[] {
  if (typeof window === "undefined") return [];

  const entry: FolderExportHistoryEntry = {
    id: crypto.randomUUID(),
    exportedAt: new Date().toISOString(),
    format: input.format,
    fileName: input.fileName,
    folders: input.sources.map((source) => ({
      id: source.id,
      title: source.title?.trim() || "Pasta sem nome",
    })),
    summary: { ...input.summary },
  };

  const next = [entry, ...readFolderExportHistory()].slice(0, MAX_ENTRIES);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Histórico é auxiliar; nunca deve impedir a exportação.
  }
  return next;
}

export function clearFolderExportHistory(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Best effort only.
  }
}
