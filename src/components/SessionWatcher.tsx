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

    // 1) Verificação inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (!session && isProtectedPath(pathname)) {
        navigate("/auth", { replace: true });
      }
    });

    // 2) Listener único de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Redireciona para /auth quando fizer sign out ou quando não houver sessão
      if ((event === "SIGNED_OUT" || !session) && isProtectedPath(window.location.pathname)) {
        navigate("/auth", { replace: true });
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate, pathname]);

  return null;
}
