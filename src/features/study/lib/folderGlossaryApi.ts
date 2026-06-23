import { supabase } from "@/integrations/supabase/client";
import { importAccountGlossary, loadOwnAccountGlossary } from "./accountGlossaryApi";
import type { AccountGlossaryEntry } from "./accountGlossaryTypes";
import type { GlossaryTransferEntry } from "./glossaryTransfer";
import { glossaryEntryIdentity, normalizeGlossaryValue } from "./glossaryTransfer";

interface FolderCardRow {
  id: string;
  term: string;
  translation: string;
  hint?: string | null;
  word_hints?: unknown;
  example_text?: string | null;
  example_translation?: string | null;
  short_explanation?: string | null;
  context_tag?: string | null;
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
  dryRun: boolean;
}

export interface FolderGlossarySyncStatus {
  lastSyncedAt: string | null;
  includeNormalCards: boolean;
  entriesFound: number;
  inserted: number;
  cardsScanned: number;
}

const storageKey = (folderId: string) => `app-piteco:folder-glossary-sync:${folderId}`;

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function hintEntry(value: unknown): GlossaryTransferEntry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const original = readString(row.original_text || row.original || row.term || row.word);
  const translated = readString(row.translated_text || row.translation || row.meaning || row.definition);
  if (!original || !translated) return null;
  const side = readString(row.side).toUpperCase() === "B" ? "B" : "A";
  const note = readString(row.note || row.explanation) || null;
  return { original_text: original, translated_text: translated, note, side, is_active: true };
}

function structuredEntries(value: unknown): GlossaryTransferEntry[] {
  if (!Array.isArray(value)) return [];
  return value.map(hintEntry).filter((entry): entry is GlossaryTransferEntry => Boolean(entry));
}

function deduplicate(entries: GlossaryTransferEntry[]) {
  const map = new Map<string, GlossaryTransferEntry>();
  for (const entry of entries) map.set(glossaryEntryIdentity(entry), entry);
  return Array.from(map.values());
}

async function loadFolderCards(folderId: string) {
  const { data: lists, error: listError } = await supabase
    .from("lists")
    .select("id")
    .eq("folder_id", folderId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (listError) throw listError;

  const listIds = (lists ?? []).map((row) => row.id);
  const cards: FolderCardRow[] = [];
  const chunkSize = 80;
  const pageSize = 1000;

  for (let offset = 0; offset < listIds.length; offset += chunkSize) {
    const ids = listIds.slice(offset, offset + chunkSize);
    let from = 0;
    while (ids.length > 0) {
      const { data, error } = await supabase
        .from("flashcards")
        .select("id, term, translation, hint, word_hints, example_text, example_translation, short_explanation, context_tag")
        .in("list_id", ids)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      cards.push(...((data ?? []) as FolderCardRow[]));
      if ((data?.length ?? 0) < pageSize) break;
      from += pageSize;
    }
  }

  return { listIds, cards };
}

function entriesFromCards(cards: FolderCardRow[], includeNormalCards: boolean) {
  const entries: GlossaryTransferEntry[] = [];
  for (const card of cards) {
    entries.push(...structuredEntries(card.word_hints));
    if (includeNormalCards && readString(card.term) && readString(card.translation)) {
      entries.push({
        original_text: card.term.trim(),
        translated_text: card.translation.trim(),
        note: readString(card.hint) || null,
        side: "A",
        is_active: true,
      });
    }
  }
  return deduplicate(entries);
}

function compareEntries(entries: GlossaryTransferEntry[], glossary: AccountGlossaryEntry[]) {
  const exact = new Set(glossary.map(glossaryEntryIdentity));
  const termKeys = new Set(glossary.map((entry) => `${entry.side}|${normalizeGlossaryValue(entry.original_text)}`));
  let exactExisting = 0;
  let alternativeLayers = 0;
  for (const entry of entries) {
    if (exact.has(glossaryEntryIdentity(entry))) exactExisting += 1;
    else if (termKeys.has(`${entry.side}|${normalizeGlossaryValue(entry.original_text)}`)) alternativeLayers += 1;
  }
  return { exactExisting, alternativeLayers };
}

export async function previewFolderGlossarySync(folderId: string, includeNormalCards = false): Promise<FolderGlossarySyncReport> {
  const [{ listIds, cards }, glossary] = await Promise.all([
    loadFolderCards(folderId),
    loadOwnAccountGlossary(),
  ]);
  const entries = entriesFromCards(cards, includeNormalCards);
  const comparison = compareEntries(entries, glossary);
  return {
    folderId,
    listsScanned: listIds.length,
    cardsScanned: cards.length,
    entriesFound: entries.length,
    inserted: Math.max(0, entries.length - comparison.exactExisting),
    skipped: comparison.exactExisting,
    exactExisting: comparison.exactExisting,
    alternativeLayers: comparison.alternativeLayers,
    includeNormalCards,
    syncedAt: new Date().toISOString(),
    dryRun: true,
  };
}

export async function syncFolderGlossary(folderId: string, includeNormalCards = false): Promise<FolderGlossarySyncReport> {
  const [{ listIds, cards }, glossary] = await Promise.all([
    loadFolderCards(folderId),
    loadOwnAccountGlossary(),
  ]);
  const entries = entriesFromCards(cards, includeNormalCards);
  const comparison = compareEntries(entries, glossary);
  const result = entries.length > 0
    ? await importAccountGlossary(entries, false)
    : { inserted: 0, skipped: 0 };
  const report: FolderGlossarySyncReport = {
    folderId,
    listsScanned: listIds.length,
    cardsScanned: cards.length,
    entriesFound: entries.length,
    inserted: Number(result.inserted ?? 0),
    skipped: Number(result.skipped ?? comparison.exactExisting),
    exactExisting: comparison.exactExisting,
    alternativeLayers: comparison.alternativeLayers,
    includeNormalCards,
    syncedAt: new Date().toISOString(),
    dryRun: false,
  };
  try { localStorage.setItem(storageKey(folderId), JSON.stringify(report)); } catch { /* best effort */ }
  return report;
}

function searchableCardSide(card: FolderCardRow, side: "A" | "B") {
  return side === "A"
    ? [card.term, card.hint, card.example_text, card.short_explanation, card.context_tag].filter(Boolean).join(" ")
    : [card.translation, card.example_translation].filter(Boolean).join(" ");
}

function containsWholeTerm(text: string, term: string) {
  const clean = (value: string) => ` ${normalizeGlossaryValue(value).replace(/[^\p{L}\p{N}_]+/gu, " ")} `;
  return clean(text).includes(clean(term));
}

export async function loadFolderScopedGlossary(folderId: string): Promise<AccountGlossaryEntry[]> {
  const [{ cards }, glossary] = await Promise.all([
    loadFolderCards(folderId),
    loadOwnAccountGlossary(),
  ]);
  return glossary.filter((entry) => cards.some((card) =>
    containsWholeTerm(searchableCardSide(card, entry.side), entry.original_text),
  ));
}

export function readFolderGlossarySyncStatus(folderId: string): FolderGlossarySyncStatus {
  try {
    const raw = localStorage.getItem(storageKey(folderId));
    if (!raw) return { lastSyncedAt: null, includeNormalCards: false, entriesFound: 0, inserted: 0, cardsScanned: 0 };
    const parsed = JSON.parse(raw) as FolderGlossarySyncReport;
    return {
      lastSyncedAt: parsed.syncedAt || null,
      includeNormalCards: Boolean(parsed.includeNormalCards),
      entriesFound: Number(parsed.entriesFound ?? 0),
      inserted: Number(parsed.inserted ?? 0),
      cardsScanned: Number(parsed.cardsScanned ?? 0),
    };
  } catch {
    return { lastSyncedAt: null, includeNormalCards: false, entriesFound: 0, inserted: 0, cardsScanned: 0 };
  }
}
