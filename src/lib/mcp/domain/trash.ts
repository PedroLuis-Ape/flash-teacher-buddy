import { compactFolderSummary, compactList, findOwnedFolder, findOwnedList, folderInstitutionId } from "./access";
import { TRASH_RETENTION_DAYS } from "./cardWrites";
import type { ConfirmationKey, UserScopedDb } from "./client";
import { confirmationStateFingerprint, createConfirmationToken, verifyConfirmationToken, type ConfirmationStateRow } from "./confirmation";
import { McpDomainError, toMcpDomainError } from "./errors";
import { countListCards } from "./flashcards";
import { invalidateScopeInventory, listInstitutionId } from "./inventoryInvalidation";
import { asRow, asRows, str } from "./query";
import { requireEnum } from "./validation";

export const TRASH_TARGETS = ["list", "folder"] as const;
export type TrashTarget = (typeof TRASH_TARGETS)[number];

/**
 * Wraps the product's own SECURITY DEFINER trash RPCs. They always receive
 * p_user_id = auth.uid(); a NOT_FOUND answer means "not owned or not in the
 * expected state", never a silent success.
 */
async function callTrashRpc(
  db: UserScopedDb,
  fn: "soft_delete_list" | "soft_delete_folder" | "restore_list" | "restore_folder",
  params: Record<string, unknown>,
  failureMessage: string,
): Promise<void> {
  const { data, error } = await db.client.rpc(fn, params);
  if (error) throw toMcpDomainError(error, failureMessage);
  const record = asRow(data);
  if (record && record.success === false) {
    throw new McpDomainError("not_found", "O objeto não pertence a esta conta ou não está no estado esperado.", {
      hint: "Rode o preview correspondente antes de repetir a operação.",
    });
  }
}

async function activeListIds(db: UserScopedDb, folderId: string): Promise<string[]> {
  const { data, error } = await db.client
    .from("lists")
    .select("id")
    .eq("folder_id", folderId)
    .eq("system_kind", "user")
    .is("deleted_at", null);
  if (error) throw toMcpDomainError(error, "Não foi possível listar as listas da pasta.");
  return asRows(data).map((row) => str(asRow(row), "id") ?? "").filter(Boolean);
}

async function countCardsInLists(db: UserScopedDb, listIds: string[]): Promise<number> {
  if (listIds.length === 0) return 0;
  const { count, error } = await db.client
    .from("flashcards")
    .select("id", { count: "exact", head: true })
    .in("list_id", listIds)
    .is("deleted_at", null);
  if (error) throw toMcpDomainError(error, "Não foi possível contar os cards da pasta.");
  return typeof count === "number" ? count : 0;
}

async function listDeletionState(db: UserScopedDb, listId: string): Promise<string> {
  const [{ data: listData, error: listError }, { data: cardData, error: cardError }] = await Promise.all([
    db.client.from("lists").select("id,updated_at,deleted_at").eq("id", listId).eq("system_kind", "user"),
    db.client.from("flashcards").select("id,updated_at,deleted_at").eq("list_id", listId).eq("user_id", db.userId),
  ]);
  if (listError) throw toMcpDomainError(listError, "Não foi possível verificar o estado da lista.");
  if (cardError) throw toMcpDomainError(cardError, "Não foi possível verificar o estado dos cards da lista.");
  const rows: ConfirmationStateRow[] = [
    ...asRows(listData).map((row) => {
      const record = asRow(row) ?? {};
      return { kind: "list", id: str(record, "id") ?? "", updatedAt: record.updated_at, deletedAt: record.deleted_at };
    }),
    ...asRows(cardData).map((row) => {
      const record = asRow(row) ?? {};
      return { kind: "card", id: str(record, "id") ?? "", updatedAt: record.updated_at, deletedAt: record.deleted_at };
    }),
  ];
  return confirmationStateFingerprint(rows);
}

async function folderDeletionState(db: UserScopedDb, folderId: string): Promise<string> {
  const { data: folderData, error: folderError } = await db.client
    .from("folders")
    .select("id,updated_at,deleted_at")
    .eq("id", folderId)
    .eq("system_kind", "user");
  if (folderError) throw toMcpDomainError(folderError, "Não foi possível verificar o estado da pasta.");
  const { data: listData, error: listError } = await db.client
    .from("lists")
    .select("id,updated_at,deleted_at")
    .eq("folder_id", folderId)
    .eq("system_kind", "user");
  if (listError) throw toMcpDomainError(listError, "Não foi possível verificar o estado das listas da pasta.");
  const listRows = asRows(listData).map((row) => {
    const record = asRow(row) ?? {};
    return { kind: "list", id: str(record, "id") ?? "", updatedAt: record.updated_at, deletedAt: record.deleted_at };
  });
  const listIds = listRows.map((row) => row.id).filter(Boolean);
  let cardRows: ConfirmationStateRow[] = [];
  if (listIds.length > 0) {
    const { data: cardData, error: cardError } = await db.client
      .from("flashcards")
      .select("id,updated_at,deleted_at")
      .in("list_id", listIds)
      .eq("user_id", db.userId);
    if (cardError) throw toMcpDomainError(cardError, "Não foi possível verificar o estado dos cards da pasta.");
    cardRows = asRows(cardData).map((row) => {
      const record = asRow(row) ?? {};
      return { kind: "card", id: str(record, "id") ?? "", updatedAt: record.updated_at, deletedAt: record.deleted_at };
    });
  }
  const folderRows = asRows(folderData).map((row) => {
    const record = asRow(row) ?? {};
    return { kind: "folder", id: str(record, "id") ?? "", updatedAt: record.updated_at, deletedAt: record.deleted_at };
  });
  return confirmationStateFingerprint([...folderRows, ...listRows, ...cardRows]);
}

export interface DeletePreviewInput {
  list_id?: unknown;
  folder_id?: unknown;
}

export interface ConfirmDeleteInput {
  list_id?: unknown;
  folder_id?: unknown;
  confirmation_token?: unknown;
}

export async function previewListDeletion(
  db: UserScopedDb,
  input: DeletePreviewInput,
  key: ConfirmationKey,
): Promise<Record<string, unknown>> {
  const list = await findOwnedList(db, input.list_id);
  const listId = String(list.id);
  const cardCount = (await countListCards(db, listId)) ?? 0;
  const stateFingerprint = await listDeletionState(db, listId);
  const confirmation = await createConfirmationToken(key, {
    action: "delete_list",
    userId: db.userId,
    objectId: listId,
    expectedCount: cardCount,
    stateFingerprint,
  });

  return {
    dry_run: true,
    target: {
      type: "list",
      ...compactList(list),
      folder_id: str(list, "folder_id"),
      folder_title: str(asRow(list.folders), "title"),
    },
    card_count: cardCount,
    consequences: [
      "A lista e seus " + cardCount + " card(s) ativos vão para a lixeira (soft delete).",
      "A lixeira do produto remove definitivamente após " + TRASH_RETENTION_DAYS + " dias.",
      "Enquanto estiver na lixeira, restore_from_trash recupera a lista e seus cards.",
      "Nenhuma outra conta, turma ou coleção de sistema é afetada.",
    ],
    recoverable: true,
    retention_days: TRASH_RETENTION_DAYS,
    confirmation_token: confirmation.token,
    expires_at: confirmation.expires_at,
    ttl_seconds: confirmation.ttl_seconds,
  };
}

export async function confirmListDeletion(
  db: UserScopedDb,
  input: ConfirmDeleteInput,
  key: ConfirmationKey,
): Promise<Record<string, unknown>> {
  const existing = await findOwnedList(db, input.list_id, { includeDeleted: true });
  const listId = String(existing.id);
  if (str(existing, "deleted_at")) {
    return { deleted: false, already_deleted: true, list_id: listId, cards_removed: 0 };
  }

  const cardCount = (await countListCards(db, listId)) ?? 0;
  const stateFingerprint = await listDeletionState(db, listId);
  await verifyConfirmationToken(key, input.confirmation_token, {
    action: "delete_list",
    userId: db.userId,
    objectId: listId,
    expectedCount: cardCount,
    stateFingerprint,
  });
  await callTrashRpc(
    db,
    "soft_delete_list",
    { p_list_id: listId, p_user_id: db.userId },
    "Não foi possível mover a lista para a lixeira.",
  );
  invalidateScopeInventory(db.userId, listInstitutionId(existing));
  return {
    deleted: true,
    already_deleted: false,
    list_id: listId,
    title: str(existing, "title"),
    cards_removed: cardCount,
    recoverable: true,
    retention_days: TRASH_RETENTION_DAYS,
  };
}

export async function previewFolderDeletion(
  db: UserScopedDb,
  input: DeletePreviewInput,
  key: ConfirmationKey,
): Promise<Record<string, unknown>> {
  const folder = await findOwnedFolder(db, input.folder_id);
  const folderId = String(folder.id);
  const listIds = await activeListIds(db, folderId);
  const cardCount = await countCardsInLists(db, listIds);
  const stateFingerprint = await folderDeletionState(db, folderId);
  const confirmation = await createConfirmationToken(key, {
    action: "delete_folder",
    userId: db.userId,
    objectId: folderId,
    expectedCount: listIds.length,
    stateFingerprint,
  });

  return {
    dry_run: true,
    target: { type: "folder", ...compactFolderSummary(folder) },
    list_count: listIds.length,
    card_count: cardCount,
    consequences: [
      "A pasta, suas " + listIds.length + " lista(s) e seus " + cardCount + " card(s) ativos vão para a lixeira (soft delete em cascata).",
      "A lixeira do produto remove definitivamente após " + TRASH_RETENTION_DAYS + " dias.",
      "Enquanto estiver na lixeira, restore_from_trash recupera a pasta, as listas e os cards.",
      "Coleções de sistema (Reforço / Pontos de atenção) e conteúdo de turma não são afetados.",
    ],
    recoverable: true,
    retention_days: TRASH_RETENTION_DAYS,
    confirmation_token: confirmation.token,
    expires_at: confirmation.expires_at,
    ttl_seconds: confirmation.ttl_seconds,
  };
}

export async function confirmFolderDeletion(
  db: UserScopedDb,
  input: ConfirmDeleteInput,
  key: ConfirmationKey,
): Promise<Record<string, unknown>> {
  const existing = await findOwnedFolder(db, input.folder_id, { includeDeleted: true });
  const folderId = String(existing.id);
  if (str(existing, "deleted_at")) {
    return { deleted: false, already_deleted: true, folder_id: folderId, lists_removed: 0, cards_removed: 0 };
  }

  const listIds = await activeListIds(db, folderId);
  const cardCount = await countCardsInLists(db, listIds);
  const stateFingerprint = await folderDeletionState(db, folderId);
  await verifyConfirmationToken(key, input.confirmation_token, {
    action: "delete_folder",
    userId: db.userId,
    objectId: folderId,
    expectedCount: listIds.length,
    stateFingerprint,
  });
  await callTrashRpc(
    db,
    "soft_delete_folder",
    { p_folder_id: folderId, p_user_id: db.userId },
    "Não foi possível mover a pasta para a lixeira.",
  );
  invalidateScopeInventory(db.userId, folderInstitutionId(existing));
  return {
    deleted: true,
    already_deleted: false,
    folder_id: folderId,
    title: str(existing, "title"),
    lists_removed: listIds.length,
    cards_removed: cardCount,
    recoverable: true,
    retention_days: TRASH_RETENTION_DAYS,
  };
}

export interface RestoreInput {
  target: unknown;
  id: unknown;
}

/** Restores a trashed list/folder using the product's own restore RPCs. */
export async function restoreFromTrash(
  db: UserScopedDb,
  input: RestoreInput,
): Promise<Record<string, unknown>> {
  const target = requireEnum(input.target, "target", TRASH_TARGETS);
  if (target === "list") {
    const existing = await findOwnedList(db, input.id, { includeDeleted: true });
    const id = String(existing.id);
    if (!str(existing, "deleted_at")) {
      return { restored: false, already_active: true, target, id };
    }
    await callTrashRpc(
      db,
      "restore_list",
      { p_list_id: id, p_user_id: db.userId },
      "Não foi possível restaurar a lista.",
    );
    invalidateScopeInventory(db.userId, listInstitutionId(existing));
    return {
      restored: true,
      target,
      id,
      title: str(existing, "title"),
      note: "A pasta pai também é restaurada quando estava na lixeira.",
    };
  }

  const existing = await findOwnedFolder(db, input.id, { includeDeleted: true });
  const id = String(existing.id);
  if (!str(existing, "deleted_at")) {
    return { restored: false, already_active: true, target, id };
  }
  await callTrashRpc(
    db,
    "restore_folder",
    { p_folder_id: id, p_user_id: db.userId },
    "Não foi possível restaurar a pasta.",
  );
  invalidateScopeInventory(db.userId, folderInstitutionId(existing));
  return { restored: true, target, id, title: str(existing, "title") };
}
