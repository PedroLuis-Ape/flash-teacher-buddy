import { supabase } from "@/integrations/supabase/client";

type ListWithPrimarySide = { primary_side?: string };

export async function loadListPrimarySide(listId: string): Promise<"a" | "b"> {
  const result = await supabase.from("lists").select("*").eq("id", listId).maybeSingle();
  if (result.error) throw result.error;
  return (result.data as ListWithPrimarySide | null)?.primary_side === "b" ? "b" : "a";
}
