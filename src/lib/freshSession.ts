import { supabase } from "@/integrations/supabase/client";

let lastValidatedAccessToken: string | null = null;
let lastValidatedAt = 0;
const VALIDATION_TTL_MS = 30_000;

async function refreshOrSignOut() {
  const { data, error } = await supabase.auth.refreshSession();
  if (error || !data.session) {
    lastValidatedAccessToken = null;
    lastValidatedAt = 0;
    await supabase.auth.signOut().catch(() => {});
    return null;
  }

  lastValidatedAccessToken = data.session.access_token;
  lastValidatedAt = Date.now();
  return data.session;
}

/**
 * Returns a session that is not only unexpired locally, but still accepted by
 * the current Supabase Auth backend. This matters after JWT-key rotation or a
 * corrected project configuration: a cached token can have time remaining and
 * still be rejected by Edge Functions as UNAUTHORIZED_LEGACY_JWT.
 */
export async function getFreshSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const expiresAt = session.expires_at ?? 0;
  const nowSec = Math.floor(Date.now() / 1000);
  if (expiresAt - nowSec <= 10) return refreshOrSignOut();

  const recentlyValidated = lastValidatedAccessToken === session.access_token
    && Date.now() - lastValidatedAt < VALIDATION_TTL_MS;
  if (recentlyValidated) return session;

  const { data: userData, error: userError } = await supabase.auth.getUser(session.access_token);
  if (!userError && userData.user) {
    lastValidatedAccessToken = session.access_token;
    lastValidatedAt = Date.now();
    return session;
  }

  return refreshOrSignOut();
}
