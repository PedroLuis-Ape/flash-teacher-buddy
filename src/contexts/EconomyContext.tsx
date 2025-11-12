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
    // Debounce: clear any pending refresh
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    refreshTimeoutRef.current = setTimeout(async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        // Se não há sessão ou erro ao buscar sessão, não continuar
        if (sessionError || !session) {
          console.log('[EconomyContext] No valid session, skipping refresh');
          return;
        }

        // Call HUD summary endpoint for fresh data
        const { data, error } = await supabase.functions.invoke('hud-summary', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        // Se der erro 401 ou 403, tentar renovar o token uma única vez
        if (error && (error.message?.includes('401') || error.message?.includes('403'))) {
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
          
          // Se falhar ao renovar, significa que a sessão está inválida - forçar logout
          if (refreshError || !refreshData.session) {
            console.log('[EconomyContext] Session refresh failed, session invalid');
            await supabase.auth.signOut();
            return;
          }
          
          if (refreshData.session) {
            const { data: retryData, error: retryError } = await supabase.functions.invoke('hud-summary', {
              headers: {
                Authorization: `Bearer ${refreshData.session.access_token}`,
              },
            });
            if (!retryError && retryData?.ok) {
              const { data: profileData } = await supabase
                .from('profiles')
                .select('xp_total, level, current_streak')
                .eq('id', refreshData.session.user.id)
                .single();

              setState(prev => ({
                balance_pitecoin: retryData.ptc || 0,
                pts_weekly: retryData.points || 0,
                xp_total: profileData?.xp_total || prev.xp_total,
                level: profileData?.level || prev.level,
                inventory_count: retryData.inventory_count || 0,
                current_streak: profileData?.current_streak || prev.current_streak,
              }));
              return;
            } else {
              // Se o retry também falhar, logout
              console.log('[EconomyContext] Retry failed, forcing logout');
              await supabase.auth.signOut();
              return;
            }
          }
        }

        if (error) throw error;

        if (data?.ok) {
          // Also fetch XP and level from profiles (not in HUD)
          const { data: profileData } = await supabase
            .from('profiles')
            .select('xp_total, level, current_streak')
            .eq('id', session.user.id)
            .single();

          setState(prev => ({
            balance_pitecoin: data.ptc || 0,
            pts_weekly: data.points || 0,
            xp_total: profileData?.xp_total || prev.xp_total,
            level: profileData?.level || prev.level,
            inventory_count: data.inventory_count || 0,
            current_streak: profileData?.current_streak || prev.current_streak,
          }));
        }
      } catch (error) {
        console.error('[EconomyContext] Error refreshing balance:', error);
      }
    }, 300); // 300ms debounce
  }, []);

  const updateBalance = useCallback((newBalance: number) => {
    setState(prev => ({ ...prev, balance_pitecoin: newBalance }));
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadInitialData = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        // Se não há sessão ou erro ao buscar, não continuar
        if (sessionError || !session || !mounted) {
          console.log('[EconomyContext] No valid session on init, skipping');
          setLoading(false);
          return;
        }

        // Call HUD summary endpoint
        const { data, error } = await supabase.functions.invoke('hud-summary', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        // Se der erro 401 ou 403, tentar renovar o token uma única vez
        if (error && (error.message?.includes('401') || error.message?.includes('403'))) {
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
          
          // Se falhar ao renovar, significa que a sessão está inválida - forçar logout
          if (refreshError || !refreshData.session) {
            console.log('[EconomyContext] Session refresh failed on init, forcing logout');
            await supabase.auth.signOut();
            return;
          }
          
          if (refreshData.session && mounted) {
            const { data: retryData, error: retryError } = await supabase.functions.invoke('hud-summary', {
              headers: {
                Authorization: `Bearer ${refreshData.session.access_token}`,
              },
            });
            if (!retryError && retryData?.ok) {
              const { data: profileData } = await supabase
                .from('profiles')
                .select('xp_total, level, current_streak')
                .eq('id', refreshData.session.user.id)
                .single();

              setState({
                balance_pitecoin: retryData.ptc || 0,
                pts_weekly: retryData.points || 0,
                xp_total: profileData?.xp_total || 0,
                level: profileData?.level || 0,
                inventory_count: retryData.inventory_count || 0,
                current_streak: profileData?.current_streak || 0,
              });
              return;
            } else {
              // Se o retry também falhar, logout
              console.log('[EconomyContext] Retry failed on init, forcing logout');
              await supabase.auth.signOut();
              return;
            }
          }
        }

        if (error) throw error;

        if (data?.ok && mounted) {
          // Also fetch XP, level and streak from profiles (not in HUD)
          const { data: profileData } = await supabase
            .from('profiles')
            .select('xp_total, level, current_streak')
            .eq('id', session.user.id)
            .single();

          setState({
            balance_pitecoin: data.ptc || 0,
            pts_weekly: data.points || 0,
            xp_total: profileData?.xp_total || 0,
            level: profileData?.level || 0,
            inventory_count: data.inventory_count || 0,
            current_streak: profileData?.current_streak || 0,
          });
        }
      } catch (error) {
        console.error('[EconomyContext] Error loading initial data:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadInitialData();

    // Subscribe to realtime changes on profiles
    const channel = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
        },
        (payload) => {
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
        }
      )
      .subscribe();

    // Listen to visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshBalance();
      }
    };

    // Listen to online event
    const handleOnline = () => {
      refreshBalance();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    return () => {
      mounted = false;
      channel.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
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
