import type { UserScopedDb } from "./client";
import { findAccessibleList } from "./access";
import { toMcpDomainError } from "./errors";
import {
  DEFAULT_CARD_LIMIT,
  MAX_CARD_LIMIT,
  asRow,
  asRows,
  num,
  resolvePage,
  str,
  truncatedStr,
} from "./query";
import type { LibraryScope } from "./scope";

/** Compact card projection: pedagogically useful fields, bounded in size. */
export const CARD_SELECT =
  "id,term,translation,hint,example_text,example_translation,context_tag,layer_index,parent_card_id,created_at";

export const MAX_CARD_TEXT_LENGTH = 300;

export interface CompactCard {
  id: string;
  term: string;
  translation: string;
  hint?: string;
  example_text?: string;
  example_translation?: string;
  context_tag?: string;
  layer_index?: number;
  parent_card_id?: string;
  created_at?: string;
}

export function compactCard(row: Record<string, unknown>): CompactCard {
  return {
    id: str(row, "id") ?? "",
    term: truncatedStr(row, "term", MAX_CARD_TEXT_LENGTH) ?? "",
    translation: truncatedStr(row, "translation", MAX_CARD_TEXT_LENGTH) ?? "",
    hint: truncatedStr(row, "hint", MAX_CARD_TEXT_LENGTH),
    example_text: truncatedStr(row, "example_text", MAX_CARD_TEXT_LENGTH),
    example_translation: truncatedStr(row, "example_translation", MAX_CARD_TEXT_LENGTH),
    context_tag: str(row, "context_tag"),
    layer_index: num(row, "layer_index"),
    parent_card_id: str(row, "parent_card_id"),
    created_at: str(row, "created_at"),
  };
}

export interface CardPage {
  limit: number;
  offset: number;
  returned: number;
  total_count: number | null;
  has_more: boolean;
  items: CompactCard[];
}

/**
 * One page of cards of an already-authorized list.
 * Ordering matches the product's study deck: created_at, then id.
 */
export async function readCardPage(
  db: UserScopedDb,
  listId: string,
  input: { limit?: unknown; offset?: unknown },
): Promise<CardPage> {
  const { limit, offset } = resolvePage(input, { defaultLimit: DEFAULT_CARD_LIMIT, maxLimit: MAX_CARD_LIMIT });
  const { data, error, count } = await db.client
    .from("flashcards")
    .select(CARD_SELECT, { count: "exact" })
    .eq("list_id", listId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) throw toMcpDomainError(error, "Não foi possível ler os flashcards da lista.");

  const items = asRows(data).map((row) => compactCard(asRow(row) ?? {}));
  const total = typeof count === "number" ? count : null;
  return {
    limit,
    offset,
    returned: items.length,
    total_count: total,
    has_more: total === null ? items.length === limit : offset + items.length < total,
    items,
  };
}

export async function countListCards(db: UserScopedDb, listId: string): Promise<number | null> {
  const { count, error } = await db.client
    .from("flashcards")
    .select("id", { count: "exact", head: true })
    .eq("list_id", listId)
    .is("deleted_at", null);
  if (error) throw toMcpDomainError(error, "Não foi possível contar os flashcards da lista.");
  return typeof count === "number" ? count : null;
}

export interface GetFlashcardsInput {
  listId: unknown;
  scope: LibraryScope;
  limit?: unknown;
  offset?: unknown;
}

export interface GetFlashcardsResult extends CardPage {
  list: { id: string; title: string; folder_id?: string };
}

export async function getFlashcards(db: UserScopedDb, input: GetFlashcardsInput): Promise<GetFlashcardsResult> {
  const record = await findAccessibleList(db, input.listId, input.scope);
  const listId = str(record, "id") ?? "";
  const page = await readCardPage(db, listId, { limit: input.limit, offset: input.offset });
  return {
    list: {
      id: listId,
      title: str(record, "title") ?? "",
      ...(str(record, "folder_id") ? { folder_id: str(record, "folder_id") as string } : {}),
    },
    ...page,
  };
}
