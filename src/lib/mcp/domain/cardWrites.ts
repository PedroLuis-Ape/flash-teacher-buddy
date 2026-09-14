import { findOwnedList } from "./access";
import type { ConfirmationKey, UserScopedDb } from "./client";
import { confirmationStateFingerprint, createConfirmationToken, verifyConfirmationToken } from "./confirmation";
import { McpDomainError, toMcpDomainError } from "./errors";
import { invalidateScopeInventory, listInstitutionId } from "./inventoryInvalidation";
import { asRow, asRows, str } from "./query";
import { requireUuid } from "./scope";
import { optionalText, requireText, requireUuidList, UUID } from "./validation";

export const MAX_BATCH_CARDS = 200;
export const CARD_TEXT_MAX = 2000;
export const CARD_CONTEXT_TAG_MAX = 80;
export const MAX_WORD_HINTS_BYTES = 20000;
/** Above this, removal is material and needs the two-step confirmation. */
export const MAX_REMOVAL_WITHOUT_CONFIRMATION = 25;
export const TRASH_RETENTION_DAYS = 7;

export type DuplicatePolicy = "skip" | "insert";

export interface CardInput {
  term?: unknown;
  translation?: unknown;
  hint?: unknown;
  example_text?: unknown;
  example_translation?: unknown;
  context_tag?: unknown;
  word_hints?: unknown;
  image_url_a?: unknown;
  image_url_b?: unknown;
  layer_index?: unknown;
  parent_card_id?: unknown;
}

export interface NormalizedCard {
  term: string;
  translation: string;
  hint: string | null;
  example_text: string | null;
  example_translation: string | null;
  context_tag: string | null;
  image_url_a: string | null;
  image_url_b: string | null;
  word_hints: unknown;
  layer_index: number | null;
  parent_card_id: string | null;
}

function normalizeWordHints(raw: unknown): unknown {
  if (raw === undefined || raw === null) return null;
  const isContainer = Array.isArray(raw) || (typeof raw === "object" && raw !== null);
  if (!isContainer) {
    throw new McpDomainError("invalid_input", '"word_hints" precisa ser um objeto ou uma lista JSON.');
  }
  let serialized = "";
  try {
    serialized = JSON.stringify(raw);
  } catch {
    throw new McpDomainError("invalid_input", '"word_hints" não é JSON serializável.');
  }
  if (serialized.length > MAX_WORD_HINTS_BYTES) {
    throw new McpDomainError("invalid_input", `"word_hints" excede ${MAX_WORD_HINTS_BYTES} bytes.`);
  }
  return raw;
}

function optionalLayerIndex(raw: unknown): number | null {
  if (raw === undefined || raw === null) return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > 50) {
    throw new McpDomainError("invalid_input", '"layer_index" precisa ser um inteiro entre 0 e 50.');
  }
  return value;
}

function optionalParentId(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "string" || !UUID.test(raw.trim())) {
    throw new McpDomainError("invalid_input", '"parent_card_id" precisa ser um UUID.');
  }
  return raw.trim().toLowerCase();
}

function optionalUrl(raw: unknown, field: string): string | null {
  const value = optionalText(raw, field, CARD_TEXT_MAX);
  return value ?? null;
}

export function normalizeNewCard(raw: unknown, index: number): NormalizedCard {
  const record = asRow(raw);
  if (!record) {
    throw new McpDomainError("invalid_input", `O card ${index + 1} precisa ser um objeto com term e translation.`);
  }
  return {
    term: requireText(record.term, `cards[${index}].term`, CARD_TEXT_MAX),
    translation: requireText(record.translation, `cards[${index}].translation`, CARD_TEXT_MAX),
    hint: optionalText(record.hint, `cards[${index}].hint`, CARD_TEXT_MAX) ?? null,
    example_text: optionalText(record.example_text, `cards[${index}].example_text`, CARD_TEXT_MAX) ?? null,
    example_translation:
      optionalText(record.example_translation, `cards[${index}].example_translation`, CARD_TEXT_MAX) ?? null,
    context_tag: optionalText(record.context_tag, `cards[${index}].context_tag`, CARD_CONTEXT_TAG_MAX) ?? null,
    image_url_a: optionalUrl(record.image_url_a, `cards[${index}].image_url_a`),
    image_url_b: optionalUrl(record.image_url_b, `cards[${index}].image_url_b`),
    word_hints: normalizeWordHints(record.word_hints),
    layer_index: optionalLayerIndex(record.layer_index),
    parent_card_id: optionalParentId(record.parent_card_id),
  };
}

/** Partial card patch: structural identity (list_id, user_id, parent) is never editable here. */
export function normalizeCardPatch(raw: unknown, index = 0): Record<string, unknown> {
  const record = asRow(raw);
  if (!record) {
    throw new McpDomainError("invalid_input", "Os valores de edição precisam ser um objeto.");
  }
  const patch: Record<string, unknown> = {};
  if (record.term !== undefined) patch.term = requireText(record.term, `updates[${index}].term`, CARD_TEXT_MAX);
  if (record.translation !== undefined) {
    patch.translation = requireText(record.translation, `updates[${index}].translation`, CARD_TEXT_MAX);
  }
  if (record.hint !== undefined) patch.hint = optionalText(record.hint, "hint", CARD_TEXT_MAX);
  if (record.example_text !== undefined) {
    patch.example_text = optionalText(record.example_text, "example_text", CARD_TEXT_MAX);
  }
  if (record.example_translation !== undefined) {
    patch.example_translation = optionalText(record.example_translation, "example_translation", CARD_TEXT_MAX);
  }
  if (record.context_tag !== undefined) {
    patch.context_tag = optionalText(record.context_tag, "context_tag", CARD_CONTEXT_TAG_MAX);
  }
  if (record.image_url_a !== undefined) patch.image_url_a = optionalUrl(record.image_url_a, "image_url_a");
  if (record.image_url_b !== undefined) patch.image_url_b = optionalUrl(record.image_url_b, "image_url_b");
  if (record.word_hints !== undefined) patch.word_hints = normalizeWordHints(record.word_hints);
  if (record.layer_index !== undefined) patch.layer_index = optionalLayerIndex(record.layer_index);
  if (Object.keys(patch).length === 0) {
    throw new McpDomainError("invalid_input", "Nenhum campo editável foi informado.", {
      hint: "Campos aceitos: term, translation, hint, example_text, example_translation, context_tag, word_hints, image_url_a, image_url_b, layer_index.",
    });
  }
  return patch;
}

function cardKey(term: string, translation: string): string {
  return `${term.trim().toLowerCase().replace(/\s+/g, " ")}|${translation.trim().toLowerCase().replace(/\s+/g, " ")}`;
}

export interface AddCardsInput {
  list_id: unknown;
  cards: unknown;
  on_duplicate?: unknown;
}

/**
 * Batch insert: one HTTP request and one multi-row INSERT per chunk. When
 * on_duplicate is "skip" (default) a retried call cannot duplicate the same
 * term+translation pair inside the same list.
 */
export async function addCards(db: UserScopedDb, input: AddCardsInput): Promise<Record<string, unknown>> {
  const list = await findOwnedList(db, input.list_id);
  const listId = String(list.id);

  if (!Array.isArray(input.cards) || input.cards.length === 0) {
    throw new McpDomainError("invalid_input", '"cards" precisa ser uma lista não vazia.');
  }
  if (input.cards.length > MAX_BATCH_CARDS) {
    throw new McpDomainError("invalid_input", `"cards" aceita no máximo ${MAX_BATCH_CARDS} cards por chamada.`);
  }
  const policy: DuplicatePolicy = input.on_duplicate === "insert" ? "insert" : "skip";
  const normalized = input.cards.map((card, index) => normalizeNewCard(card, index));

  const parentIds = Array.from(new Set(normalized.map((card) => card.parent_card_id).filter(Boolean) as string[]));
  if (parentIds.length > 0) {
    const { data, error } = await db.client
      .from("flashcards")
      .select("id")
      .eq("list_id", listId)
      .eq("user_id", db.userId)
      .is("deleted_at", null)
      .in("id", parentIds);
    if (error) throw toMcpDomainError(error, "Não foi possível validar os cards pai.");
    const found = new Set(asRows(data).map((row) => str(asRow(row), "id")));
    const missingParent = parentIds.filter((id) => !found.has(id));
    if (missingParent.length > 0) {
      throw new McpDomainError("not_found", "Um card pai informado não existe nesta lista.", {
        hint: "Camadas exigem parent_card_id de um card ativo da mesma lista; use get_flashcards para descobrir o id.",
      });
    }
  }

  const skipped: Array<{ term: string; translation: string }> = [];
  let toInsert = normalized;
  if (policy === "skip") {
    const candidates = Array.from(
      new Set(normalized.flatMap((card) => [card.term, card.term.toLowerCase()])),
    );
    const { data, error } = await db.client
      .from("flashcards")
      .select("term,translation")
      .eq("list_id", listId)
      .eq("user_id", db.userId)
      .is("deleted_at", null)
      .in("term", candidates);
    if (error) throw toMcpDomainError(error, "Não foi possível verificar cards repetidos.");
    const existing = new Set(
      asRows(data).map((row) => {
        const record = asRow(row) ?? {};
        return cardKey(str(record, "term") ?? "", str(record, "translation") ?? "");
      }),
    );
    toInsert = normalized.filter((card) => {
      const key = cardKey(card.term, card.translation);
      if (existing.has(key)) {
        skipped.push({ term: card.term, translation: card.translation });
        return false;
      }
      existing.add(key);
      return true;
    });
  }

  if (toInsert.length === 0) {
    return {
      created: 0,
      skipped_existing: skipped.length,
      skipped: skipped.slice(0, 10),
      list: { id: listId, title: str(list, "title") ?? "" },
      cards: [],
    };
  }

  const payload = toInsert.map((card) => ({ list_id: listId, user_id: db.userId, ...card }));
  const { data, error } = await db.client.from("flashcards").insert(payload).select("id,term,translation");
  if (error) throw toMcpDomainError(error, "Não foi possível adicionar os flashcards.");
  invalidateScopeInventory(db.userId, listInstitutionId(list));

  return {
    created: asRows(data).length,
    skipped_existing: skipped.length,
    skipped: skipped.slice(0, 10),
    list: { id: listId, title: str(list, "title") ?? "" },
    cards: asRows(data).map((row) => {
      const record = asRow(row) ?? {};
      return { id: str(record, "id"), term: str(record, "term"), translation: str(record, "translation") };
    }),
  };
}

export interface UpdateCardsInput {
  list_id: unknown;
  card_ids?: unknown;
  set?: unknown;
  updates?: unknown;
}

/**
 * Two batch shapes: the same values for many cards (one UPDATE) or per-card
 * values (one bulk UPSERT request, with ownership pre-validated by a read).
 */
export async function updateCards(db: UserScopedDb, input: UpdateCardsInput): Promise<Record<string, unknown>> {
  const list = await findOwnedList(db, input.list_id);
  const listId = String(list.id);
  const hasApply = input.card_ids !== undefined || input.set !== undefined;
  const hasPerCard = input.updates !== undefined;

  if (hasApply && hasPerCard) {
    throw new McpDomainError("invalid_input", "Use card_ids+set OU updates, não os dois.");
  }
  if (!hasApply && !hasPerCard) {
    throw new McpDomainError("invalid_input", "Informe card_ids+set (mesmos valores) ou updates (valores por card).");
  }

  if (hasApply) {
    const cardIds = requireUuidList(input.card_ids, "card_ids", MAX_BATCH_CARDS);
    const patch = normalizeCardPatch(input.set ?? {});
    const { data, error } = await db.client
      .from("flashcards")
      .update(patch)
      .eq("list_id", listId)
      .eq("user_id", db.userId)
      .is("deleted_at", null)
      .in("id", cardIds)
      .select("id");
    if (error) throw toMcpDomainError(error, "Não foi possível atualizar os flashcards.");
    const updatedIds = asRows(data).map((row) => str(asRow(row), "id") ?? "");
    if (updatedIds.length > 0) invalidateScopeInventory(db.userId, listInstitutionId(list));
    return {
      mode: "same_values",
      updated: updatedIds.length,
      not_found: cardIds.filter((cardId) => !updatedIds.includes(cardId)),
      applied: patch,
      list: { id: listId, title: str(list, "title") ?? "" },
    };
  }

  if (!Array.isArray(input.updates) || input.updates.length === 0) {
    throw new McpDomainError("invalid_input", '"updates" precisa ser uma lista não vazia.');
  }
  if (input.updates.length > MAX_BATCH_CARDS) {
    throw new McpDomainError("invalid_input", `"updates" aceita no máximo ${MAX_BATCH_CARDS} cards por chamada.`);
  }

  const entries = input.updates.map((entry, index) => {
    const record = asRow(entry);
    if (!record) throw new McpDomainError("invalid_input", `O item ${index + 1} de updates precisa ser um objeto.`);
    return {
      cardId: requireUuid(record.card_id, `updates[${index}].card_id`),
      patch: normalizeCardPatch(record, index),
    };
  });

  const { data: ownedRows, error: ownedError } = await db.client
    .from("flashcards")
    .select("*")
    .eq("list_id", listId)
    .eq("user_id", db.userId)
    .is("deleted_at", null)
    .in("id", entries.map((entry) => entry.cardId));
  if (ownedError) throw toMcpDomainError(ownedError, "Não foi possível validar os flashcards.");
  const ownedById = new Map(
    asRows(ownedRows)
      .map((row) => asRow(row))
      .filter((row): row is Record<string, unknown> => Boolean(row && str(row, "id")))
      .map((row) => [str(row, "id") as string, row]),
  );
  const updatesToApply = entries
    .filter((entry) => ownedById.has(entry.cardId))
    .map((entry) => {
      const current = { ...(ownedById.get(entry.cardId) as Record<string, unknown>) };
      delete current.lists;
      return { ...current, ...entry.patch, id: entry.cardId, list_id: listId, user_id: db.userId };
    });
  let updatedIds: string[] = [];
  if (updatesToApply.length > 0) {
    const { data, error } = await db.client
      .from("flashcards")
      .upsert(updatesToApply, { onConflict: "id", defaultToNull: false })
      .select("id");
    if (error) throw toMcpDomainError(error, "Não foi possível atualizar os flashcards.");
    updatedIds = asRows(data).map((row) => str(asRow(row), "id") ?? "");
  }
  if (updatedIds.length > 0) invalidateScopeInventory(db.userId, listInstitutionId(list));
  return {
    mode: "per_card",
    updated: updatedIds.length,
    not_found: entries.filter((entry) => !updatedIds.includes(entry.cardId)).map((entry) => entry.cardId),
    list: { id: listId, title: str(list, "title") ?? "" },
  };
}

export interface RemoveCardsInput {
  list_id: unknown;
  card_ids: unknown;
  dry_run?: unknown;
  confirmation_token?: unknown;
}

async function countLayersOf(db: UserScopedDb, listId: string, parentIds: string[]): Promise<string[]> {
  if (parentIds.length === 0) return [];
  const { data, error } = await db.client
    .from("flashcards")
    .select("id")
    .eq("list_id", listId)
    .eq("user_id", db.userId)
    .in("parent_card_id", parentIds)
    .is("deleted_at", null);
  if (error) throw toMcpDomainError(error, "Não foi possível listar as camadas dos cards.");
  return asRows(data).map((row) => str(asRow(row), "id") ?? "").filter(Boolean);
}

async function cardRemovalState(db: UserScopedDb, listId: string, cardIds: string[]): Promise<string> {
  const [{ data: principalData, error: principalError }, { data: layerData, error: layerError }] = await Promise.all([
    db.client
      .from("flashcards")
      .select("id,updated_at,deleted_at")
      .eq("list_id", listId)
      .eq("user_id", db.userId)
      .in("id", cardIds),
    db.client
      .from("flashcards")
      .select("id,updated_at,deleted_at")
      .eq("list_id", listId)
      .eq("user_id", db.userId)
      .in("parent_card_id", cardIds),
  ]);
  if (principalError) throw toMcpDomainError(principalError, "Não foi possível verificar o estado dos cards.");
  if (layerError) throw toMcpDomainError(layerError, "Não foi possível verificar o estado das camadas.");
  return confirmationStateFingerprint([
    ...asRows(principalData).map((row) => {
      const record = asRow(row) ?? {};
      return { kind: "card", id: str(record, "id") ?? "", updatedAt: record.updated_at, deletedAt: record.deleted_at };
    }),
    ...asRows(layerData).map((row) => {
      const record = asRow(row) ?? {};
      return { kind: "layer", id: str(record, "id") ?? "", updatedAt: record.updated_at, deletedAt: record.deleted_at };
    }),
  ]);
}

/**
 * Soft delete of cards (never hard delete): the card and its child layers are
 * marked with deleted_at, exactly like the product's own removal flow. Above
 * MAX_REMOVAL_WITHOUT_CONFIRMATION rows the call requires a confirmation token
 * bound to the previewed row count.
 */
export async function removeCards(
  db: UserScopedDb,
  input: RemoveCardsInput,
  key: ConfirmationKey,
): Promise<Record<string, unknown>> {
  const list = await findOwnedList(db, input.list_id);
  const listId = String(list.id);
  const cardIds = requireUuidList(input.card_ids, "card_ids", MAX_BATCH_CARDS);
  const dryRun = input.dry_run === true;

  const { data, error } = await db.client
    .from("flashcards")
    .select("id")
    .eq("list_id", listId)
    .eq("user_id", db.userId)
    .is("deleted_at", null)
    .in("id", cardIds);
  if (error) throw toMcpDomainError(error, "Não foi possível validar os cards informados.");
  const principalIds = asRows(data).map((row) => str(asRow(row), "id") ?? "").filter(Boolean);
  const alreadyRemoved = cardIds.filter((cardId) => !principalIds.includes(cardId));
  const layerIds = await countLayersOf(db, listId, principalIds);
  const total = principalIds.length + layerIds.length;
  const material = total >= MAX_REMOVAL_WITHOUT_CONFIRMATION;
  const removalScope = listInstitutionId(list) ?? "personal";
  const stateFingerprint = dryRun || material ? await cardRemovalState(db, listId, cardIds) : undefined;

  if (dryRun) {
    const claim = {
      action: "remove_cards" as const,
      userId: db.userId,
      objectId: listId,
      scope: removalScope,
      targetIds: cardIds,
      expectedCount: total,
      stateFingerprint,
    };
    const confirmation = await createConfirmationToken(key, claim);
    return {
      dry_run: true,
      list: { id: listId, title: str(list, "title") ?? "" },
      cards_to_remove: principalIds.length,
      layers_to_remove: layerIds.length,
      total_to_remove: total,
      already_removed: alreadyRemoved.length,
      requires_confirmation: material,
      recoverable: true,
      retention_days: TRASH_RETENTION_DAYS,
      ...(material
        ? {
            confirmation_token: confirmation.token,
            expires_at: confirmation.expires_at,
            ttl_seconds: confirmation.ttl_seconds,
          }
        : {}),
    };
  }

  if (material) {
    await verifyConfirmationToken(key, input.confirmation_token, {
      action: "remove_cards",
      userId: db.userId,
      objectId: listId,
      scope: removalScope,
      targetIds: cardIds,
      expectedCount: total,
      stateFingerprint: await cardRemovalState(db, listId, cardIds),
    });
  }

  if (total === 0) {
    return {
      removed_cards: 0,
      removed_layers: 0,
      total_removed: 0,
      already_removed: alreadyRemoved.length,
      note: "Nada a remover: os cards informados já estavam fora da lista ativa.",
    };
  }

  const nowIso = new Date().toISOString();
  const idsToRemove = [...new Set([...principalIds, ...layerIds])];
  const { error: deleteError } = await db.client
    .from("flashcards")
    .update({ deleted_at: nowIso })
    .eq("list_id", listId)
    .eq("user_id", db.userId)
    .is("deleted_at", null)
    .in("id", idsToRemove);
  if (deleteError) throw toMcpDomainError(deleteError, "Não foi possível remover os flashcards e suas camadas.");
  invalidateScopeInventory(db.userId, listInstitutionId(list));

  return {
    removed_cards: principalIds.length,
    removed_layers: layerIds.length,
    total_removed: total,
    already_removed: alreadyRemoved.length,
    recoverable: true,
    retention_days: TRASH_RETENTION_DAYS,
    list: { id: listId, title: str(list, "title") ?? "" },
  };
}
