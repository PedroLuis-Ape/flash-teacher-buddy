import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// Rotas públicas que não exigem sessão
const PUBLIC_PREFIXES = ["/auth", "/portal"] as const;

function isProtectedPath(pathname: string) {
  return !PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export function SessionWatcher() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

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
      
      // Configurar refresh automático do token a cada 50 minutos (tokens expiram em 1h)
      if (session) {
        refreshInterval = setInterval(async () => {
          const { error } = await supabase.auth.refreshSession();
          if (error) {
            console.error('[SessionWatcher] Token refresh failed:', error);
          }
        }, 50 * 60 * 1000); // 50 minutos
      }
    });

    // 2) Listener único de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Marca o primeiro evento e libera a guarda quando combinado com o getSession
      if (!gotFirstAuthEvent) {
        gotFirstAuthEvent = true;
        maybeSetReady();
      }

      // Ao logar novamente, limpar a flag de logout e sair de /auth rapidamente
      if (event === 'SIGNED_IN') {
        sessionStorage.removeItem('logoutInProgress');
        if (window.location.pathname.startsWith('/auth')) {
          navigate('/', { replace: true });
        }
      }

      // Fluxo de logout explícito: limpar apenas dados de sessão, não localStorage inteiro
      if (event === 'SIGNED_OUT') {
        try {
          // Sinaliza logout em progresso
          sessionStorage.setItem('logoutInProgress', String(Date.now()));
          // NÃO limpar localStorage.clear() - isso remove a sessão persistida!
          // Apenas limpar chaves específicas do app se necessário
          sessionStorage.removeItem('returnTo');
          sessionStorage.setItem('authReady', '0');
        } catch (e) {
          // ignore
        }
        navigate('/auth', { replace: true });
        return;
      }
      
      // Token expirado ou sessão revogada remotamente
      if (event === 'TOKEN_REFRESHED' && !session) {
        console.log('[SessionWatcher] Token refresh failed, session lost');
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
  }, [navigate]);

  return null;
}
