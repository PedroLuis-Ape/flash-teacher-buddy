import { ACCESSIBLE_LIST_SELECT, compactFolderRef, compactList, findOwnedFolder, findOwnedList, folderInstitutionId } from "./access";
import type { UserScopedDb } from "./client";
import { McpDomainError, toMcpDomainError } from "./errors";
import { invalidateScopeInventory, listInstitutionId } from "./inventoryInvalidation";
import { asRow, asRows, str } from "./query";
import { requireReferenceList } from "./referenceIds";
import {
  optionalBoolean,
  optionalEnum,
  optionalLanguageTag,
  optionalText,
  requireText,
} from "./validation";

export const LIST_TITLE_MAX = 120;
export const LIST_DESCRIPTION_MAX = 1000;
export const LIST_LABEL_MAX = 40;
export const STUDY_TYPES = ["language", "general"] as const;
export const PRIMARY_SIDES = ["a", "b"] as const;
export const MAX_REORDER_LISTS = 200;
export const MAX_DUPLICATE_CARDS = 2000;
const COPY_CHUNK = 200;

const CARD_COPY_SELECT =
  "id,term,translation,hint,example_text,example_translation,context_tag,lang,layer_index,parent_card_id,status_group_uid," +
  "image_url_a,image_url_b,audio_url,word_hints,accepted_answers_en,accepted_answers_pt,common_mistakes," +
  "detailed_explanation,display_text,eval_text,note_text,short_explanation,usage_notes";

export interface ListSettingsInput {
  study_type?: unknown;
  lang_a?: unknown;
  lang_b?: unknown;
  labels_a?: unknown;
  labels_b?: unknown;
  tts_enabled?: unknown;
  primary_side?: unknown;
}

/**
 * Study settings are a closed domain: study_type accepts only the values the
 * database CHECK allows, and languages are normalized to BCP-47-ish tags.
 */
export function listSettingsPatch(input: ListSettingsInput): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (input.study_type !== undefined) {
    patch.study_type = optionalEnum(input.study_type, "study_type", STUDY_TYPES);
  }
  if (input.lang_a !== undefined) {
    patch.lang_a = optionalLanguageTag(input.lang_a, "lang_a", "en") ?? "en";
  }
  if (input.lang_b !== undefined) {
    patch.lang_b = optionalLanguageTag(input.lang_b, "lang_b", "pt") ?? "pt";
  }
  if (input.labels_a !== undefined) {
    patch.labels_a = optionalText(input.labels_a, "labels_a", LIST_LABEL_MAX);
  }
  if (input.labels_b !== undefined) {
    patch.labels_b = optionalText(input.labels_b, "labels_b", LIST_LABEL_MAX);
  }
  if (input.tts_enabled !== undefined) {
    patch.tts_enabled = optionalBoolean(input.tts_enabled, "tts_enabled");
  }
  if (input.primary_side !== undefined) {
    patch.primary_side = optionalEnum(input.primary_side, "primary_side", PRIMARY_SIDES);
  }
  return patch;
}

function listSettingsFrom(row: Record<string, unknown>): ListSettingsInput {
  const studyType = str(row, "study_type");
  const languageTag = (value: string | undefined, fallback: string) =>
    value && /^[a-z]{2}(-[A-Za-z]{2,4})?$/i.test(value) ? value : fallback;
  return {
    study_type: studyType === "general" ? "general" : "language",
    lang_a: languageTag(str(row, "lang_a"), "en"),
    lang_b: languageTag(str(row, "lang_b"), "pt"),
    labels_a: str(row, "labels_a"),
    labels_b: str(row, "labels_b"),
    tts_enabled: typeof row.tts_enabled === "boolean" ? row.tts_enabled : true,
    primary_side: str(row, "primary_side") === "b" ? "b" : "a",
  };
}

async function nextOrderIndex(db: UserScopedDb, folderId: string): Promise<number> {
  const { count, error } = await db.client
    .from("lists")
    .select("id", { count: "exact", head: true })
    .eq("folder_id", folderId)
    .eq("system_kind", "user")
    .is("deleted_at", null);
  if (error) throw toMcpDomainError(error, "Não foi possível calcular a ordem da lista.");
  return typeof count === "number" ? count : 0;
}

async function readListRow(db: UserScopedDb, listId: string): Promise<Record<string, unknown>> {
  const { data, error } = await db.client
    .from("lists")
    .select(ACCESSIBLE_LIST_SELECT)
    .eq("id", listId)
    .eq("folders.owner_id", db.userId)
    .eq("system_kind", "user")
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw toMcpDomainError(error, "Não foi possível reler a lista.");
  const record = asRow(data);
  if (!record) {
    throw new McpDomainError("unavailable", "A lista não pôde ser relida após a escrita.");
  }
  return record;
}

async function insertListRow(
  db: UserScopedDb,
  params: {
    folderId: string;
    title: string;
    description: string | null;
    institutionId: string | null;
    settings: ListSettingsInput;
  },
): Promise<Record<string, unknown>> {
  const orderIndex = await nextOrderIndex(db, params.folderId);
  const { data, error } = await db.client
    .from("lists")
    .insert({
      folder_id: params.folderId,
      owner_id: db.userId,
      title: params.title,
      description: params.description,
      order_index: orderIndex,
      institution_id: params.institutionId,
      ...listSettingsPatch(params.settings),
    })
    .select("id")
    .single();
  if (error) throw toMcpDomainError(error, "Não foi possível criar a lista.");
  const created = asRow(data);
  const createdId = created ? str(created, "id") : undefined;
  if (!createdId) throw new McpDomainError("unavailable", "A lista criada não foi devolvida pelo backend.");
  return readListRow(db, createdId);
}

export interface CreateListInput extends ListSettingsInput {
  folder_id: unknown;
  title: unknown;
  description?: unknown;
}

export async function createList(db: UserScopedDb, input: CreateListInput): Promise<Record<string, unknown>> {
  const folder = await findOwnedFolder(db, input.folder_id);
  const record = await insertListRow(db, {
    folderId: String(folder.id),
    title: requireText(input.title, "title", LIST_TITLE_MAX),
    description: optionalText(input.description, "description", LIST_DESCRIPTION_MAX) ?? null,
    institutionId: folderInstitutionId(folder),
    settings: input,
  });
  invalidateScopeInventory(db.userId, listInstitutionId(record));
  return { created: true, list: compactList(record), folder: compactFolderRef(record) };
}

export interface UpdateListInput extends ListSettingsInput {
  list_id: unknown;
  title?: unknown;
  description?: unknown;
}

export async function updateList(db: UserScopedDb, input: UpdateListInput): Promise<Record<string, unknown>> {
  const current = await findOwnedList(db, input.list_id);
  const listId = String(current.id);

  const patch = listSettingsPatch(input);
  if (input.title !== undefined) patch.title = requireText(input.title, "title", LIST_TITLE_MAX);
  if (input.description !== undefined) {
    patch.description = optionalText(input.description, "description", LIST_DESCRIPTION_MAX);
  }
  if (Object.keys(patch).length === 0) {
    throw new McpDomainError("invalid_input", "Nenhum campo para atualizar foi informado.", {
      hint: "Envie title, description ou algum campo de estudo (study_type, lang_a, lang_b, labels_a, labels_b, tts_enabled, primary_side).",
    });
  }

  const { data, error } = await db.client
    .from("lists")
    .update(patch)
    .eq("id", listId)
    .eq("system_kind", "user")
    .is("deleted_at", null)
    .select(ACCESSIBLE_LIST_SELECT)
    .maybeSingle();
  if (error) throw toMcpDomainError(error, "Não foi possível atualizar a lista.");
  const record = asRow(data);
  if (!record) {
    throw new McpDomainError("not_found", "A lista não pôde ser atualizada nesta conta.", {
      hint: "Confirme o list_id com list_lists antes de repetir.",
    });
  }
  invalidateScopeInventory(db.userId, listInstitutionId(record));
  return { updated: true, list: compactList(record), folder: compactFolderRef(record) };
}

export interface MoveListInput {
  list_id: unknown;
  folder_id: unknown;
}

/**
 * Moves a list to another owned folder. The list mirrors the destination
 * folder's institution, so list and folder never disagree about the scope.
 */
export async function moveList(db: UserScopedDb, input: MoveListInput): Promise<Record<string, unknown>> {
  const current = await findOwnedList(db, input.list_id);
  const listId = String(current.id);
  const destination = await findOwnedFolder(db, input.folder_id);
  const destinationId = String(destination.id);
  const sourceFolderId = str(current, "folder_id") ?? null;
  const sourceFolderTitle = str(asRow(current.folders), "title");

  if (sourceFolderId === destinationId) {
    return {
      moved: false,
      already_in_folder: true,
      list: compactList(current),
      folder: compactFolderRef(current),
    };
  }

  const { data, error } = await db.client
    .from("lists")
    .update({
      folder_id: destinationId,
      institution_id: folderInstitutionId(destination),
      order_index: await nextOrderIndex(db, destinationId),
    })
    .eq("id", listId)
    .eq("system_kind", "user")
    .is("deleted_at", null)
    .select(ACCESSIBLE_LIST_SELECT)
    .maybeSingle();
  if (error) throw toMcpDomainError(error, "Não foi possível mover a lista.");
  const record = asRow(data);
  if (!record) {
    throw new McpDomainError("not_found", "A lista não pôde ser movida nesta conta.", {
      hint: "Confirme list_id e folder_id antes de repetir.",
    });
  }
  invalidateScopeInventory(db.userId, listInstitutionId(current));
  invalidateScopeInventory(db.userId, folderInstitutionId(destination));
  return {
    moved: true,
    from: { folder_id: sourceFolderId, folder_title: sourceFolderTitle },
    to: { folder_id: destinationId, folder_title: str(destination, "title") },
    list: compactList(record),
  };
}

export interface ReorderListsInput {
  folder_id: unknown;
  list_ids: unknown;
}

/**
 * Reorders the given lists inside one folder using the product's 0-based
 * order_index. One MCP call; the backend still performs one row update per
 * list, executed concurrently.
 */
export async function reorderLists(db: UserScopedDb, input: ReorderListsInput): Promise<Record<string, unknown>> {
  const folder = await findOwnedFolder(db, input.folder_id);
  const folderId = String(folder.id);
  const requestedListIds = requireReferenceList(input.list_ids, "list_ids", "list", MAX_REORDER_LISTS);
  const resolvedLists = await Promise.all(requestedListIds.map((listId) => findOwnedList(db, listId)));
  const listIds = resolvedLists.map((list) => String(list.id));

  const { data, error } = await db.client
    .from("lists")
    .select("id")
    .eq("folder_id", folderId)
    .eq("system_kind", "user")
    .is("deleted_at", null)
    .in("id", listIds);
  if (error) throw toMcpDomainError(error, "Não foi possível validar as listas da pasta.");
  const found = new Set(asRows(data).map((row) => String(asRow(row)?.id)));
  const missing = listIds.filter((listId) => !found.has(listId));
  if (missing.length > 0) {
    throw new McpDomainError("not_found", "Uma ou mais listas não pertencem a esta pasta.", {
      hint: `Confirme com list_lists(folder_id) antes de reordenar. Ausentes: ${missing.slice(0, 5).join(", ")}.`,
    });
  }

  const results = await Promise.all(
    listIds.map((listId, index) =>
      db.client
        .from("lists")
        .update({ order_index: index })
        .eq("id", listId)
        .eq("system_kind", "user")
        .is("deleted_at", null)
        .select("id"),
    ),
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) throw toMcpDomainError(failed.error, "Não foi possível reordenar todas as listas.");
  invalidateScopeInventory(db.userId, folderInstitutionId(folder));

  return {
    reordered: listIds.length,
    folder_id: folderId,
    order: listIds.map((listId, index) => ({ id: listId, order_index: index })),
  };
}

export interface DuplicateListInput {
  list_id: unknown;
  title?: unknown;
  folder_id?: unknown;
}

async function softDeleteListCascade(db: UserScopedDb, listId: string): Promise<void> {
  const { error } = await db.client.rpc("soft_delete_list", { p_list_id: listId, p_user_id: db.userId });
  if (error) throw toMcpDomainError(error, "Não foi possível compensar a duplicação parcial.");
}

/**
 * Duplicates a list inside the account's own library, copying study settings
 * and the active deck. Layer structure is rebuilt with fresh card ids and fresh
 * status-group identity (Favorite/Red List state is never inherited).
 */
export async function duplicateList(db: UserScopedDb, input: DuplicateListInput): Promise<Record<string, unknown>> {
  const source = await findOwnedList(db, input.list_id);
  const sourceId = String(source.id);
  const sourceFolderId = str(source, "folder_id");
  const destination = input.folder_id === undefined || input.folder_id === null
    ? null
    : await findOwnedFolder(db, input.folder_id);
  const targetFolderId = destination ? String(destination.id) : String(sourceFolderId);
  const targetInstitution = destination
    ? folderInstitutionId(destination)
    : (str(source, "institution_id") ?? null);

  const title = input.title === undefined
    ? `${str(source, "title") ?? "Lista"} (cópia)`
    : requireText(input.title, "title", LIST_TITLE_MAX);

  const { count, error: countError } = await db.client
    .from("flashcards")
    .select("id", { count: "exact", head: true })
    .eq("list_id", sourceId)
    .eq("user_id", db.userId)
    .is("deleted_at", null);
  if (countError) throw toMcpDomainError(countError, "Não foi possível contar os cards da lista.");
  const totalCards = typeof count === "number" ? count : 0;
  if (totalCards > MAX_DUPLICATE_CARDS) {
    throw new McpDomainError("invalid_input", `A lista tem ${totalCards} cards ativos; a duplicação aceita até ${MAX_DUPLICATE_CARDS}.`, {
      hint: "Duplique a lista em partes (mova os cards excedentes para listas auxiliares) ou aumente o limite na FASE 6.",
    });
  }

  const sourceCards: Record<string, unknown>[] = [];
  for (let from = 0; from < totalCards; from += COPY_CHUNK) {
    const { data, error } = await db.client
      .from("flashcards")
      .select(CARD_COPY_SELECT)
      .eq("list_id", sourceId)
      .eq("user_id", db.userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + COPY_CHUNK - 1);
    if (error) throw toMcpDomainError(error, "Não foi possível ler os cards da lista.");
    for (const row of asRows(data)) {
      const record = asRow(row);
      if (record) sourceCards.push(record);
    }
  }

  const created = await insertListRow(db, {
    folderId: targetFolderId,
    title,
    description: str(source, "description") ?? null,
    institutionId: targetInstitution,
    settings: listSettingsFrom(source),
  });
  const createdId = String(created.id);

  const idMap = new Map<string, string>();
  for (const card of sourceCards) {
    const oldId = str(card, "id");
    if (oldId) idMap.set(oldId, globalThis.crypto.randomUUID());
  }
  const groupMap = new Map<string, string>();
  const rows = sourceCards.map((card) => {
    const oldId = str(card, "id") ?? globalThis.crypto.randomUUID();
    const newId = idMap.get(oldId) ?? globalThis.crypto.randomUUID();
    const parentId = str(card, "parent_card_id") ?? null;
    const sourceGroup = str(card, "status_group_uid") ?? parentId ?? oldId;
    let groupId = groupMap.get(sourceGroup);
    if (!groupId) {
      groupId = (parentId ? idMap.get(parentId) : undefined) ?? newId;
      groupMap.set(sourceGroup, groupId);
    }
    return {
      id: newId,
      list_id: createdId,
      user_id: db.userId,
      term: str(card, "term") ?? "",
      translation: str(card, "translation") ?? "",
      hint: card.hint ?? null,
      example_text: card.example_text ?? null,
      example_translation: card.example_translation ?? null,
      context_tag: card.context_tag ?? null,
      lang: card.lang ?? null,
      layer_index: card.layer_index ?? null,
      parent_card_id: parentId ? (idMap.get(parentId) ?? null) : null,
      status_group_uid: groupId,
      image_url_a: card.image_url_a ?? null,
      image_url_b: card.image_url_b ?? null,
      audio_url: card.audio_url ?? null,
      word_hints: card.word_hints ?? null,
      accepted_answers_en: card.accepted_answers_en ?? null,
      accepted_answers_pt: card.accepted_answers_pt ?? null,
      common_mistakes: card.common_mistakes ?? null,
      detailed_explanation: card.detailed_explanation ?? null,
      display_text: card.display_text ?? null,
      eval_text: card.eval_text ?? null,
      note_text: card.note_text ?? null,
      short_explanation: card.short_explanation ?? null,
      usage_notes: card.usage_notes ?? null,
    };
  });

  let copied = 0;
  try {
    for (let index = 0; index < rows.length; index += COPY_CHUNK) {
      const chunk = rows.slice(index, index + COPY_CHUNK);
      const { data, error } = await db.client.from("flashcards").insert(chunk).select("id");
      if (error) throw toMcpDomainError(error, "Não foi possível copiar os cards da lista.");
      copied += asRows(data).length;
    }
  } catch (error) {
    // Compensation: the partially copied list goes to the trash instead of
    // staying as a silent half-copy in the library.
    await softDeleteListCascade(db, createdId);
    throw error;
  }

  const layers = rows.filter((row) => row.parent_card_id).length;
  invalidateScopeInventory(db.userId, targetInstitution);
  return {
    created: true,
    source_list_id: sourceId,
    list: compactList(created),
    copied_cards: copied,
    copied_layers: layers,
  };
}
