import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Read Supabase session from localStorage synchronously.
 * This gives us an optimistic user/session before the async getSession() resolves,
 * eliminating the flash of loading state on startup.
 */
function getOptimisticSession() {
  try {
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
    if (!SUPABASE_URL) return null;
    // Supabase stores its session under this key pattern
    const storageKey = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Supabase stores { currentSession: { user, access_token, ... } } or similar
    const session = parsed?.currentSession ?? parsed;
    if (!session?.user?.id || !session?.access_token) return null;
    // Quick expiry check — if the token expired more than 60s ago, don't trust it
    if (session.expires_at && session.expires_at * 1000 < Date.now() - 60_000) {
      return null;
    }
    return { user: session.user, session };
  } catch {
    return null;
  }
}

/**
 * Centralized auth hook — single getSession() cached via React Query.
 * All components should use this instead of calling supabase.auth.getSession() directly.
 *
 * Uses optimistic localStorage read as initialData so the first render
 * already has user/session (no loading flash).
 */
export function useAuthUser() {
  // Prefer the centralized AuthProvider when present (Phase 1 Clara
  // Master). Falls back to the legacy React Query path for trees that
  // are rendered outside the provider (e.g. isolated tests).
  const ctx = useAuth();
  if (ctx.status !== "initializing" || ctx.user) {
    return {
      user: ctx.user,
      session: ctx.session,
      isLoading: ctx.status === "initializing",
      userId: ctx.userId,
      accessToken: ctx.accessToken,
    };
  }

  const optimistic = getOptimisticSession();

  const { data, isLoading } = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) return { user: null, session: null };
      return { user: session.user, session };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
    // Provide synchronous initial data from localStorage so isLoading starts as false
    ...(optimistic ? { initialData: optimistic } : {}),
  });

  return {
    user: data?.user ?? null,
    session: data?.session ?? null,
    isLoading: optimistic ? false : isLoading,
    userId: data?.user?.id,
    accessToken: data?.session?.access_token,
  };
}
