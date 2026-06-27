import { supabase } from "@/integrations/supabase/client";

/**
 * Returns a non-expired session, refreshing once if the cached token is stale.
 * If refresh fails (e.g. refresh token also expired), signs the user out and
 * returns null so callers can avoid sending a known-bad JWT to edge functions.
 */
export async function getFreshSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const expiresAt = session.expires_at ?? 0;
  const nowSec = Math.floor(Date.now() / 1000);
  // Refresh proactively when expired or within 10s of expiry.
  if (expiresAt - nowSec > 10) return session;

  const { data, error } = await supabase.auth.refreshSession();
  if (error || !data.session) {
    await supabase.auth.signOut().catch(() => {});
    return null;
  }
  return data.session;
}