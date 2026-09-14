import { compactFolderSummary, findOwnedFolder, OWNED_FOLDER_SELECT } from "./access";
import type { UserScopedDb } from "./client";
import { McpDomainError, toMcpDomainError } from "./errors";
import { invalidateScopeInventory } from "./inventoryInvalidation";
import { asRow, str } from "./query";
import { assertScopeAccessible, requireUuid } from "./scope";
import { optionalEnum, optionalText, requireEnum, requireText } from "./validation";

export const FOLDER_TITLE_MAX = 120;
export const FOLDER_DESCRIPTION_MAX = 1000;
export const FOLDER_VISIBILITIES = ["private", "class"] as const;
export type FolderVisibility = (typeof FOLDER_VISIBILITIES)[number];

function scopeFor(institutionId: string | null) {
  return institutionId === null
    ? ({ kind: "personal" } as const)
    : ({ kind: "institution", institutionId } as const);
}

export interface CreateFolderInput {
  title: unknown;
  description?: unknown;
  visibility?: unknown;
  institution_id?: unknown;
}

/** Creates a plain user folder; owner always comes from the verified token. */
export async function createFolder(
  db: UserScopedDb,
  input: CreateFolderInput,
): Promise<Record<string, unknown>> {
  const title = requireText(input.title, "title", FOLDER_TITLE_MAX);
  const description = optionalText(input.description, "description", FOLDER_DESCRIPTION_MAX) ?? null;
  const visibility = optionalEnum(input.visibility, "visibility", FOLDER_VISIBILITIES) ?? "private";
  const institutionId = input.institution_id === undefined || input.institution_id === null
    ? null
    : requireUuid(input.institution_id, "institution_id");

  if (institutionId) await assertScopeAccessible(db, scopeFor(institutionId));

  const { data, error } = await db.client
    .from("folders")
    .insert({
      owner_id: db.userId,
      title,
      description,
      visibility,
      institution_id: institutionId,
    })
    .select(OWNED_FOLDER_SELECT)
    .single();
  if (error) throw toMcpDomainError(error, "Não foi possível criar a pasta.");

  const record = asRow(data);
  if (!record) throw new McpDomainError("unavailable", "A pasta não foi devolvida pelo backend.");
  invalidateScopeInventory(db.userId, institutionId);
  return { created: true, folder: compactFolderSummary(record) };
}

export interface UpdateFolderInput {
  folder_id: unknown;
  title?: unknown;
  description?: unknown;
  visibility?: unknown;
  /** uuid moves the folder into an institution hub; null returns it to the personal library. */
  institution_id?: unknown;
}

/** Partial update of an owned folder; only whitelisted columns are written. */
export async function updateFolder(
  db: UserScopedDb,
  input: UpdateFolderInput,
): Promise<Record<string, unknown>> {
  const current = await findOwnedFolder(db, input.folder_id);
  const folderId = String(current.id);
  const currentInstitution = typeof current.institution_id === "string" ? current.institution_id : null;

  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = requireText(input.title, "title", FOLDER_TITLE_MAX);
  if (input.description !== undefined) {
    patch.description = optionalText(input.description, "description", FOLDER_DESCRIPTION_MAX);
  }
  if (input.visibility !== undefined) {
    patch.visibility = requireEnum(input.visibility, "visibility", FOLDER_VISIBILITIES);
  }

  let moved = false;
  if (input.institution_id !== undefined) {
    const targetInstitution = input.institution_id === null
      ? null
      : requireUuid(input.institution_id, "institution_id");
    if (targetInstitution) await assertScopeAccessible(db, scopeFor(targetInstitution));
    patch.institution_id = targetInstitution;
    moved = targetInstitution !== currentInstitution;
  }

  if (Object.keys(patch).length === 0) {
    throw new McpDomainError("invalid_input", "Nenhum campo para atualizar foi informado.", {
      hint: "Envie ao menos title, description, visibility ou institution_id.",
    });
  }

  const { data, error } = await db.client
    .from("folders")
    .update(patch)
    .eq("id", folderId)
    .eq("owner_id", db.userId)
    .eq("system_kind", "user")
    .is("deleted_at", null)
    .select(OWNED_FOLDER_SELECT)
    .maybeSingle();
  if (error) throw toMcpDomainError(error, "Não foi possível atualizar a pasta.");

  const record = asRow(data);
  if (!record) {
    throw new McpDomainError("not_found", "A pasta não pôde ser atualizada nesta conta.", {
      hint: "Confirme o folder_id com list_folders antes de repetir.",
    });
  }
  const updatedInstitution = str(record, "institution_id") ?? null;
  invalidateScopeInventory(db.userId, currentInstitution);
  if (updatedInstitution !== currentInstitution) invalidateScopeInventory(db.userId, updatedInstitution);
  return { updated: true, moved, folder: compactFolderSummary(record) };
}
