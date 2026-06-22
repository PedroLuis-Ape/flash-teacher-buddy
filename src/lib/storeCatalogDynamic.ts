import { supabase } from "@/integrations/supabase/client";
import type { SkinItem } from "./storeEngine";

/**
 * Dynamic store catalog.
 *
 * The Supabase catalog is the source of truth. Adding or archiving packages no
 * longer requires a frontend whitelist change.
 */
export async function getDynamicStoreCatalog(): Promise<SkinItem[]> {
  const { data, error } = await supabase
    .from("public_catalog")
    .select("*")
    .eq("is_active", true)
    .eq("approved", true)
    .order("price_pitecoin", { ascending: true });

  if (error) throw error;

  return (data || []).filter(
    (item: any) => Boolean(item.avatar_final && item.card_final),
  ) as SkinItem[];
}
