import { compactFolderSummary, compactList, findOwnedFolder, findOwnedList, folderInstitutionId } from "./access";
import { TRASH_RETENTION_DAYS } from "./cardWrites";
import type { ConfirmationKey, UserScopedDb } from "./client";
import { createConfirmationToken, verifyConfirmationToken } from "./confirmation";
import { McpDomainError, toMcpDomainError } from "./errors";
import { countListCards } from "./flashcards";
import { invalidateScopeInventory, listInstitutionId } from "./inventoryInvalidation";
import { asRow, asRows, str } from "./query";
import { requireUuid } from "./scope";
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
  const confirmation = await createConfirmationToken(key, {
    action: "delete_list",
    userId: db.userId,
    objectId: listId,
    expectedCount: cardCount,
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
  const listId = requireUuid(input.list_id, "list_id");
  const existing = await findOwnedList(db, listId, { includeDeleted: true });
  if (str(existing, "deleted_at")) {
    return { deleted: false, already_deleted: true, list_id: listId, cards_removed: 0 };
  }

  const cardCount = (await countListCards(db, listId)) ?? 0;
  await verifyConfirmationToken(key, input.confirmation_token, {
    action: "delete_list",
    userId: db.userId,
    objectId: listId,
    expectedCount: cardCount,
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
  const confirmation = await createConfirmationToken(key, {
    action: "delete_folder",
    userId: db.userId,
    objectId: folderId,
    expectedCount: listIds.length,
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
  const folderId = requireUuid(input.folder_id, "folder_id");
  const existing = await findOwnedFolder(db, folderId, { includeDeleted: true });
  if (str(existing, "deleted_at")) {
    return { deleted: false, already_deleted: true, folder_id: folderId, lists_removed: 0, cards_removed: 0 };
  }

  const listIds = await activeListIds(db, folderId);
  const cardCount = await countCardsInLists(db, listIds);
  await verifyConfirmationToken(key, input.confirmation_token, {
    action: "delete_folder",
    userId: db.userId,
    objectId: folderId,
    expectedCount: listIds.length,
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
  const id = requireUuid(input.id, "id");

  if (target === "list") {
    const existing = await findOwnedList(db, id, { includeDeleted: true });
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

  const existing = await findOwnedFolder(db, id, { includeDeleted: true });
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
