import type { UserScopedDb } from "./client";
import { ACCESSIBLE_LIST_SELECT, compactFolderRef, compactList, findAccessibleList } from "./access";
import { toMcpDomainError } from "./errors";
import { countListCards, readCardPage } from "./flashcards";
import {
  DEFAULT_CARD_LIMIT,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  asRow,
  asRows,
  resolvePage,
  sanitizeSearchTerm,
} from "./query";
import { assertScopeAccessible, requireUuid, scopeName, type LibraryScope } from "./scope";

export interface ListListsInput {
  scope: LibraryScope;
  folderId?: unknown;
  search?: unknown;
  limit?: unknown;
  offset?: unknown;
}

export interface ListListsResult {
  scope: "personal" | "institution";
  folder_id: string | null;
  limit: number;
  offset: number;
  returned: number;
  total_count: number | null;
  has_more: boolean;
  items: ReturnType<typeof compactList>[];
}

/**
 * Lists of the authenticated account's library, optionally narrowed to one
 * folder. System collections (Reforço / Pontos de atenção) and the trash are
 * excluded by default, matching the product's own library surfaces.
 */
export async function listLists(db: UserScopedDb, input: ListListsInput): Promise<ListListsResult> {
  await assertScopeAccessible(db, input.scope);
  const { limit, offset } = resolvePage(input, { defaultLimit: DEFAULT_PAGE_SIZE, maxLimit: MAX_PAGE_SIZE });
  const folderId = input.folderId === undefined || input.folderId === null
    ? undefined
    : requireUuid(input.folderId, "folder_id");
  const search = input.search === undefined || input.search === null ? undefined : sanitizeSearchTerm(input.search);

  const base = db.client
    .from("lists")
    .select(ACCESSIBLE_LIST_SELECT, { count: "exact" })
    .eq("folders.owner_id", db.userId)
    .eq("folders.system_kind", "user")
    .is("folders.deleted_at", null)
    .is("folders.class_id", null)
    .eq("system_kind", "user")
    .is("deleted_at", null);

  const scoped = input.scope.kind === "personal"
    ? base.is("folders.institution_id", null)
    : base.eq("folders.institution_id", input.scope.institutionId);

  const inFolder = folderId ? scoped.eq("folder_id", folderId) : scoped;
  const filtered = search
    ? inFolder.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
    : inFolder;

  const { data, error, count } = await filtered
    .order("updated_at", { ascending: false })
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) throw toMcpDomainError(error, "Não foi possível listar as listas.");

  const items = asRows(data).map((row) => compactList(asRow(row) ?? {}));
  const total = typeof count === "number" ? count : null;
  return {
    scope: scopeName(input.scope),
    folder_id: folderId ?? null,
    limit,
    offset,
    returned: items.length,
    total_count: total,
    has_more: total === null ? items.length === limit : offset + items.length < total,
    items,
  };
}

export interface GetListInput {
  listId: unknown;
  scope: LibraryScope;
  includeCards?: unknown;
  cardsLimit?: unknown;
  cardsOffset?: unknown;
}

/**
 * Metadata of one list plus its folder, with cards as an explicit option so a
 * plain lookup never streams the deck.
 */
export async function getList(db: UserScopedDb, input: GetListInput): Promise<Record<string, unknown>> {
  await assertScopeAccessible(db, input.scope);
  const record = await findAccessibleList(db, input.listId, input.scope);
  const listId = String(record.id);

  const payload: Record<string, unknown> = {
    scope: scopeName(input.scope),
    list: compactList(record),
    folder: compactFolderRef(record),
    card_count: await countListCards(db, listId),
  };

  if (input.includeCards === true) {
    const page = await readCardPage(db, listId, {
      limit: input.cardsLimit ?? DEFAULT_CARD_LIMIT,
      offset: input.cardsOffset ?? 0,
    });
    payload.cards = page.items;
    payload.cards_page = {
      limit: page.limit,
      offset: page.offset,
      returned: page.returned,
      has_more: page.has_more,
      total_count: page.total_count,
    };
  }

  return payload;
}
