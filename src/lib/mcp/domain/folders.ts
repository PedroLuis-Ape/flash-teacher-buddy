import type { UserScopedDb } from "./client";
import { toMcpDomainError } from "./errors";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  asRow,
  asRows,
  bool,
  num,
  resolvePage,
  sanitizeSearchTerm,
  str,
  truncatedStr,
} from "./query";
import { assertScopeAccessible, scopeName, type LibraryScope } from "./scope";

/**
 * Folder projection used by the library surfaces: the embedded lists let us
 * count user lists without a second roundtrip (the same shape the web library
 * uses, so the counts agree with the product).
 */
export const FOLDER_SELECT =
  "id,title,description,visibility,lang_a,lang_b,tts_enabled,updated_at,lists(id,deleted_at,system_kind)";

export interface ListFoldersInput {
  scope: LibraryScope;
  search?: unknown;
  limit?: unknown;
  offset?: unknown;
}

export interface CompactFolder {
  id: string;
  title: string;
  description?: string;
  visibility?: string;
  lang_a?: string;
  lang_b?: string;
  tts_enabled?: boolean;
  list_count: number;
  updated_at?: string;
}

export interface ListFoldersResult {
  scope: "personal" | "institution";
  limit: number;
  offset: number;
  returned: number;
  total_count: number | null;
  has_more: boolean;
  items: CompactFolder[];
}

/** Counts only real user lists: system collections and the trash stay out. */
export function countUserLists(embedded: unknown): number {
  return asRows(embedded).filter((item) => {
    const record = asRow(item);
    if (!record) return false;
    return record.deleted_at == null && (record.system_kind == null || record.system_kind === "user");
  }).length;
}

export function compactFolder(row: Record<string, unknown>): CompactFolder {
  return {
    id: str(row, "id") ?? "",
    title: str(row, "title") ?? "",
    description: truncatedStr(row, "description", 160),
    visibility: str(row, "visibility"),
    lang_a: str(row, "lang_a"),
    lang_b: str(row, "lang_b"),
    tts_enabled: bool(row, "tts_enabled"),
    list_count: countUserLists(row.lists),
    updated_at: str(row, "updated_at"),
  };
}

/**
 * Personal-scope folders of the authenticated account.
 *
 * Ownership is narrowed here on purpose (owner_id = auth.uid()) *and* enforced
 * again by RLS: a public/class folder of another account can never be listed as
 * if it were part of this library.
 */
export async function listFolders(db: UserScopedDb, input: ListFoldersInput): Promise<ListFoldersResult> {
  await assertScopeAccessible(db, input.scope);
  const { limit, offset } = resolvePage(input, { defaultLimit: DEFAULT_PAGE_SIZE, maxLimit: MAX_PAGE_SIZE });
  const search = input.search === undefined || input.search === null ? undefined : sanitizeSearchTerm(input.search);

  const base = db.client
    .from("folders")
    .select(FOLDER_SELECT, { count: "exact" })
    .eq("owner_id", db.userId)
    .eq("system_kind", "user")
    .is("deleted_at", null)
    .is("class_id", null);

  const scoped = input.scope.kind === "personal"
    ? base.is("institution_id", null)
    : base.eq("institution_id", input.scope.institutionId);

  const filtered = search
    ? scoped.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
    : scoped;

  const { data, error, count } = await filtered
    .order("updated_at", { ascending: false })
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) throw toMcpDomainError(error, "Não foi possível listar as pastas.");

  const items = asRows(data).map((row) => compactFolder(asRow(row) ?? {}));
  const total = typeof count === "number" ? count : null;
  return {
    scope: scopeName(input.scope),
    limit,
    offset,
    returned: items.length,
    total_count: total,
    has_more: total === null ? items.length === limit : offset + items.length < total,
    items,
  };
}
