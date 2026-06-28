import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export async function loadListCardCatalog(listId: string) {
  const { data, error } = await db
    .from("flashcards")
    .select("term, translation")
    .eq("list_id", listId)
    .is("deleted_at", null);
  if (error) throw error;
  return data ?? [];
}
