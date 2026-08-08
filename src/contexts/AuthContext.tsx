/**
 * AuthContext — single source of truth for the authentication lifecycle.
 * Route navigation stays in SessionWatcher; data fetching stays in hooks.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PRODUCTION_DATA_URL } from "@/integrations/supabase/platformRuntime";
import { getSessionWithTimeout } from "@/lib/authHydration";

export type AuthStatus =
  | "initializing"
  | "stale"
  | "authenticated"
  | "anonymous"
  | "error";

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  session: Session | null;
  userId: string | undefined;
  accessToken: string | undefined;
  initializing: boolean;
  error: Error | null;
  retryHydration: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Synchronous optimistic read of the session persisted by Supabase.
 * An expired access token is still useful here when a refresh token exists:
 * Supabase will renew it during hydration. Rejecting it early causes the login
 * screen to flash and legacy pages to conclude that the user signed out.
 */
function readPersistedSession(): Session | null {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || PRODUCTION_DATA_URL;
    const ref = new URL(supabaseUrl).hostname.split(".")[0];
    const raw = localStorage.getItem(`sb-${ref}-auth-token`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const persisted: Session | null = parsed?.currentSession ?? parsed ?? null;
    if (!persisted?.user?.id || !persisted?.refresh_token) return null;
    return persisted;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const optimistic = useRef<Session | null>(readPersistedSession());
  const [session, setSession] = useState<Session | null>(optimistic.current);
  const [status, setStatus] = useState<AuthStatus>("initializing");
  const [error, setError] = useState<Error | null>(null);
  const [hydrationAttempt, setHydrationAttempt] = useState(0);

  const syncQueryCache = useCallback((nextSession: Session | null) => {
    queryClient.setQueryData(["auth-user"], {
      user: nextSession?.user ?? null,
      session: nextSession,
    });
  }, [queryClient]);

  const clearCacheOnIdentityChange = useCallback((nextSession: Session | null) => {
    const previousUserId = optimistic.current?.user?.id ?? null;
    const nextUserId = nextSession?.user?.id ?? null;
    if (previousUserId && nextUserId && previousUserId !== nextUserId) {
      // Query keys are not uniformly user-scoped across the legacy surface.
      // Clearing before publishing the new identity prevents keep-previous
      // data and unscoped keys from being rendered for the next account.
      queryClient.clear();
    }
  }, [queryClient]);

  const retryHydration = useCallback(() => {
    setError(null);
    setStatus("initializing");
    setHydrationAttempt((attempt) => attempt + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        if (cancelled) return;

        if (event === "SIGNED_OUT") {
          optimistic.current = null;
          setSession(null);
          setStatus("anonymous");
          setError(null);
          queryClient.clear();
          return;
        }

        // INITIAL_SESSION can expose the persisted session before Supabase has
        // finished validating or refreshing its access token. Keep the identity
        // available for a stable shell, but do not let protected queries run yet.
        // getSession() below is the confirmation boundary that moves the app to
        // authenticated. Treating this event as authenticated caused RLS reads to
        // occasionally return a successful empty array during cold start.
        if (event === "INITIAL_SESSION") {
          const candidate = nextSession ?? optimistic.current;
          if (candidate) {
            clearCacheOnIdentityChange(candidate);
            optimistic.current = candidate;
            setSession(candidate);
            setStatus("initializing");
            setError(null);
            return;
          }
        }

        if (nextSession) {
          clearCacheOnIdentityChange(nextSession);
          optimistic.current = nextSession;
          setSession(nextSession);
          setStatus("authenticated");
          setError(null);
          syncQueryCache(nextSession);
          return;
        }

        setSession(null);
        setStatus("anonymous");
        setError(null);
        syncQueryCache(null);
      },
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
    // queryClient is stable; mount the subscription exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearCacheOnIdentityChange, syncQueryCache]);

  useEffect(() => {
    let cancelled = false;

    getSessionWithTimeout(supabase)
      .then(({ data, error: hydrationError }) => {
        if (cancelled) return;

        if (hydrationError) {
          const normalized = new Error(hydrationError.message || "Falha ao validar a sessão.");
          setError(normalized);
          if (optimistic.current) {
            // Network or refresh outages must not masquerade as logout, but a
            // persisted token is not confirmation for protected RLS reads.
            // Keep the identity for the shell and wait for a confirmed
            // session before study/data loaders are released.
            setSession(optimistic.current);
            setStatus("stale");
          } else {
            setStatus("error");
          }
          return;
        }

        const next = data.session ?? null;
        clearCacheOnIdentityChange(next);
        optimistic.current = next;
        setSession(next);
        setStatus(next ? "authenticated" : "anonymous");
        setError(null);
        syncQueryCache(next);
      })
      .catch((unknownError) => {
        if (cancelled) return;
        const normalized = unknownError instanceof Error
          ? unknownError
          : new Error(String(unknownError));
        setError(normalized);

        if (optimistic.current) {
          setSession(optimistic.current);
          setStatus("stale");
        } else {
          setStatus("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [clearCacheOnIdentityChange, hydrationAttempt, syncQueryCache]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user: session?.user ?? null,
      session,
      userId: session?.user?.id,
      accessToken: session?.access_token,
      initializing: status === "initializing" || status === "stale",
      error,
      retryHydration,
    }),
    [status, session, error, retryHydration],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    return {
      status: "initializing",
      user: null,
      session: null,
      userId: undefined,
      accessToken: undefined,
      initializing: true,
      error: null,
      retryHydration: () => undefined,
    };
  }
  return context;
}
