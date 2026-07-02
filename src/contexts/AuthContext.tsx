/**
 * AuthContext — single source of truth for the authentication lifecycle.
 * Route navigation stays in SessionWatcher; data fetching stays in hooks.
 */
import {
  createContext,
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

export type AuthStatus =
  | "initializing"
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

  useEffect(() => {
    let cancelled = false;

    const syncQueryCache = (nextSession: Session | null) => {
      queryClient.setQueryData(["auth-user"], {
        user: nextSession?.user ?? null,
        session: nextSession,
      });
    };

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

        if (nextSession) {
          optimistic.current = nextSession;
          setSession(nextSession);
          setStatus("authenticated");
          setError(null);
          syncQueryCache(nextSession);
          return;
        }

        // INITIAL_SESSION may arrive before the persisted refresh finishes.
        // Keep the optimistic identity until getSession() confirms the result.
        if (event === "INITIAL_SESSION" && optimistic.current) {
          setSession(optimistic.current);
          setStatus("initializing");
          return;
        }

        setSession(null);
        setStatus("anonymous");
        setError(null);
        syncQueryCache(null);
      },
    );

    supabase.auth
      .getSession()
      .then(({ data, error: hydrationError }) => {
        if (cancelled) return;

        if (hydrationError) {
          setError(hydrationError);
          if (optimistic.current) {
            // Network or refresh outages must not masquerade as logout.
            setSession(optimistic.current);
            setStatus("authenticated");
            syncQueryCache(optimistic.current);
          } else {
            setStatus("error");
          }
          return;
        }

        const next = data.session ?? null;
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
          setStatus("authenticated");
          syncQueryCache(optimistic.current);
        } else {
          setStatus("error");
        }
      });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
    // queryClient is stable; mount exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user: session?.user ?? null,
      session,
      userId: session?.user?.id,
      accessToken: session?.access_token,
      initializing: status === "initializing",
      error,
    }),
    [status, session, error],
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
    };
  }
  return context;
}
