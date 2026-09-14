import type { UserScopedDb } from "./client";
import { McpDomainError, toMcpDomainError } from "./errors";
import { asRow, num, str, truncatedStr } from "./query";
import { referenceSelector, type ReferenceKind } from "./referenceIds";
import { type LibraryScope } from "./scope";

/**
 * Canonical projection of a list plus its folder.
 *
 * The folder is embedded with "!inner" and filtered by owner, so folder
 * ownership — not a repeatable/legacy column on lists — is the authority for
 * scope, exactly like the product's own library queries.
 */
export const ACCESSIBLE_LIST_SELECT =
  "id,reference_id,title,description,folder_id,order_index,primary_side,lang,lang_a,lang_b,study_type,labels_a,labels_b,tts_enabled,visibility,updated_at,deleted_at," +
  "folders!inner(id,reference_id,title,owner_id,deleted_at,class_id,system_kind,institution_id)";

export interface CompactList {
  id: string;
  title: string;
  description?: string;
  folder_id?: string;
  folder_title?: string;
  reference_id: string;
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
    reference_id: str(row, "reference_id") ?? "",
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
  const referenceId = str(folder, "reference_id");
  return {
    id,
    ...(referenceId ? { reference_id: referenceId } : {}),
    ...(str(folder, "title") ? { title: str(folder, "title") as string } : {}),
  };
}

function applyIdentifierFilter(query: any, selector: ReturnType<typeof referenceSelector>, referenceColumn = "reference_id") {
  return selector.kind === "uuid"
    ? query.eq("id", selector.id)
    : query.eq(referenceColumn, selector.referenceId);
}

function assertReferenceKind(selector: ReturnType<typeof referenceSelector>, expectedKind: ReferenceKind, field: string): void {
  if (selector.kind !== "uuid" && selector.kind !== expectedKind) {
    throw new McpDomainError("invalid_input", `O campo "${field}" precisa ser um identificador de ${expectedKind}.`);
  }
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
  const selector = referenceSelector(listId);
  assertReferenceKind(selector, "list", "list_id");

  let base = db.client
    .from("lists")
    .select(ACCESSIBLE_LIST_SELECT)
    .eq("folders.owner_id", db.userId)
    .eq("folders.system_kind", "user")
    .is("folders.deleted_at", null)
    .is("folders.class_id", null)
    .eq("system_kind", "user")
    .is("deleted_at", null);
  base = applyIdentifierFilter(base, selector);

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

export const OWNED_FOLDER_SELECT =
  "id,reference_id,title,description,visibility,institution_id,system_kind,deleted_at,class_id,lang_a,lang_b,tts_enabled";

export interface FindOwnedOptions {
  /** Used by the trash flow: a soft-deleted row is still an owned row. */
  includeDeleted?: boolean;
}

export function compactFolderSummary(row: Record<string, unknown>): Record<string, unknown> {
  const institutionId = str(row, "institution_id") ?? null;
  return {
    id: str(row, "id") ?? "",
    reference_id: str(row, "reference_id") ?? "",
    title: str(row, "title") ?? "",
    description: truncatedStr(row, "description", 160),
    visibility: str(row, "visibility"),
    institution_id: institutionId,
    scope: institutionId ? "institution" : "personal",
  };
}

export function folderInstitutionId(row: Record<string, unknown>): string | null {
  return str(row, "institution_id") ?? null;
}

/**
 * Resolves a folder the authenticated account owns, in ANY of its scopes
 * (personal + institutions it owns). Scope is derived from the object itself,
 * so write tools never need the model to declare where an existing object is.
 */
export async function findOwnedFolder(
  db: UserScopedDb,
  folderId: unknown,
  options: FindOwnedOptions = {},
): Promise<Record<string, unknown>> {
  const selector = referenceSelector(folderId);
  assertReferenceKind(selector, "folder", "folder_id");

  let query = db.client
    .from("folders")
    .select(OWNED_FOLDER_SELECT)
    .eq("owner_id", db.userId)
    .eq("system_kind", "user")
    .is("class_id", null);
  query = applyIdentifierFilter(query, selector);
  if (!options.includeDeleted) query = query.is("deleted_at", null);

  const { data, error } = await query.maybeSingle();
  if (error) throw toMcpDomainError(error, "Não foi possível ler a pasta.");

  const record = asRow(data);
  if (!record) {
    throw new McpDomainError("not_found", "Pasta não encontrada na biblioteca desta conta.", {
      hint: "Use list_folders para descobrir o id correto antes de repetir.",
    });
  }
  return record;
}

/**
 * Same authority rule as findOwnedFolder, for lists: folder ownership is the
 * scope authority, so a list is never resolved by a repeatable column alone.
 */
export async function findOwnedList(
  db: UserScopedDb,
  listId: unknown,
  options: FindOwnedOptions = {},
): Promise<Record<string, unknown>> {
  const selector = referenceSelector(listId);
  assertReferenceKind(selector, "list", "list_id");

  let query = db.client
    .from("lists")
    .select(ACCESSIBLE_LIST_SELECT)
    .eq("folders.owner_id", db.userId)
    .eq("folders.system_kind", "user")
    .eq("system_kind", "user");
  query = applyIdentifierFilter(query, selector);
  if (!options.includeDeleted) {
    query = query
      .is("deleted_at", null)
      .is("folders.deleted_at", null)
      .is("folders.class_id", null);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw toMcpDomainError(error, "Não foi possível ler a lista.");

  const record = asRow(data);
  if (!record) {
    throw new McpDomainError("not_found", "Lista não encontrada na biblioteca desta conta.", {
      hint: "Use list_lists ou search_my_content para descobrir o id correto antes de repetir.",
    });
  }
  return record;
}

/** Resolves a folder after applying account ownership and the requested scope. */
export async function findAccessibleFolder(
  db: UserScopedDb,
  folderId: unknown,
  scope: LibraryScope,
): Promise<Record<string, unknown>> {
  const selector = referenceSelector(folderId);
  assertReferenceKind(selector, "folder", "folder_id");
  let query = db.client
    .from("folders")
    .select(OWNED_FOLDER_SELECT)
    .eq("owner_id", db.userId)
    .eq("system_kind", "user")
    .is("deleted_at", null)
    .is("class_id", null);
  query = applyIdentifierFilter(query, selector);
  query = scope.kind === "personal"
    ? query.is("institution_id", null)
    : query.eq("institution_id", scope.institutionId);

  const { data, error } = await query.maybeSingle();
  if (error) throw toMcpDomainError(error, "Não foi possível ler a pasta.");
  const record = asRow(data);
  if (!record) {
    throw new McpDomainError("not_found", "Pasta não encontrada na biblioteca desta conta.", {
      hint: "Use list_folders para descobrir o identificador correto.",
    });
  }
  return record;
}
