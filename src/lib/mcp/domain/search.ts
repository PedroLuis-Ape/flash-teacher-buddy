import { ACCESSIBLE_LIST_SELECT, findAccessibleList } from "./access";
import type { UserScopedDb } from "./client";
import { McpDomainError, toMcpDomainError } from "./errors";
import {
  MAX_SEARCH_LIMIT,
  asRow,
  asRows,
  resolvePage,
  sanitizeSearchTerm,
  str,
  truncatedStr,
} from "./query";
import { assertScopeAccessible, requireUuid, scopeName, type LibraryScope } from "./scope";

export const SEARCH_TYPES = ["folders", "lists", "flashcards"] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];
export const DEFAULT_SEARCH_LIMIT = 10;

const FOLDER_SEARCH_SELECT = "id,title,description,updated_at";

/**
 * Cards are matched only inside user lists of the account's own folders: the
 * inner joins make system collections (Reforço / Pontos de atenção), classroom
 * content and foreign libraries structurally unreachable from this search.
 */
const CARD_SEARCH_SELECT =
  "id,term,translation,hint,updated_at," +
  "lists!inner(id,owner_id,system_kind,deleted_at," +
  "folders!inner(id,owner_id,system_kind,deleted_at,class_id,institution_id))";

export interface SearchMyContentInput {
  scope: LibraryScope;
  query: unknown;
  limit?: unknown;
  types?: unknown;
  listId?: unknown;
}

export interface SearchItem {
  type: "folder" | "list" | "flashcard";
  id: string;
  title: string;
  context?: string;
  folder_id?: string;
  folder_title?: string;
  list_id?: string;
  updated_at?: string;
}

export interface SearchGroupCounts {
  folders: number | null;
  lists: number | null;
  flashcards: number | null;
}

export interface SearchMyContentResult {
  scope: "personal" | "institution";
  query: string;
  limit: number;
  returned: number;
  list_id: string | null;
  counts: SearchGroupCounts;
  truncated: boolean;
  items: SearchItem[];
}

interface SearchGroup {
  items: SearchItem[];
  total: number | null;
}

function normalizeTypes(raw: unknown): SearchType[] {
  if (raw === undefined || raw === null) return [...SEARCH_TYPES];
  const values = Array.isArray(raw) ? raw : [raw];
  const selected = values.filter(
    (value): value is SearchType =>
      typeof value === "string" && (SEARCH_TYPES as readonly string[]).includes(value),
  );
  if (!selected.length) {
    throw new McpDomainError(
      "invalid_input",
      'O campo "types" aceita apenas "folders", "lists" e "flashcards".',
    );
  }
  return Array.from(new Set(selected));
}

function likePattern(term: string): string {
  return `%${term}%`;
}

async function searchFolders(
  db: UserScopedDb,
  scope: LibraryScope,
  pattern: string,
  limit: number,
): Promise<SearchGroup> {
  const base = db.client
    .from("folders")
    .select(FOLDER_SEARCH_SELECT, { count: "exact" })
    .eq("owner_id", db.userId)
    .eq("system_kind", "user")
    .is("deleted_at", null)
    .is("class_id", null);
  const scoped = scope.kind === "personal"
    ? base.is("institution_id", null)
    : base.eq("institution_id", scope.institutionId);

  const { data, error, count } = await scoped
    .or(`title.ilike.${pattern},description.ilike.${pattern}`)
    .order("updated_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(limit);
  if (error) throw toMcpDomainError(error, "Não foi possível buscar nas pastas.");

  const items = asRows(data).map((raw): SearchItem => {
    const row = asRow(raw) ?? {};
    return {
      type: "folder",
      id: str(row, "id") ?? "",
      title: str(row, "title") ?? "",
      context: truncatedStr(row, "description", 160),
      updated_at: str(row, "updated_at"),
    };
  });
  return { items, total: typeof count === "number" ? count : null };
}

async function searchLists(
  db: UserScopedDb,
  scope: LibraryScope,
  pattern: string,
  limit: number,
): Promise<SearchGroup> {
  const base = db.client
    .from("lists")
    .select(ACCESSIBLE_LIST_SELECT, { count: "exact" })
    .eq("folders.owner_id", db.userId)
    .eq("folders.system_kind", "user")
    .is("folders.deleted_at", null)
    .is("folders.class_id", null)
    .eq("system_kind", "user")
    .is("deleted_at", null);
  const scoped = scope.kind === "personal"
    ? base.is("folders.institution_id", null)
    : base.eq("folders.institution_id", scope.institutionId);

  const { data, error, count } = await scoped
    .or(`title.ilike.${pattern},description.ilike.${pattern}`)
    .order("updated_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(limit);
  if (error) throw toMcpDomainError(error, "Não foi possível buscar nas listas.");

  const items = asRows(data).map((raw): SearchItem => {
    const row = asRow(raw) ?? {};
    const folder = asRow(row.folders);
    return {
      type: "list",
      id: str(row, "id") ?? "",
      title: str(row, "title") ?? "",
      context: truncatedStr(row, "description", 160),
      folder_id: str(row, "folder_id"),
      folder_title: str(folder, "title"),
      updated_at: str(row, "updated_at"),
    };
  });
  return { items, total: typeof count === "number" ? count : null };
}

async function searchCards(
  db: UserScopedDb,
  scope: LibraryScope,
  pattern: string,
  limit: number,
  listId?: string,
): Promise<SearchGroup> {
  const base = db.client
    .from("flashcards")
    .select(CARD_SEARCH_SELECT, { count: "exact" })
    .eq("user_id", db.userId)
    .is("deleted_at", null);

  const activeList = listId
    ? base.eq("list_id", listId)
    : base
        .eq("lists.system_kind", "user")
        .is("lists.deleted_at", null)
        .eq("lists.folders.owner_id", db.userId)
        .eq("lists.folders.system_kind", "user")
        .is("lists.folders.deleted_at", null)
        .is("lists.folders.class_id", null);

  // A list-scoped search already proved access to that list, so the scope
  // filter is only applied to the library-wide variant.
  const scoped = listId
    ? activeList
    : scope.kind === "personal"
      ? activeList.is("lists.folders.institution_id", null)
      : activeList.eq("lists.folders.institution_id", scope.institutionId);

  const { data, error, count } = await scoped
    .or(`term.ilike.${pattern},translation.ilike.${pattern},example_text.ilike.${pattern}`)
    .order("updated_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(limit);
  if (error) throw toMcpDomainError(error, "Não foi possível buscar nos flashcards.");

  const items = asRows(data).map((raw): SearchItem => {
    const row = asRow(raw) ?? {};
    const list = asRow(row.lists);
    const folder = asRow(list?.folders);
    return {
      type: "flashcard",
      id: str(row, "id") ?? "",
      title: str(row, "term") ?? "",
      context: truncatedStr(row, "translation", 160),
      folder_id: str(folder, "id"),
      folder_title: str(folder, "title"),
      list_id: str(list, "id"),
      updated_at: str(row, "updated_at"),
    };
  });
  return { items, total: typeof count === "number" ? count : null };
}

/** Interleaves groups so a single greedy group cannot exhaust the budget. */
function mergeGroups(groups: SearchGroup[], limit: number): SearchItem[] {
  const merged: SearchItem[] = [];
  let index = 0;
  while (merged.length < limit) {
    let progressed = false;
    for (const group of groups) {
      if (merged.length >= limit) break;
      const item = group.items[index];
      if (!item) continue;
      merged.push(item);
      progressed = true;
    }
    if (!progressed) break;
    index += 1;
  }
  return merged;
}

/**
 * Searches only inside the authenticated account's own content.
 * `limit` is the hard budget of returned items (never the whole library).
 * When `listId` is given, the search is confined to that list's cards.
 */
export async function searchMyContent(
  db: UserScopedDb,
  input: SearchMyContentInput,
): Promise<SearchMyContentResult> {
  await assertScopeAccessible(db, input.scope);
  const query = sanitizeSearchTerm(input.query);
  const { limit } = resolvePage(input, { defaultLimit: DEFAULT_SEARCH_LIMIT, maxLimit: MAX_SEARCH_LIMIT });
  const pattern = likePattern(query);
  const requested = normalizeTypes(input.types);
  const scopedListId = input.listId === undefined || input.listId === null
    ? undefined
    : requireUuid(input.listId, "list_id");
  if (scopedListId) await findAccessibleList(db, scopedListId, input.scope);

  const [foldersGroup, listsGroup, cardsGroup] = await Promise.all([
    !scopedListId && requested.includes("folders")
      ? searchFolders(db, input.scope, pattern, limit)
      : Promise.resolve({ items: [], total: null } as SearchGroup),
    !scopedListId && requested.includes("lists")
      ? searchLists(db, input.scope, pattern, limit)
      : Promise.resolve({ items: [], total: null } as SearchGroup),
    requested.includes("flashcards")
      ? searchCards(db, input.scope, pattern, limit, scopedListId)
      : Promise.resolve({ items: [], total: null } as SearchGroup),
  ]);

  const groups = [foldersGroup, listsGroup, cardsGroup];
  const items = mergeGroups(groups, limit);
  const counts: SearchGroupCounts = {
    folders: foldersGroup.total,
    lists: listsGroup.total,
    flashcards: cardsGroup.total,
  };
  const knownTotal = (counts.folders ?? 0) + (counts.lists ?? 0) + (counts.flashcards ?? 0);

  return {
    scope: scopeName(input.scope),
    query,
    limit,
    returned: items.length,
    list_id: scopedListId ?? null,
    counts,
    truncated: knownTotal > items.length,
    items,
  };
}
