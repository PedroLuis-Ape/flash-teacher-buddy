/**
 * AuthContext — Single source of truth for authentication lifecycle.
 *
 * Phase 1 (Clara Master): centralizes the Supabase auth subscription that
 * was previously scattered across SessionWatcher / useAuthUser. Exposes a
 * discrete `status` ('initializing' | 'authenticated' | 'anonymous' | 'error')
 * so consumers (route guard, EconomyInitializer, etc.) can wait for a
 * *confirmed* auth state instead of guessing from cached/optimistic data.
 *
 * Non-goals (do NOT add here):
 *   - route navigation (lives in SessionWatcher)
 *   - economy side-effects (lives in EconomyInitializer)
 *   - data fetching (use React Query keyed by userId)
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
  /** True until the first auth event has been processed. */
  initializing: boolean;
  error: Error | null;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/** Sync optimistic read of the persisted Supabase session (no network). */
function readPersistedSession(): Session | null {
  try {
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
    if (!SUPABASE_URL) return null;
    const ref = new URL(SUPABASE_URL).hostname.split(".")[0];
    const raw = localStorage.getItem(`sb-${ref}-auth-token`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const session: Session | null = parsed?.currentSession ?? parsed ?? null;
    if (!session?.user?.id || !session?.access_token) return null;
    if (session.expires_at && session.expires_at * 1000 < Date.now() - 60_000) {
      return null;
    }
    return session;
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

    // Single subscription for the whole app. SessionWatcher used to own
    // this; we centralize it here so every consumer agrees on auth state.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        if (cancelled) return;
        setSession(nextSession ?? null);
        setStatus(nextSession ? "authenticated" : "anonymous");
        setError(null);

        // Keep React Query's ['auth-user'] cache in sync for legacy hooks.
        queryClient.setQueryData(["auth-user"], {
          user: nextSession?.user ?? null,
          session: nextSession ?? null,
        });

        if (event === "SIGNED_OUT") {
          // Clear data-bearing queries so stale rows don't leak between users.
          queryClient.clear();
        }
      },
    );

    // Confirm the persisted session against the server. Optimistic state
    // is only a hint — `status` only resolves once getSession() returns.
    supabase.auth
      .getSession()
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) {
          setStatus("error");
          setError(err);
          return;
        }
        const next = data.session ?? null;
        setSession(next);
        setStatus(next ? "authenticated" : "anonymous");
        queryClient.setQueryData(["auth-user"], {
          user: next?.user ?? null,
          session: next,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus("error");
        setError(err instanceof Error ? err : new Error(String(err)));
      });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
    // queryClient is stable; we deliberately mount exactly once.
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
  const ctx = useContext(AuthContext);
  if (!ctx) {
    // Defensive fallback for trees rendered outside the provider (tests).
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
  return ctx;
}