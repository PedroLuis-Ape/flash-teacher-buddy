import { supabase } from "@/integrations/supabase/client";

export interface EmbeddedMutationCounts {
  requested?: number;
  added?: number;
  already_present?: number;
  removed?: number;
}

export interface CreateEmbeddedListResult extends EmbeddedMutationCounts {
  list_id: string;
}

export interface EmbeddedListMember {
  flashcard_id: string;
  term: string;
  definition: string;
  source_list_id: string;
  source_list_title: string;
  embedded_at: string;
}

async function callRpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase.rpc as any)(name, args);
  if (error) throw error;
  return data as T;
}

export async function createEmbeddedList(input: {
  folderId: string;
  title: string;
  description?: string;
  sourceListIds: string[];
}): Promise<CreateEmbeddedListResult> {
  return callRpc<CreateEmbeddedListResult>("create_embedded_list", {
    _folder_id: input.folderId,
    _title: input.title,
    _description: input.description ?? "",
    _source_list_ids: input.sourceListIds,
  });
}

export async function embedSourceLists(
  embeddedListId: string,
  sourceListIds: string[],
): Promise<EmbeddedMutationCounts> {
  return callRpc<EmbeddedMutationCounts>("embed_source_lists", {
    _embedded_list_id: embeddedListId,
    _source_list_ids: sourceListIds,
  });
}

export async function embedCards(
  embeddedListId: string,
  flashcardIds: string[],
): Promise<EmbeddedMutationCounts> {
  return callRpc<EmbeddedMutationCounts>("embed_cards", {
    _embedded_list_id: embeddedListId,
    _flashcard_ids: flashcardIds,
  });
}

export async function unembedCards(
  embeddedListId: string,
  flashcardIds: string[],
): Promise<EmbeddedMutationCounts> {
  return callRpc<EmbeddedMutationCounts>("unembed_cards", {
    _embedded_list_id: embeddedListId,
    _flashcard_ids: flashcardIds,
  });
}

export async function unembedSourceList(
  embeddedListId: string,
  sourceListId: string,
): Promise<EmbeddedMutationCounts> {
  return callRpc<EmbeddedMutationCounts>("unembed_source_list", {
    _embedded_list_id: embeddedListId,
    _source_list_id: sourceListId,
  });
}

export async function clearEmbeddedList(
  embeddedListId: string,
): Promise<EmbeddedMutationCounts> {
  return callRpc<EmbeddedMutationCounts>("clear_embedded_list", {
    _embedded_list_id: embeddedListId,
  });
}

export async function fetchEmbeddedListMembers(
  embeddedListId: string,
): Promise<EmbeddedListMember[]> {
  const data = await callRpc<EmbeddedListMember[]>("get_embedded_list_members", {
    _embedded_list_id: embeddedListId,
  });
  return Array.isArray(data) ? data : [];
}

export function formatEmbeddedMutationMessage(result: EmbeddedMutationCounts): string {
  if (typeof result.removed === "number") {
    return `${result.removed} ${result.removed === 1 ? "card removido" : "cards removidos"} da lista combinada.`;
  }
  const added = result.added ?? 0;
  const already = result.already_present ?? 0;
  return already > 0
    ? `${added} adicionados; ${already} já estavam na lista combinada.`
    : `${added} ${added === 1 ? "card incorporado" : "cards incorporados"}.`;
}
