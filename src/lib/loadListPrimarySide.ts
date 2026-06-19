import { supabase } from "@/integrations/supabase/client";

export async function loadListPrimarySide(listId: string): Promise<"a" | "b"> {
  const result = await supabase.from("lists").select("primary_side").eq("id", listId).maybeSingle();
  return (result.data as { primary_side?: string } | null)?.primary_side === "b" ? "b" : "a";
}
