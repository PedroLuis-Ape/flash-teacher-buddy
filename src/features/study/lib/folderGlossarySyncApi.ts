import { supabase } from "@/integrations/supabase/client";
import { fetchAllSupabaseRows } from "@/lib/fetchAllSupabaseRows";
import type {
  FolderGlossaryImportResult,
  FolderGlossaryInput,
  GlossarySide,
} from "./folderGlossaryTypes";

interface FolderCardRow {
  term: string;
  translation: string;
  hint?: string | null;
  word_hints?: unknown;
}

export interface FolderGlossarySyncReport {
  folderId: string;
  listsScanned: number;
  cardsScanned: number;
  entriesFound: number;
  inserted: number;
  skipped: number;
  exactExisting: number;
  alternativeLayers: number;
  includeNormalCards: boolean;
  syncedAt: string;
  dryRun: false;
}

const readString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const normalize = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLocaleLowerCase();

function hintEntry(value: unknown): FolderGlossaryInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const term = readString(
    row.original_text ?? row.original ?? row.text ?? row.term ?? row.word,
  );
  const translation = readString(
    row.translated_text ?? row.translation ?? row.meaning ?? row.definition,
  );
  if (!term || !translation) return null;

  return {
    term,
    translation,
    note: readString(row.note ?? row.explanation) || null,
    side: readString(row.side).toUpperCase() === "B" ? "B" : "A",
    active: true,
  };
}

function addEntry(
  map: Map<string, FolderGlossaryInput>,
  input: FolderGlossaryInput,
) {
  const side: GlossarySide = input.side ?? "A";
  const key = `${side}|${normalize(input.term)}`;
  const current = map.get(key);

  if (!current) {
    map.set(key, {
      ...input,
      side,
      alternatives: Array.from(new Set(input.alternatives ?? [])),
    });
    return;
  }

  const alternatives = new Map<string, string>();
  for (const value of [
    ...(current.alternatives ?? []),
    ...(input.alternatives ?? []),
    input.translation,
  ]) {
    const clean = value.trim();
    const identity = normalize(clean);
    if (clean && identity !== normalize(current.translation)) {
      alternatives.set(identity, clean);
    }
  }

  current.alternatives = Array.from(alternatives.values());
  if (!current.note && input.note) current.note = input.note;
}

async function loadFolderCards(folderId: string) {
  const lists = await fetchAllSupabaseRows<{ id: string }>((from, to) =>
    (supabase as any)
      .from("lists")
      .select("id")
      .eq("folder_id", folderId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );

  const listIds = lists.map((row) => row.id);
  if (listIds.length === 0) return { listIds, cards: [] as FolderCardRow[] };

  const cards: FolderCardRow[] = [];
  for (let offset = 0; offset < listIds.length; offset += 80) {
    const ids = listIds.slice(offset, offset + 80);
    let from = 0;

    while (true) {
      const { data, error } = await supabase
        .from("flashcards")
        .select("term, translation, hint, word_hints")
        .in("list_id", ids)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .range(from, from + 999);
      if (error) throw error;

      cards.push(...((data ?? []) as FolderCardRow[]));
      if ((data?.length ?? 0) < 1000) break;
      from += 1000;
    }
  }

  return { listIds, cards };
}

function entriesFromCards(
  cards: FolderCardRow[],
  includeNormalCards: boolean,
) {
  const map = new Map<string, FolderGlossaryInput>();

  for (const card of cards) {
    if (Array.isArray(card.word_hints)) {
      for (const raw of card.word_hints) {
        const entry = hintEntry(raw);
        if (entry) addEntry(map, entry);
      }
    }

    if (includeNormalCards) {
      const term = readString(card.term);
      const translation = readString(card.translation);
      if (term && translation) {
        addEntry(map, {
          term,
          translation,
          note: readString(card.hint) || null,
          side: "A",
          active: true,
        });
      }
    }
  }

  return Array.from(map.values());
}

async function importEntries(
  folderId: string,
  entries: FolderGlossaryInput[],
): Promise<FolderGlossaryImportResult> {
  const { data, error } = await (supabase as any).rpc(
    "import_folder_glossary_v1",
    {
      _folder_id: folderId,
      _entries: entries,
      _mode: "merge",
      _dry_run: false,
    },
  );
  if (error) throw error;
  return data as FolderGlossaryImportResult;
}

export async function syncFolderGlossary(
  folderId: string,
  includeNormalCards = false,
): Promise<FolderGlossarySyncReport> {
  const { listIds, cards } = await loadFolderCards(folderId);
  const entries = entriesFromCards(cards, includeNormalCards);
  const result = entries.length > 0
    ? await importEntries(folderId, entries)
    : { inserted: 0, updated: 0, skipped: 0 };

  const report: FolderGlossarySyncReport = {
    folderId,
    listsScanned: listIds.length,
    cardsScanned: cards.length,
    entriesFound: entries.length,
    inserted: result.inserted,
    skipped: result.skipped,
    exactExisting: result.skipped,
    alternativeLayers: result.updated,
    includeNormalCards,
    syncedAt: new Date().toISOString(),
    dryRun: false,
  };
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(folderGlossarySyncStorageKey(folderId), JSON.stringify(report));
    }
  } catch { /* best effort */ }
  return report;
}

export const folderGlossarySyncStorageKey = (folderId: string) =>
  `app-piteco:folder-glossary-sync:${folderId}`;

export interface FolderGlossarySyncStatus {
  lastSyncedAt: string | null;
  includeNormalCards: boolean;
  entriesFound: number;
  inserted: number;
  cardsScanned: number;
}

export function readFolderGlossarySyncStatus(folderId: string): FolderGlossarySyncStatus {
  const empty: FolderGlossarySyncStatus = {
    lastSyncedAt: null,
    includeNormalCards: false,
    entriesFound: 0,
    inserted: 0,
    cardsScanned: 0,
  };
  try {
    if (typeof localStorage === "undefined") return empty;
    const raw = localStorage.getItem(folderGlossarySyncStorageKey(folderId));
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<FolderGlossarySyncReport>;
    return {
      lastSyncedAt: (typeof parsed.syncedAt === "string" && parsed.syncedAt) || null,
      includeNormalCards: Boolean(parsed.includeNormalCards),
      entriesFound: Number(parsed.entriesFound ?? 0),
      inserted: Number(parsed.inserted ?? 0),
      cardsScanned: Number(parsed.cardsScanned ?? 0),
    };
  } catch {
    return empty;
  }
}
