import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readPlatformRuntime } from "../../../integrations/supabase/platformRuntime";
import { McpDomainError } from "./errors";

export interface AuthenticatedUser {
  /** Verified JWT subject (auth.uid()) — never supplied by the model. */
  userId: string;
  /** Verified bearer token. Only used to build the user-scoped Supabase client. */
  token: string;
}

/**
 * Minimal surface of the MCP ToolContext consumed by the domain layer.
 * Declared structurally so unit tests can use the real ToolContext instance
 * without depending on its private internals.
 */
export interface ToolContextLike {
  isAuthenticated?: () => boolean;
  getUserId?: () => string | undefined;
  getToken?: () => string | undefined;
}

export interface UserScopedDb {
  client: SupabaseClient;
  userId: string;
}

/**
 * Opaque confirmation key used to sign/verify the stateless two-step
 * confirmation tokens. It is the verified bearer of the current request, kept
 * OUT of UserScopedDb on purpose so it can never leak into a tool payload by
 * accident (no storage, no migration).
 */
export type ConfirmationKey = string & { readonly __confirmationKey: unique symbol };

export interface ToolIdentity {
  db: UserScopedDb;
  confirmationKey: ConfirmationKey;
}

/**
 * Single authentication gate of the domain layer.
 *
 * Identity comes exclusively from the verified OAuth context: the model can
 * never choose whose data is touched, and no service-role client exists here.
 */
export function requireAuthenticatedUser(ctx: ToolContextLike | undefined): AuthenticatedUser {
  const userId = ctx?.getUserId?.();
  const token = ctx?.getToken?.();
  if (!userId || !token) {
    throw new McpDomainError(
      "unauthenticated",
      "Esta operação exige uma conta APE Piteco autenticada.",
      { hint: "Reconecte o cliente MCP à sua conta Piteco e repita a chamada." },
    );
  }
  return { userId, token };
}

/**
 * Supabase client scoped to the authenticated user's bearer token.
 *
 * The public (anon) key is the only credential used: RLS and the product
 * guards keep applying exactly as they do for the web app. The service-role key
 * is never read, stored or required by the MCP.
 */
export function createUserScopedClient(token: string): SupabaseClient {
  const runtime = readPlatformRuntime();
  return createClient(runtime.url, runtime.publicValue, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  });
}

export function createUserScopedDb(ctx: ToolContextLike | undefined): UserScopedDb {
  const { userId, token } = requireAuthenticatedUser(ctx);
  return { client: createUserScopedClient(token), userId };
}

/** Identity for tools that may need to sign or verify a confirmation token. */
export function createToolIdentity(ctx: ToolContextLike | undefined): ToolIdentity {
  const { userId, token } = requireAuthenticatedUser(ctx);
  return {
    db: { client: createUserScopedClient(token), userId },
    confirmationKey: token as ConfirmationKey,
  };
}
