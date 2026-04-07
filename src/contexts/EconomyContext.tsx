import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

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

  const refreshBalance = useCallback(async () => {
    // If economy has failed too many times in a row, stop retrying automatically
    // to prevent background noise. User can still trigger manually.
    if (consecutiveFailures.current >= 5) return;

    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);

    refreshTimeoutRef.current = setTimeout(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data, error } = await fetchHudSummary(session.access_token);

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

  useEffect(() => {
    let mounted = true;

    const loadInitialData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || !mounted) {
          setLoading(false);
          return;
        }

        const { data, error } = await fetchHudSummary(session.access_token);

        if (error) {
          // Economy init failure is non-fatal — log and continue with defaults
          console.warn('[EconomyContext] Initial HUD load failed:', error.message);
          return;
        }

        if (data?.ok && mounted) setState(hudToState(data));
      } catch (error) {
        // Swallow — economy must never crash the app
        console.warn('[EconomyContext] Error loading initial data:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadInitialData();

    // Realtime subscription — set up only after initial load settles
    let channel: ReturnType<typeof supabase.channel> | null = null;

    supabase.auth.getSession().then(({ data: { session: initSession } }) => {
      if (!initSession || !mounted) return;
      try {
        channel = supabase
          .channel(`profile-${initSession.user.id}`)
          .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${initSession.user.id}`,
          }, (payload) => {
            if (mounted && payload.new) {
              setState(prev => ({
                ...prev,
                balance_pitecoin: payload.new.balance_pitecoin || 0,
                pts_weekly: payload.new.pts_weekly || 0,
                xp_total: payload.new.xp_total || 0,
                level: payload.new.level || 0,
                current_streak: payload.new.current_streak || 0,
              }));
            }
          })
          .subscribe((status) => {
            if (status === 'CHANNEL_ERROR') {
              console.warn('[EconomyContext] Realtime channel error — degrading gracefully');
            }
          });
      } catch (e) {
        console.warn('[EconomyContext] Realtime setup failed:', e);
        // Non-fatal — app works without realtime economy updates
      }
    }).catch(() => {
      // Swallow — if we can't even check session for realtime, just skip it
    });

    // Debounce visibility refresh
    let visibilityTimer: NodeJS.Timeout | null = null;
    const handleVisibilityChange = () => {
      if (visibilityTimer) clearTimeout(visibilityTimer);
      if (document.visibilityState === 'visible') {
        visibilityTimer = setTimeout(() => refreshBalance(), 2000);
      }
    };
    const handleOnline = () => {
      // Reset failure counter when network comes back
      consecutiveFailures.current = 0;
      refreshBalance();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    return () => {
      mounted = false;
      try { if (channel) channel.unsubscribe(); } catch {}
      if (visibilityTimer) clearTimeout(visibilityTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    };
  }, [refreshBalance]);

  return (
    <EconomyContext.Provider value={{ ...state, refreshBalance, updateBalance, loading }}>
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
