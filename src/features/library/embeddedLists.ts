import { supabase } from "@/integrations/supabase/client";
import { fetchAllSupabaseRows } from "@/lib/fetchAllSupabaseRows";

/**
 * Listas combinadas ("embedded lists").
 *
 * A pertinência é sempre por referência: embedded_list_id -> flashcard_id.
 * Nenhuma função deste módulo apaga, move ou reescreve um flashcard original —
 * "remover da lista combinada" apaga apenas a linha de pertinência.
 */

export type EmbeddedListState = "embedded" | "normal" | "unknown";

export interface EmbedCountsResult {
  requested: number;
  added: number;
  already_present: number;
}

export interface CreateEmbeddedListResult extends EmbedCountsResult {
  list_id: string;
}

export interface EmbeddedListMember {
  flashcard_id: string;
  source_list_id: string | null;
  source_list_title: string | null;
  source_reference_id: string | null;
  embedded_at: string;
  term: string | null;
  translation: string | null;
  is_playable: boolean;
}

const stateCache = new Map<string, "embedded" | "normal">();

/** Apenas para testes: limpa a memória de classificação. */
export function clearEmbeddedListStateCache(): void {
  stateCache.clear();
}

function rpc(name: string, args: Record<string, unknown>) {
  return (supabase.rpc as unknown as (
    fn: string,
    params: Record<string, unknown>,
  ) => any)(name, args);
}

function first<T>(data: unknown): T | null {
  if (Array.isArray(data)) return (data[0] ?? null) as T | null;
  return (data ?? null) as T | null;
}

function countsOf(data: unknown): EmbedCountsResult {
  const row = first<Partial<EmbedCountsResult>>(data) ?? {};
  return {
    requested: Number(row.requested ?? 0),
    added: Number(row.added ?? 0),
    already_present: Number(row.already_present ?? 0),
  };
}

/**
 * Classifica uma lista privada. Nunca transforma erro em "normal": um erro
 * devolve "unknown" para que a camada de estudo não declare zero cards.
 */
export async function resolveListEmbeddedState(
  listId: string,
  signal?: AbortSignal,
): Promise<EmbeddedListState> {
  if (!listId) return "unknown";
  const cached = stateCache.get(listId);
  if (cached) return cached;

  let query = (supabase.from as any)("embedded_lists")
    .select("list_id")
    .eq("list_id", listId);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query.maybeSingle();

  if (error) return "unknown";
  const state: "embedded" | "normal" = data?.list_id ? "embedded" : "normal";
  stateCache.set(listId, state);
  return state;
}

export async function createEmbeddedList(input: {
  folderId: string;
  title: string;
  description?: string | null;
  sourceListIds: string[];
}): Promise<CreateEmbeddedListResult> {
  const { data, error } = await rpc("create_embedded_list", {
    _folder_id: input.folderId,
    _title: input.title,
    _description: input.description ?? null,
    _source_list_ids: input.sourceListIds,
  });
  if (error) throw error;
  const row = first<{ list_id: string }>(data);
  if (!row?.list_id) throw new Error("Não foi possível criar a lista combinada.");
  stateCache.set(row.list_id, "embedded");
  return { list_id: row.list_id, ...countsOf(data) };
}

export async function embedSourceLists(
  embeddedListId: string,
  sourceListIds: string[],
): Promise<EmbedCountsResult> {
  const { data, error } = await rpc("embed_source_lists", {
    _embedded_list_id: embeddedListId,
    _source_list_ids: sourceListIds,
  });
  if (error) throw error;
  return countsOf(data);
}

export async function embedCards(
  embeddedListId: string,
  flashcardIds: string[],
): Promise<EmbedCountsResult> {
  const { data, error } = await rpc("embed_cards", {
    _embedded_list_id: embeddedListId,
    _flashcard_ids: flashcardIds,
  });
  if (error) throw error;
  return countsOf(data);
}

/** Remove apenas a pertinência dos cards indicados. */
export async function unembedCards(
  embeddedListId: string,
  flashcardIds: string[],
): Promise<{ requested: number; removed: number }> {
  const { data, error } = await rpc("unembed_cards", {
    _embedded_list_id: embeddedListId,
    _flashcard_ids: flashcardIds,
  });
  if (error) throw error;
  const row = first<{ requested?: number; removed?: number }>(data) ?? {};
  return { requested: Number(row.requested ?? 0), removed: Number(row.removed ?? 0) };
}

/** Remove apenas a pertinência dos cards vindos de uma fonte. */
export async function unembedSourceList(
  embeddedListId: string,
  sourceListId: string,
): Promise<{ removed: number }> {
  const { data, error } = await rpc("unembed_source_list", {
    _embedded_list_id: embeddedListId,
    _source_list_id: sourceListId,
  });
  if (error) throw error;
  const row = first<{ removed?: number }>(data) ?? {};
  return { removed: Number(row.removed ?? 0) };
}

/** Esvazia a lista combinada; os cards originais continuam intactos. */
export async function clearEmbeddedList(
  embeddedListId: string,
): Promise<{ removed: number }> {
  const { data, error } = await rpc("clear_embedded_list", {
    _embedded_list_id: embeddedListId,
  });
  if (error) throw error;
  const row = first<{ removed?: number }>(data) ?? {};
  return { removed: Number(row.removed ?? 0) };
}

/**
 * Carrega TODOS os membros da lista combinada.
 *
 * `get_embedded_list_members` retorna SETOF e portanto continua sujeito ao
 * limite de linhas do PostgREST/Supabase quando chamado uma única vez. Como a
 * UI agrupa as fontes a partir destes membros, um corte em 1.000 linhas fazia
 * fontes posteriores simplesmente desaparecerem do gerenciamento. Paginar o
 * RPC preserva a ordenação estável definida pela função SQL e elimina esse
 * falso subconjunto.
 */
export async function fetchEmbeddedListMembers(
  embeddedListId: string,
): Promise<EmbeddedListMember[]> {
  return fetchAllSupabaseRows<EmbeddedListMember>((from, to) =>
    rpc("get_embedded_list_members", {
      _embedded_list_id: embeddedListId,
    }).range(from, to),
  );
}
