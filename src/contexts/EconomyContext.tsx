import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getEconomyProfile } from "@/lib/rewardEngine";

interface EconomyState {
  balance_pitecoin: number;
  pts_weekly: number;
  xp_total: number;
  level: number;
}

interface EconomyContextValue extends EconomyState {
  refreshBalance: () => Promise<void>;
  updateBalance: (newBalance: number) => void;
  loading: boolean;
}

const EconomyContext = createContext<EconomyContextValue | undefined>(undefined);

export function EconomyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<EconomyState>({
    balance_pitecoin: 0,
    pts_weekly: 0,
    xp_total: 0,
    level: 0,
  });
  const [loading, setLoading] = useState(true);

  const refreshBalance = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const profile = await getEconomyProfile(session.user.id);
      if (profile) {
        setState({
          balance_pitecoin: profile.balance_pitecoin,
          pts_weekly: profile.pts_weekly,
          xp_total: profile.xp_total,
          level: profile.level,
        });
      }
    } catch (error) {
      console.error('[EconomyContext] Error refreshing balance:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateBalance = useCallback((newBalance: number) => {
    setState(prev => ({ ...prev, balance_pitecoin: newBalance }));
  }, []);

  useEffect(() => {
    refreshBalance();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('economy_updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
        },
        async (payload) => {
          const { data: { session } } = await supabase.auth.getSession();
          if (session && payload.new && 'id' in payload.new && payload.new.id === session.user.id) {
            const updates: Partial<EconomyState> = {};
            
            if ('balance_pitecoin' in payload.new) {
              updates.balance_pitecoin = (payload.new as any).balance_pitecoin || 0;
            }
            if ('pts_weekly' in payload.new) {
              updates.pts_weekly = (payload.new as any).pts_weekly || 0;
            }
            
            if (Object.keys(updates).length > 0) {
              setState(prev => ({ ...prev, ...updates }));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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
