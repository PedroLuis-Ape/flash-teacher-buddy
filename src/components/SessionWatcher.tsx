import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

// Rotas públicas que não exigem sessão.
// Prefixos: qualquer rota que comece com um destes é pública.
const PUBLIC_PREFIXES = [
  "/auth",
  "/portal",
  "/about",
  "/ingles-para-iniciantes",
  "/atividades-de-ingles",
  "/flashcards-de-ingles",
  "/para-professores",
] as const;

// Caminhos exatos públicos (não usar startsWith pois "/" pegaria tudo).
const PUBLIC_EXACT = new Set<string>(["/"]);

function isProtectedPath(pathname: string) {
  if (PUBLIC_EXACT.has(pathname)) return false;
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
      // Mark as initialized AFTER processing this event (so the first event
      // — typically INITIAL_SESSION — does not itself trigger a guard redirect).
      const wasInitialized = initializedRef.current;

      if (event === 'SIGNED_IN') {
        // Invalidate auth-user query so useAuthUser picks up the new session
        queryClient.invalidateQueries({ queryKey: ['auth-user'] });
        if (window.location.pathname.startsWith('/auth')) {
          navigate('/dashboard', { replace: true });
        }
        initializedRef.current = true;
        return;
      }

      if (event === 'SIGNED_OUT') {
        // Clear all queries on logout so stale data doesn't persist
        queryClient.clear();
        navigate('/auth', { replace: true });
        initializedRef.current = true;
        return;
      }

      if (event === 'TOKEN_REFRESHED' && !session) {
        console.warn('[SessionWatcher] Token refresh lost session');
        navigate('/auth', { replace: true });
        initializedRef.current = true;
        return;
      }

      // Route guard — redirect logged-out users away from protected routes.
      // Runs on INITIAL_SESSION too: if the user opened a protected URL directly
      // without a session, send them to /auth instead of leaving them on a blank
      // protected page. Safe because Supabase already hydrated from localStorage
      // before firing INITIAL_SESSION.
      if (!session && isProtectedPath(window.location.pathname)) {
        navigate('/auth', { replace: true });
      }

      initializedRef.current = true;
    });

    return () => {
      subscription.unsubscribe();
    };
    // navigate/queryClient are stable across renders; we deliberately
    // mount this listener exactly once to avoid duplicate subscriptions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
