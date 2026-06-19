import { supabase } from "@/integrations/supabase/client";
export async function loadPublicSide(id: string): Promise<"a" | "b"> { const r = await supabase.rpc("get_portal_list_study_config" as never, { _list_id: id } as never); const x = r.data as { primary_side?: string } | null; return x?.primary_side === "b" ? "b" : "a"; }
