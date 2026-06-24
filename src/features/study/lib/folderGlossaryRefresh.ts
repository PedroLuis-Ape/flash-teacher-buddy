import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY_PREFIX = "app-piteco-folder-glossary-refresh-v1:";
const EVENT_NAME = "app-piteco:folder-glossary-refresh";

export type FolderGlossaryRefreshSource = "manual" | "import" | "edit";

export interface FolderGlossaryRefreshReport {
  folderId: string;
  syncedAt: string;
  source: FolderGlossaryRefreshSource;
  lists?: number;
  entries?: number;
  activeEntries?: number;
}

function storageKey(folderId: string) {
  return `${STORAGE_KEY_PREFIX}${folderId}`;
}

function isRefreshReport(value: unknown): value is FolderGlossaryRefreshReport {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<FolderGlossaryRefreshReport>;
  return typeof row.folderId === "string"
    && typeof row.syncedAt === "string"
    && (row.source === "manual" || row.source === "import" || row.source === "edit");
}

export function readFolderGlossaryRefreshReport(folderId: string): FolderGlossaryRefreshReport | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(folderId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isRefreshReport(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function publishFolderGlossaryRefresh(report: FolderGlossaryRefreshReport): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(storageKey(report.folderId), JSON.stringify(report));
  } catch {
    // Persistência auxiliar; a atualização atual não pode falhar por isso.
  }

  window.dispatchEvent(new CustomEvent<FolderGlossaryRefreshReport>(EVENT_NAME, {
    detail: report,
  }));
}

export function subscribeFolderGlossaryRefresh(
  callback: (report: FolderGlossaryRefreshReport) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;

  const onCustomEvent = (event: Event) => {
    const report = (event as CustomEvent<unknown>).detail;
    if (isRefreshReport(report)) callback(report);
  };

  const onStorage = (event: StorageEvent) => {
    if (!event.key?.startsWith(STORAGE_KEY_PREFIX) || !event.newValue) return;
    try {
      const parsed = JSON.parse(event.newValue) as unknown;
      if (isRefreshReport(parsed)) callback(parsed);
    } catch {
      // Ignora registros externos malformados.
    }
  };

  window.addEventListener(EVENT_NAME, onCustomEvent);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT_NAME, onCustomEvent);
    window.removeEventListener("storage", onStorage);
  };
}

async function countFolderRows(
  table: "lists" | "folder_glossary",
  folderId: string,
  activeOnly = false,
): Promise<number> {
  let query = supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("folder_id", folderId);

  if (table === "lists") query = query.is("deleted_at", null);
  if (table === "folder_glossary" && activeOnly) query = query.eq("is_active", true);

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function inspectAndPublishFolderGlossaryRefresh(
  folderId: string,
): Promise<FolderGlossaryRefreshReport> {
  const [lists, entries, activeEntries] = await Promise.all([
    countFolderRows("lists", folderId),
    countFolderRows("folder_glossary", folderId),
    countFolderRows("folder_glossary", folderId, true),
  ]);

  const report: FolderGlossaryRefreshReport = {
    folderId,
    syncedAt: new Date().toISOString(),
    source: "manual",
    lists,
    entries,
    activeEntries,
  };
  publishFolderGlossaryRefresh(report);
  return report;
}
