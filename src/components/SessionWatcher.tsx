import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

// Rotas públicas que não exigem sessão
const PUBLIC_PREFIXES = ["/auth", "/portal"] as const;

function isProtectedPath(pathname: string) {
  return !PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export function SessionWatcher() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const queryClient = useQueryClient();

  useEffect(() => {
    let mounted = true;
    let refreshInterval: NodeJS.Timeout;

    // Flags globais de controle no escopo do efeito
    sessionStorage.setItem('authReady', '0');
    let gotInitialSession = false;
    let gotFirstAuthEvent = false;

    const maybeSetReady = () => {
      if (gotInitialSession || gotFirstAuthEvent) {
        sessionStorage.setItem('authReady', '1');
      }
    };

    // 1) Verificação inicial e configuração de refresh automático
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      gotInitialSession = true;
      maybeSetReady();
      
      if (session) {
        refreshInterval = setInterval(async () => {
          try {
            const { error } = await supabase.auth.refreshSession();
            if (error) {
              console.warn('[SessionWatcher] Token refresh failed:', error.message);
              // Don't redirect — Supabase client retries automatically
            }
          } catch (e) {
            console.warn('[SessionWatcher] Token refresh exception:', e);
          }
        }, 10 * 60 * 1000); // 10 min
      }
    }).catch(err => {
      console.warn('[SessionWatcher] getSession error:', err);
      gotInitialSession = true;
      maybeSetReady();
    });

    // 2) Listener único de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!gotFirstAuthEvent) {
        gotFirstAuthEvent = true;
        maybeSetReady();
      }

      if (event === 'SIGNED_IN') {
        sessionStorage.removeItem('logoutInProgress');
        // Invalidate auth-user query so useAuthUser picks up the new session
        queryClient.invalidateQueries({ queryKey: ['auth-user'] });
        if (window.location.pathname.startsWith('/auth')) {
          navigate('/', { replace: true });
        }
      }

      if (event === 'SIGNED_OUT') {
        try {
          sessionStorage.setItem('logoutInProgress', String(Date.now()));
          sessionStorage.removeItem('returnTo');
          sessionStorage.setItem('authReady', '0');
        } catch { /* ignore */ }
        // Clear all queries on logout so stale data doesn't persist
        queryClient.clear();
        navigate('/auth', { replace: true });
        return;
      }
      
      if (event === 'TOKEN_REFRESHED' && !session) {
        console.warn('[SessionWatcher] Token refresh lost session');
        navigate('/auth', { replace: true });
        return;
      }

      // Guarda de rotas após inicialização completa
      const authReady = sessionStorage.getItem('authReady') === '1';
      if (authReady && !session && isProtectedPath(window.location.pathname)) {
        navigate('/auth', { replace: true });
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      if (refreshInterval) clearInterval(refreshInterval);
    };
  }, [navigate, queryClient]);

  return null;
}
