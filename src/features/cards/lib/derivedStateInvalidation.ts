/**
 * Invalidez de estado derivado do flashcard.
 *
 * Todo cache abaixo depende da identidade do card. Quando cards mudam
 * (exclusao, Delete All, importacao que substitui conteudo), o estado antigo
 * nao pode continuar valido em nenhuma tela.
 */
import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DERIVED_STATE_QUERY_PREFIXES: readonly string[] = [
  "favorites",
  "favorites-count",
  "red-list",
  "special-flashcards",
  "special-flashcards-count",
  "special-flashcards-details",
  "flashcard-review-flags",
  "reinforcement",
  "study-resume",
  "home-data",
  "library",
];

export function invalidateFlashcardDerivedState(queryClient: QueryClient): void {
  for (const prefix of DERIVED_STATE_QUERY_PREFIXES) {
    void queryClient.invalidateQueries({ queryKey: [prefix] });
  }
}

/**
 * Remove do banco as referencias cujo card nao existe mais.
 * Best-effort: enquanto a migration nao estiver aplicada, a funcao nao existe
 * e o cliente segue com a filtragem de leitura.
 */
export async function pruneOrphanFlashcardDerivedState(): Promise<Record<string, number> | null> {
  try {
    const { data, error } = await (supabase as any).rpc("prune_my_orphan_flashcard_derived_state_v1");
    if (error) {
      const code = (error as { code?: string }).code ?? "";
      if (code === "PGRST202" || code === "42883") return null;
      throw error;
    }
    return data && typeof data === "object" ? (data as Record<string, number>) : null;
  } catch (error) {
    console.warn("[derived-state] prune skipped", error);
    return null;
  }
}

/**
 * Caminho unico usado pelos fluxos de exclusao: invalida cache e limpa orfaos.
 */
export async function settleFlashcardDerivedState(queryClient: QueryClient): Promise<void> {
  invalidateFlashcardDerivedState(queryClient);
  await pruneOrphanFlashcardDerivedState();
  invalidateFlashcardDerivedState(queryClient);
}

