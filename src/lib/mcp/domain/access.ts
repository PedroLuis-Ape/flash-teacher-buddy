import type { UserScopedDb } from "./client";
import { McpDomainError, toMcpDomainError } from "./errors";
import { asRow, num, str, truncatedStr } from "./query";
import { requireUuid, type LibraryScope } from "./scope";

/**
 * Canonical projection of a list plus its folder.
 *
 * The folder is embedded with "!inner" and filtered by owner, so folder
 * ownership — not a repeatable/legacy column on lists — is the authority for
 * scope, exactly like the product's own library queries.
 */
export const ACCESSIBLE_LIST_SELECT =
  "id,title,description,folder_id,order_index,primary_side,lang,lang_a,lang_b,study_type,labels_a,labels_b,tts_enabled,visibility,updated_at," +
  "folders!inner(id,title,owner_id,deleted_at,class_id,system_kind,institution_id)";

export interface CompactList {
  id: string;
  title: string;
  description?: string;
  folder_id?: string;
  folder_title?: string;
  lang?: string;
  lang_a?: string;
  lang_b?: string;
  primary_side?: string;
  order_index?: number;
  updated_at?: string;
}

export function compactList(row: Record<string, unknown>): CompactList {
  const folder = asRow(row.folders);
  return {
    id: str(row, "id") ?? "",
    title: str(row, "title") ?? "",
    description: truncatedStr(row, "description", 160),
    folder_id: str(row, "folder_id"),
    folder_title: str(folder, "title"),
    lang: str(row, "lang"),
    lang_a: str(row, "lang_a"),
    lang_b: str(row, "lang_b"),
    primary_side: str(row, "primary_side"),
    order_index: num(row, "order_index"),
    updated_at: str(row, "updated_at"),
  };
}

export function compactFolderRef(row: Record<string, unknown>): Record<string, string> | null {
  const folder = asRow(row.folders);
  const id = str(folder, "id");
  if (!id) return null;
  return { id, ...(str(folder, "title") ? { title: str(folder, "title") as string } : {}) };
}

/**
 * Resolves a list the authenticated account may read inside the given scope.
 * Unknown, deleted, system, classroom or foreign lists all resolve to a
 * controlled not_found: no existence leak across accounts.
 */
export async function findAccessibleList(
  db: UserScopedDb,
  listId: unknown,
  scope: LibraryScope,
): Promise<Record<string, unknown>> {
  const id = requireUuid(listId, "list_id");

  const base = db.client
    .from("lists")
    .select(ACCESSIBLE_LIST_SELECT)
    .eq("id", id)
    .eq("folders.owner_id", db.userId)
    .eq("folders.system_kind", "user")
    .is("folders.deleted_at", null)
    .is("folders.class_id", null)
    .eq("system_kind", "user")
    .is("deleted_at", null);

  const scoped = scope.kind === "personal"
    ? base.is("folders.institution_id", null)
    : base.eq("folders.institution_id", scope.institutionId);

  const { data, error } = await scoped.maybeSingle();
  if (error) throw toMcpDomainError(error, "Não foi possível ler a lista.");

  const record = asRow(data);
  if (!record) {
    throw new McpDomainError("not_found", "Lista não encontrada na biblioteca desta conta.", {
      hint: "Use list_lists ou search_my_content para descobrir o id correto antes de repetir.",
    });
  }
  return record;
}
