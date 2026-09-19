/**
 * Regra de identidade: um card so e referencia valida enquanto existe E esta
 * vivo (deleted_at IS NULL).
 *
 * Cards usam soft delete, entao a FK ON DELETE CASCADE nao dispara no fluxo
 * normal de exclusao. Estado derivado (favoritos, Lista Vermelha, Pontos de
 * atencao, Reforco, progresso) precisa revalidar a existencia do card antes
 * de tratar a referencia como verdadeira.
 */
import { supabase } from "@/integrations/supabase/client";

export interface FlashcardLivenessRow {
  id: string;
  deleted_at?: string | null;
}

/** PostgREST aceita listas longas, mas mantemos o filtro in() em blocos. */
export const LIVENESS_QUERY_CHUNK = 200;

export function chunkIds(ids: readonly string[], size = LIVENESS_QUERY_CHUNK): string[][] {
  const unique = Array.from(new Set(ids.filter((id): id is string => typeof id === "string" && id.length > 0)));
  if (unique.length === 0) return [];
  const step = Math.max(1, Math.floor(size));
  const chunks: string[][] = [];
  for (let index = 0; index < unique.length; index += step) {
    chunks.push(unique.slice(index, index + step));
  }
  return chunks;
}

/**
 * Mantem a ordem recebida e remove todo id sem linha viva correspondente.
 * Um id repetido e devolvido uma unica vez.
 */
export function filterLiveFlashcardIds(
  ids: readonly string[],
  rows: readonly FlashcardLivenessRow[],
): string[] {
  const live = new Set<string>();
  for (const row of rows) {
    if (row && typeof row.id === "string" && row.deleted_at == null) live.add(row.id);
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of ids) {
    if (typeof id !== "string" || !live.has(id) || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

type LivenessClient = {
  from: (table: string) => any;
};

/**
 * Consulta em quais dos ids informados existe um card vivo.
 * Devolve um Set para permitir filtragem local sem nova ida ao banco.
 */
export async function fetchLiveFlashcardIdSet(
  ids: readonly string[],
  client: LivenessClient = supabase as unknown as LivenessClient,
): Promise<Set<string>> {
  const chunks = chunkIds(ids);
  const live = new Set<string>();
  if (chunks.length === 0) return live;

  const pages = await Promise.all(
    chunks.map(async (chunk) => {
      const { data, error } = await client
        .from("flashcards")
        .select("id, deleted_at")
        .in("id", chunk);
      if (error) throw error;
      return (data ?? []) as FlashcardLivenessRow[];
    }),
  );

  for (const page of pages) {
    for (const id of filterLiveFlashcardIds(page.map((row) => row.id), page)) live.add(id);
  }
  return live;
}

/** Conveniencia: devolve os ids de entrada que continuam vivos, na mesma ordem. */
export async function retainLiveFlashcardIds(
  ids: readonly string[],
  client?: LivenessClient,
): Promise<string[]> {
  if (ids.length === 0) return [];
  const live = await fetchLiveFlashcardIdSet(ids, client);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of ids) {
    if (typeof id !== "string" || !live.has(id) || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

