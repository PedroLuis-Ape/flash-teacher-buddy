import { supabase } from "@/integrations/supabase/client";

type PublicConfig = { primary_side?: string };

export async function loadPublicListPrimarySide(listId: string): Promise<"a" | "b"> {
  const result = await supabase.rpc("get_portal_list_study_config" as never, { _list_id: listId } as never);
  if (result.error) throw result.error;
  const row = (Array.isArray(result.data) ? result.data[0] : result.data) as PublicConfig | null;
  return row?.primary_side === "b" ? "b" : "a";
}
