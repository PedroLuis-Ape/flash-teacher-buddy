import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// Rotas públicas que não exigem sessão
const PUBLIC_PREFIXES = ["/auth", "/portal", "/share"] as const;

function isProtectedPath(pathname: string) {
  return !PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export function SessionWatcher() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    let mounted = true;

    // Flags globais de controle no escopo do efeito
    sessionStorage.setItem('authReady', '0');
    let gotInitialSession = false;
    let gotFirstAuthEvent = false;

    const maybeSetReady = () => {
      if (gotInitialSession || gotFirstAuthEvent) {
        sessionStorage.setItem('authReady', '1');
      }
    };

    // 1) Verificação inicial (sem redirecionar ainda)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      gotInitialSession = true;
      maybeSetReady();
      // Não redirecionamos aqui para evitar loops; a guarda acontece quando authReady === '1'
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

      // Fluxo de logout explícito: limpar e ir imediatamente para /auth
      if (event === 'SIGNED_OUT') {
        try {
          // Sinaliza logout em progresso (mantemos em sessionStorage)
          sessionStorage.setItem('logoutInProgress', String(Date.now()));
          // Limpa estados locais/persistência do app
          localStorage.clear();
          // Remover chaves conhecidas de sessão sem limpar tudo
          sessionStorage.removeItem('returnTo');
        } catch (e) {
          // ignore
        }
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
    };
  }, [navigate]);

  return null;
}
