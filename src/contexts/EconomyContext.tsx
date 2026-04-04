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

export function EconomyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<EconomyState>({
    balance_pitecoin: 0,
    pts_weekly: 0,
    xp_total: 0,
    level: 0,
    inventory_count: 0,
    current_streak: 0,
  });
  const [loading, setLoading] = useState(true);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const refreshBalance = useCallback(async () => {
    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);

    refreshTimeoutRef.current = setTimeout(async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) return;

        const { data, error } = await fetchHudSummary(session.access_token);

        if (error && (error.message?.includes('401') || error.message?.includes('403'))) {
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError || !refreshData.session) {
            await supabase.auth.signOut();
            return;
          }
          const { data: retryData, error: retryError } = await fetchHudSummary(refreshData.session.access_token);
          if (!retryError && retryData?.ok) {
            setState(hudToState(retryData));
          } else {
            await supabase.auth.signOut();
          }
          return;
        }

        if (error) throw error;
        if (data?.ok) setState(hudToState(data));
      } catch (error) {
        console.error('[EconomyContext] Error refreshing balance:', error);
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
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session || !mounted) {
          setLoading(false);
          return;
        }

        const { data, error } = await fetchHudSummary(session.access_token);

        if (error && (error.message?.includes('401') || error.message?.includes('403'))) {
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError || !refreshData.session) {
            await supabase.auth.signOut();
            return;
          }
          if (refreshData.session && mounted) {
            const { data: retryData, error: retryError } = await fetchHudSummary(refreshData.session.access_token);
            if (!retryError && retryData?.ok) {
              setState(hudToState(retryData));
            } else {
              await supabase.auth.signOut();
            }
          }
          return;
        }

        if (error) throw error;
        if (data?.ok && mounted) setState(hudToState(data));
      } catch (error) {
        console.error('[EconomyContext] Error loading initial data:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadInitialData();

    // Only subscribe to realtime profile changes if we have a user session
    let channel: ReturnType<typeof supabase.channel> | null = null;

    supabase.auth.getSession().then(({ data: { session: initSession } }) => {
      if (!initSession || !mounted) return;
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
        .subscribe();
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshBalance();
    };
    const handleOnline = () => refreshBalance();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    return () => {
      mounted = false;
      channel.unsubscribe();
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
