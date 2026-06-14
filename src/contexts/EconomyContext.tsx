import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface EconomyState {
  balance_pitecoin: number;
  pts_weekly: number;
  xp_total: number;
  level: number;
  inventory_count: number;
  current_streak: number;
}

interface EconomyContextValue extends EconomyState {
  refreshBalance: () => Promise<void>;
  updateBalance: (newBalance: number) => void;
  loading: boolean;
}

const EconomyContext = createContext<EconomyContextValue | undefined>(undefined);

const INITIAL_STATE: EconomyState = {
  balance_pitecoin: 0,
  pts_weekly: 0,
  xp_total: 0,
  level: 0,
  inventory_count: 0,
  current_streak: 0,
};

/** Helper: call hud-summary with a given access token */
async function fetchHudSummary(accessToken: string) {
  return supabase.functions.invoke('hud-summary', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

/** Map HUD response to EconomyState (no extra profile query needed) */
function hudToState(data: any): EconomyState {
  return {
    balance_pitecoin: data.ptc || 0,
    pts_weekly: data.points || 0,
    xp_total: data.xp_total || 0,
    level: data.level || 0,
    inventory_count: data.inventory_count || 0,
    current_streak: data.current_streak || 0,
  };
}

/**
 * CRITICAL CHANGE: Economy failures NEVER call signOut().
 * Economy is a secondary layer — it degrades gracefully without
 * poisoning the entire app or forcing the user out.
 */
export function EconomyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<EconomyState>(INITIAL_STATE);
  const [loading, setLoading] = useState(true);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const consecutiveFailures = useRef(0);
  const { userId, accessToken, status } = useAuth();
  const accessTokenRef = useRef<string | undefined>(accessToken);
  useEffect(() => { accessTokenRef.current = accessToken; }, [accessToken]);

  const refreshBalance = useCallback(async () => {
    // If economy has failed too many times in a row, stop retrying automatically
    // to prevent background noise. User can still trigger manually.
    if (consecutiveFailures.current >= 5) return;

    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);

    refreshTimeoutRef.current = setTimeout(async () => {
      const token = accessTokenRef.current;
      if (!token) return;
      try {
        const { data, error } = await fetchHudSummary(token);

        if (error) {
          consecutiveFailures.current++;
          console.warn('[EconomyContext] HUD refresh failed (attempt', consecutiveFailures.current, '):', error.message);
          // DO NOT signOut — economy failure is not an auth failure
          return;
        }

        if (data?.ok) {
          setState(hudToState(data));
          consecutiveFailures.current = 0; // reset on success
        }
      } catch (error) {
        consecutiveFailures.current++;
        console.warn('[EconomyContext] Error refreshing balance:', error);
        // Graceful degradation — keep last known state, do NOT signOut
      }
    }, 300);
  }, []);

  const updateBalance = useCallback((newBalance: number) => {
    setState(prev => ({ ...prev, balance_pitecoin: newBalance }));
  }, []);

  // Initial HUD load + realtime channel — driven by the canonical auth state.
  // No extra getSession() / onAuthStateChange here.
  useEffect(() => {
    if (status === "initializing") return;

    if (!userId || !accessToken) {
      // Anonymous: reset to defaults and stop loading.
      setState(INITIAL_STATE);
      consecutiveFailures.current = 0;
      setLoading(false);
      return;
    }

    let mounted = true;
    const ac = new AbortController();

    (async () => {
      try {
        const { data, error } = await fetchHudSummary(accessToken);
        if (!mounted || ac.signal.aborted) return;
        if (error) {
          console.warn('[EconomyContext] Initial HUD load failed:', error.message);
          return;
        }
        if (data?.ok) setState(hudToState(data));
      } catch (e) {
        console.warn('[EconomyContext] Error loading initial data:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    // One realtime channel per userId, torn down on user change / logout.
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(`profile-${userId}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        }, (payload) => {
          if (!mounted || !payload.new) return;
          setState(prev => ({
            ...prev,
            balance_pitecoin: payload.new.balance_pitecoin || 0,
            pts_weekly: payload.new.pts_weekly || 0,
            xp_total: payload.new.xp_total || 0,
            level: payload.new.level || 0,
            current_streak: payload.new.current_streak || 0,
          }));
        })
        .subscribe((chStatus) => {
          if (chStatus === 'CHANNEL_ERROR') {
            console.warn('[EconomyContext] Realtime channel error — degrading gracefully');
          }
        });
    } catch (e) {
      console.warn('[EconomyContext] Realtime setup failed:', e);
    }

    let visibilityTimer: NodeJS.Timeout | null = null;
    const handleVisibilityChange = () => {
      if (visibilityTimer) clearTimeout(visibilityTimer);
      if (document.visibilityState === 'visible') {
        visibilityTimer = setTimeout(() => refreshBalance(), 2000);
      }
    };
    const handleOnline = () => {
      consecutiveFailures.current = 0;
      refreshBalance();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    return () => {
      mounted = false;
      ac.abort();
      try { if (channel) channel.unsubscribe(); } catch {}
      if (visibilityTimer) clearTimeout(visibilityTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    };
  }, [status, userId, accessToken, refreshBalance]);

  const contextValue = useMemo(() => ({
    ...state, refreshBalance, updateBalance, loading,
  }), [state, refreshBalance, updateBalance, loading]);

  return (
    <EconomyContext.Provider value={contextValue}>
      {children}
    </EconomyContext.Provider>
  );
}

export function useEconomy() {
  const context = useContext(EconomyContext);
  if (!context) {
    throw new Error('useEconomy must be used within EconomyProvider');
  }
  return context;
}
