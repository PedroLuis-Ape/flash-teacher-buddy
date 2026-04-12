import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

// Rotas públicas que não exigem sessão
const PUBLIC_PREFIXES = ["/auth", "/portal"] as const;

function isProtectedPath(pathname: string) {
  return !PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export function SessionWatcher() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Track whether we've received the first auth event to avoid premature redirects
  const initializedRef = useRef(false);

  useEffect(() => {
    // Single reactive listener — Supabase's autoRefreshToken handles token renewal
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!initializedRef.current) {
        initializedRef.current = true;
      }

      if (event === 'SIGNED_IN') {
        // Invalidate auth-user query so useAuthUser picks up the new session
        queryClient.invalidateQueries({ queryKey: ['auth-user'] });
        if (window.location.pathname.startsWith('/auth')) {
          navigate('/', { replace: true });
        }
      }

      if (event === 'SIGNED_OUT') {
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

      // Route guard — only after first event received, redirect if no session on protected path
      if (initializedRef.current && !session && isProtectedPath(window.location.pathname)) {
        navigate('/auth', { replace: true });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate, queryClient]);

  return null;
}
