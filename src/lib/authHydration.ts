import type { Session } from "@supabase/supabase-js";
import { withTimeout } from "./withTimeout";

export const AUTH_HYDRATION_TIMEOUT_MS = 8_000;

type SessionReader = {
  auth: {
    getSession: () => Promise<{
      data: { session: Session | null };
      error: { message?: string } | null;
    }>;
  };
};

export function getSessionWithTimeout(client: SessionReader) {
  return withTimeout(client.auth.getSession(), AUTH_HYDRATION_TIMEOUT_MS, "Auth hydration");
}
