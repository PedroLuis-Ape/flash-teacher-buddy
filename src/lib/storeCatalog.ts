import { supabase } from "@/integrations/supabase/client";
import type { SkinItem } from "./storeEngine";

/**
 * Loads every complete package that is currently published in Supabase.
 * Adding or archiving packages no longer requires a frontend whitelist change.
 */
export async function getStoreCatalog(): Promise<SkinItem[]> {
  try {
    const { data, error } = await supabase
      .from("public_catalog")
      .select("*")
      .eq("is_active", true)
      .eq("approved", true)
      .eq("status", "published")
      .eq("type", "bundle")
      .order("price_pitecoin", { ascending: true });

    if (error) throw error;

    return (data || []).filter(
      item => Boolean(item.avatar_final && item.card_final),
    ) as SkinItem[];
  } catch (error) {
    console.error("[StoreCatalog] Error loading published packages:", error);
    return [];
  }
}
