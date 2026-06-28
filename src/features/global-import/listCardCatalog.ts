import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export async function loadListCardCatalog(
  listId: string,
): Promise<Array<{ term: string; translation: string }>> {
  const { data, error } = await db
    .from("flashcards")
    .select("term, translation")
    .eq("list_id", listId)
    .is("deleted_at", null);
  if (error) throw error;

  return (data ?? []).map((card: { term?: string | null; translation?: string | null }) => ({
    term: card.term ?? "",
    translation: card.translation ?? "",
  }));
}
