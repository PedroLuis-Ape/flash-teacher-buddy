import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fetchEconomyState, INITIAL_ECONOMY, type EconomyState } from "@/lib/economyData";

type Value = EconomyState & {
  refreshBalance: () => Promise<void>; updateBalance: (value: number) => void; loading: boolean;
};
const Context = createContext<Value | undefined>(undefined);

export function EconomyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(INITIAL_ECONOMY);
  const [loading, setLoading] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failures = useRef(0);
  const { userId, status } = useAuth();

  const load = useCallback(async () => {
    if (!userId) return;
    try { setState(await fetchEconomyState()); failures.current = 0; }
    catch (error) { failures.current++; console.warn("[EconomyContext]", error); }
  }, [userId]);

  const refreshBalance = useCallback(async () => {
    if (!userId || failures.current >= 5) return;
    if (timer.current) clearTimeout(timer.current);
    await new Promise<void>((done) => {
      timer.current = setTimeout(() => { void load().finally(done); }, 250);
    });
  }, [load, userId]);

  const updateBalance = useCallback((balance_pitecoin: number) => {
    setState((old) => ({ ...old, balance_pitecoin }));
  }, []);

  useEffect(() => {
    if (status === "initializing") return;
    if (!userId) { setState(INITIAL_ECONOMY); failures.current = 0; setLoading(false); return; }
    let alive = true;
    void load().finally(() => { if (alive) setLoading(false); });

    const channel = supabase.channel(`economy-${userId}`).on("postgres_changes", {
      event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}`,
    }, ({ new: row }) => {
      if (!alive || !row) return;
      setState((old) => ({ ...old,
        balance_pitecoin: Number(row.balance_pitecoin ?? 0), pts_weekly: Number(row.pts_weekly ?? 0),
        xp_total: Number(row.xp_total ?? 0), level: Number(row.level ?? 0),
        current_streak: Number(row.current_streak ?? 0),
      }));
    }).subscribe();

    const refresh = () => { failures.current = 0; void refreshBalance(); };
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("online", refresh);
    window.addEventListener("pitecoin:changed", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      alive = false; void channel.unsubscribe();
      window.removeEventListener("online", refresh);
      window.removeEventListener("pitecoin:changed", refresh);
      document.removeEventListener("visibilitychange", visible);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [load, refreshBalance, status, userId]);

  const value = useMemo(() => ({ ...state, refreshBalance, updateBalance, loading }),
    [loading, refreshBalance, state, updateBalance]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useEconomy() {
  const value = useContext(Context);
  if (!value) throw new Error("useEconomy must be used within EconomyProvider");
  return value;
}
