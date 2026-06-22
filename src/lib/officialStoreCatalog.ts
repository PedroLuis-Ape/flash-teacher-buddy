import { supabase } from "@/integrations/supabase/client";
import type { SkinItem } from "./storeEngine";

export const OFFICIAL_PITECO_PACKAGE_SLUGS = [
  "piteco_prime",
  "piteco_vampiro",
  "piteco_zombie",
  "piteco_ninja",
  "piteco_astronauta",
  "piteco_explorador",
] as const;

export async function getOfficialPitecoPackages(): Promise<SkinItem[]> {
  const { data, error } = await supabase
    .from("public_catalog")
    .select("*")
    .eq("is_active", true)
    .eq("approved", true)
    .eq("status", "published")
    .eq("type", "bundle")
    .in("slug", [...OFFICIAL_PITECO_PACKAGE_SLUGS])
    .order("price_pitecoin", { ascending: true });

  if (error) {
    console.error("[OfficialStoreCatalog] Error fetching packages:", error);
    return [];
  }

  return (data || []).filter(item => item.avatar_final && item.card_final) as SkinItem[];
}
