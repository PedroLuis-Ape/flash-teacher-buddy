import { supabase } from "@/integrations/supabase/client";

export interface EconomyState {
  balance_pitecoin: number; pts_weekly: number; xp_total: number;
  level: number; inventory_count: number; current_streak: number;
}
export const INITIAL_ECONOMY: EconomyState = {
  balance_pitecoin: 0, pts_weekly: 0, xp_total: 0,
  level: 0, inventory_count: 0, current_streak: 0,
};

export async function fetchEconomyState(): Promise<EconomyState> {
  const [{ data: p, error: pe }, { count, error: ie }] = await Promise.all([
    (supabase as any).rpc("ensure_piteco_profile"),
    supabase.from("user_inventory").select("id", { count: "exact", head: true }),
  ]);
  if (pe || ie || !p?.success) throw pe ?? ie ?? new Error("PROFILE_UNAVAILABLE");
  return {
    balance_pitecoin: Number(p.balance_pitecoin ?? 0),
    pts_weekly: Number(p.pts_weekly ?? 0), xp_total: Number(p.xp_total ?? 0),
    level: Number(p.level ?? 0), inventory_count: count ?? 0,
    current_streak: Number(p.current_streak ?? 0),
  };
}
