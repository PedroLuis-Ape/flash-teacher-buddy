import { findAccessibleList, findOwnedFolder, OWNED_FOLDER_SELECT } from "./access";
import type { UserScopedDb } from "./client";
import { addCards, type CardInput } from "./cardWrites";
import { McpDomainError, toMcpDomainError } from "./errors";
import { createFolder } from "./folderWrites";
import { createList } from "./listWrites";
import { asRow, asRows, str } from "./query";
import { assertScopeAccessible, requireUuid, scopeName, type LibraryScope } from "./scope";
import { ACCESSIBLE_LIST_SELECT } from "./access";
import { requireText } from "./validation";

export interface NameOrIdSelector {
  id?: unknown;
  name?: unknown;
}

export interface CreateStudyMaterialInput {
  scope: unknown;
  institution_id?: unknown;
  folder: NameOrIdSelector;
  list: NameOrIdSelector;
  cards: unknown;
  dry_run?: unknown;
  preview?: unknown;
}

function normalizedName(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function selector(selector: NameOrIdSelector, field: string): { id?: string; name?: string } {
  const id = selector?.id === undefined || selector.id === null ? undefined : requireUuid(selector.id, `${field}.id`);
  const name = selector?.name === undefined || selector.name === null
    ? undefined
    : requireText(selector.name, `${field}.name`, 120);
  if ((id && name) || (!id && !name)) {
    throw new McpDomainError("invalid_input", `Informe exatamente um id ou name em "${field}".`, {
      hint: `Use list_folders/list_lists para descobrir o ${field} atual antes de criar material.`,
    });
  }
  return id ? { id } : { name };
}

function resolveScope(rawScope: unknown, rawInstitutionId: unknown): LibraryScope {
  if (rawScope !== "personal" && rawScope !== "institution") {
    throw new McpDomainError("invalid_input", '"scope" precisa ser "personal" ou "institution".');
  }
  if (rawScope === "personal") {
    if (rawInstitutionId !== undefined && rawInstitutionId !== null) {
      throw new McpDomainError("invalid_input", 'Não envie institution_id quando scope = "personal".');
    }
    return { kind: "personal" };
  }
  if (rawInstitutionId === undefined || rawInstitutionId === null) {
    throw new McpDomainError("invalid_input", 'scope = "institution" exige institution_id.', {
      hint: "Use get_my_profile para descobrir o id do hub institucional.",
    });
  }
  return { kind: "institution", institutionId: requireUuid(rawInstitutionId, "institution_id") };
}

function exactName(row: Record<string, unknown>, expected: string): boolean {
  return normalizedName(str(row, "title") ?? "") === normalizedName(expected);
}

function ambiguous(entity: string, candidates: Array<{ id: string; path: string }>): never {
  throw new McpDomainError("ambiguous", `O nome da ${entity} é ambíguo nesta biblioteca.`, {
    hint: "Escolha um candidato pelo id. Candidatos: " + candidates.map((candidate) => `${candidate.id} — ${candidate.path}`).join("; "),
  });
}

async function resolveFolder(
  db: UserScopedDb,
  scope: LibraryScope,
  requested: { id?: string; name?: string },
): Promise<Record<string, unknown> | null> {
  const base = db.client
    .from("folders")
    .select(OWNED_FOLDER_SELECT)
    .eq("owner_id", db.userId)
    .eq("system_kind", "user")
    .is("deleted_at", null)
    .is("class_id", null);
  const scoped = scope.kind === "personal" ? base.is("institution_id", null) : base.eq("institution_id", scope.institutionId);
  const query = requested.id ? scoped.eq("id", requested.id) : scoped.ilike("title", requested.name as string);
  const { data, error } = await query.order("title", { ascending: true }).order("id", { ascending: true });
  if (error) throw toMcpDomainError(error, "Não foi possível resolver a pasta do material.");
  const rows = asRows(data).map(asRow).filter((row): row is Record<string, unknown> => Boolean(row));
  if (requested.id) return rows[0] ?? null;
  const matches = rows.filter((row) => exactName(row, requested.name as string));
  if (matches.length > 1) ambiguous("pasta", matches.map((row) => ({ id: str(row, "id") ?? "", path: str(row, "title") ?? "" })));
  return matches[0] ?? null;
}

async function resolveList(
  db: UserScopedDb,
  scope: LibraryScope,
  folder: Record<string, unknown>,
  requested: { id?: string; name?: string },
): Promise<Record<string, unknown> | null> {
  if (requested.id) {
    const found = await findAccessibleList(db, requested.id, scope);
    if (str(found, "folder_id") !== str(folder, "id")) {
      throw new McpDomainError("conflict", "A lista informada não pertence à pasta selecionada.", {
        hint: "Use list_lists com a pasta correta ou informe o id de outra lista.",
      });
    }
    return found;
  }
  const { data, error } = await db.client
    .from("lists")
    .select(ACCESSIBLE_LIST_SELECT)
    .eq("folder_id", str(folder, "id"))
    .eq("folders.owner_id", db.userId)
    .eq("folders.system_kind", "user")
    .is("folders.deleted_at", null)
    .is("folders.class_id", null)
    .eq("system_kind", "user")
    .is("deleted_at", null)
    .ilike("title", requested.name as string)
    .order("title", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw toMcpDomainError(error, "Não foi possível resolver a lista do material.");
  const rows = asRows(data).map(asRow).filter((row): row is Record<string, unknown> => Boolean(row));
  const matches = rows.filter((row) => exactName(row, requested.name as string));
  if (matches.length > 1) {
    const folderTitle = str(folder, "title") ?? "Pasta";
    ambiguous("lista", matches.map((row) => ({ id: str(row, "id") ?? "", path: `${folderTitle} / ${str(row, "title") ?? ""}` })));
  }
  return matches[0] ?? null;
}

async function compensate(db: UserScopedDb, listId: string | null, folderId: string | null): Promise<void> {
  if (listId) {
    const { error } = await db.client.rpc("soft_delete_list", { p_list_id: listId, p_user_id: db.userId });
    if (error) throw toMcpDomainError(error, "A operação falhou e a compensação da lista também falhou.");
  }
  if (folderId) {
    const { error } = await db.client.rpc("soft_delete_folder", { p_folder_id: folderId, p_user_id: db.userId });
    if (error) throw toMcpDomainError(error, "A operação falhou e a compensação da pasta também falhou.");
  }
}

export async function createStudyMaterial(
  db: UserScopedDb,
  input: CreateStudyMaterialInput,
): Promise<Record<string, unknown>> {
  const scope = resolveScope(input.scope, input.institution_id);
  await assertScopeAccessible(db, scope);
  const folderSelector = selector(input.folder, "folder");
  const listSelector = selector(input.list, "list");
  if (!Array.isArray(input.cards) || input.cards.length === 0) {
    throw new McpDomainError("invalid_input", '"cards" precisa ser uma lista não vazia.', {
      hint: "Para analisar sem criar, use analyze_text_against_library; esta tool só cria material quando chamada com cards.",
    });
  }
  const dryRun = input.dry_run === true || input.preview === true;
  const requestedFolder = await resolveFolder(db, scope, folderSelector);
  const folderId = requestedFolder ? str(requestedFolder, "id") : null;
  if (!requestedFolder && folderSelector.id) {
    throw new McpDomainError("not_found", "A pasta informada não existe neste escopo.", {
      hint: "Use list_folders para descobrir o id atual ou informe folder.name para criar uma nova pasta.",
    });
  }
  const plannedFolder = requestedFolder ?? {
    id: null,
    title: folderSelector.name,
    institution_id: scope.kind === "institution" ? scope.institutionId : null,
  };
  const requestedList = folderId ? await resolveList(db, scope, requestedFolder as Record<string, unknown>, listSelector) : null;
  if (!requestedList && listSelector.id) {
    throw new McpDomainError("not_found", "A lista informada não existe na pasta/escopo selecionado.", {
      hint: "Use list_lists para descobrir o id atual ou informe list.name para criar uma nova lista.",
    });
  }

  if (dryRun) {
    return {
      dry_run: true,
      scope: scopeName(scope),
      folder: { id: folderId, title: str(plannedFolder, "title") ?? "", path: str(plannedFolder, "title") ?? "" },
      list: { id: requestedList ? str(requestedList, "id") : null, title: requestedList ? str(requestedList, "title") ?? "" : listSelector.name, path: `${str(plannedFolder, "title") ?? ""} / ${requestedList ? str(requestedList, "title") ?? "" : listSelector.name ?? ""}` },
      will_create: { folder: !requestedFolder, list: !requestedList, cards: input.cards.length },
      summary: { folder_created: false, list_created: false, cards_created: 0, cards_skipped: 0 },
    };
  }

  let createdFolderId: string | null = null;
  let createdListId: string | null = null;
  try {
    let folder = requestedFolder;
    if (!folder) {
      const created = await createFolder(db, {
        title: folderSelector.name,
        institution_id: scope.kind === "institution" ? scope.institutionId : undefined,
      });
      const createdFolder = asRow(created.folder);
      createdFolderId = str(createdFolder, "id") ?? null;
      if (!createdFolderId) throw new McpDomainError("unavailable", "A pasta criada não devolveu um id.");
      folder = await findOwnedFolder(db, createdFolderId);
    }
    let list = requestedList;
    if (!list) {
      const created = await createList(db, { folder_id: str(folder, "id"), title: listSelector.name });
      const createdList = asRow(created.list);
      createdListId = str(createdList, "id") ?? null;
      if (!createdListId) throw new McpDomainError("unavailable", "A lista criada não devolveu um id.");
      list = await findAccessibleList(db, createdListId, scope);
    }
    const cards = await addCards(db, { list_id: str(list, "id"), cards: input.cards as CardInput[], on_duplicate: "skip" });
    const createdCards = Array.isArray(cards.cards) ? cards.cards : [];
    return {
      dry_run: false,
      scope: scopeName(scope),
      folder: { id: str(folder, "id"), title: str(folder, "title") ?? "", path: str(folder, "title") ?? "" },
      list: { id: str(list, "id"), title: str(list, "title") ?? "", path: `${str(folder, "title") ?? ""} / ${str(list, "title") ?? ""}` },
      created_folder_id: createdFolderId,
      created_list_id: createdListId,
      card_ids: createdCards.map((card) => str(asRow(card), "id")).filter((id): id is string => Boolean(id)),
      summary: {
        folder_created: Boolean(createdFolderId),
        list_created: Boolean(createdListId),
        cards_created: Number(cards.created ?? 0),
        cards_skipped: Number(cards.skipped_existing ?? 0),
      },
    };
  } catch (error) {
    if (createdFolderId || createdListId) await compensate(db, createdListId, createdFolderId);
    throw error;
  }
}
